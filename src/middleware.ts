import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip")?.trim() || null;
}

type AuthProfile = {
  user_type: string;
  account_banned_at: string | null;
};

const IP_BAN_CACHE_TTL_MS = 30_000;
const PROFILE_IP_RECORD_TTL_MS = 5 * 60_000;
const MAX_MIDDLEWARE_CACHE_ENTRIES = 5_000;

const ipBanCache = new Map<string, { banned: boolean; expiresAt: number }>();
const profileIpRecordCache = new Map<string, number>();

function pruneCache<T>(cache: Map<string, T>) {
  if (cache.size <= MAX_MIDDLEWARE_CACHE_ENTRIES) return;
  const removeCount = Math.ceil(cache.size / 5);
  for (const key of cache.keys()) {
    cache.delete(key);
    if (cache.size <= MAX_MIDDLEWARE_CACHE_ENTRIES - removeCount) break;
  }
}

async function isIpBannedCached(supabase: any, ip: string) {
  const now = Date.now();
  const cached = ipBanCache.get(ip);
  if (cached && cached.expiresAt > now) return cached.banned;

  const { data: ipBanned, error: ipBanError } = await supabase.rpc("is_ip_banned", { ip_text: ip });
  const banned = !ipBanError && !!ipBanned;
  ipBanCache.set(ip, { banned, expiresAt: now + IP_BAN_CACHE_TTL_MS });
  pruneCache(ipBanCache);
  return banned;
}

function shouldRecordProfileIp(userId: string, ip: string) {
  const now = Date.now();
  const key = `${userId}:${ip}`;
  const lastRecordedAt = profileIpRecordCache.get(key) ?? 0;
  if (now - lastRecordedAt < PROFILE_IP_RECORD_TTL_MS) return false;

  profileIpRecordCache.set(key, now);
  pruneCache(profileIpRecordCache);
  return true;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // /admin-directory (player) phải KHÔNG bị coi là admin area —
  // path.startsWith("/admin") sẽ match nhầm /admin-directory.
  // /admin/* (kể cả /admin/admin-directory) vẫn là admin area.
  const isAdminArea =
    (path.startsWith("/admin/") || path === "/admin") && path !== "/admin/login";
  const isPlayerArea =
    ["/dashboard", "/house", "/messages", "/announcements", "/profile", "/admin-directory", "/house-announcements", "/ai-chat"].some((p) =>
      path.startsWith(p)
    );
  const isProtectedArea = isAdminArea || isPlayerArea;
  const clientIp = getClientIp(request);

  if (clientIp) {
    const ipBanned = await isIpBannedCached(supabase, clientIp);
    if (ipBanned) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("banned", "ip");
      return NextResponse.redirect(url);
    }
  }

  if (!user && isProtectedArea) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let profile: AuthProfile | null = null;
  if (user && isProtectedArea) {
    if (clientIp && shouldRecordProfileIp(user.id, clientIp)) {
      await supabase.rpc("record_profile_ip", { ip_text: clientIp });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("user_type, account_banned_at")
      .eq("id", user.id)
      .single();
    profile = data;

    if (error) {
      const { data: legacyProfile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();
      profile = legacyProfile ? { user_type: legacyProfile.user_type, account_banned_at: null } : null;
    }

    if (profile?.account_banned_at) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("banned", "account");
      return NextResponse.redirect(url);
    }
  }

  // Verify admin role for admin routes — prevent players from accessing admin pages
  if (user && isAdminArea) {
    if (!profile || profile.user_type !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/house/:path*",
    "/messages/:path*",
    "/announcements/:path*",
    "/profile/:path*",
    "/house-announcements/:path*",
    "/ai-chat/:path*",
    "/admin-directory/:path*",
    "/admin/:path*",
  ],
};
