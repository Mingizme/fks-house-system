import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip")?.trim() || null;
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
    ["/dashboard", "/house", "/messages", "/announcements", "/profile", "/admin-directory", "/house-announcements"].some((p) =>
      path.startsWith(p)
    );
  const isProtectedArea = isAdminArea || isPlayerArea;
  const clientIp = getClientIp(request);

  if (clientIp) {
    const { data: ipBanned } = await supabase.rpc("is_ip_banned", { ip_text: clientIp });
    if (ipBanned && (path !== "/login" || request.nextUrl.searchParams.get("banned") !== "ip")) {
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

  let profile: { user_type: string; account_banned_at: string | null } | null = null;
  if (user && isProtectedArea) {
    if (clientIp) {
      await supabase.rpc("record_profile_ip", { ip_text: clientIp });
    }

    const { data } = await supabase
      .from("profiles")
      .select("user_type, account_banned_at")
      .eq("id", user.id)
      .single();
    profile = data;

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
    "/admin-directory/:path*",
    "/admin/:path*",
    "/login",
    "/signup",
  ],
};
