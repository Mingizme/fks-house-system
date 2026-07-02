"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";

interface Result {
  id: string;
  display_name: string;
  username: string;
  avatar_emoji: string | null;
}

export function NewConversationSearch({
  excludeSelf,
  basePath,
  adminOnly = false,
}: {
  excludeSelf: string;
  basePath: string;
  adminOnly?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    let builder = supabase
      .from("profiles")
      .select("id, display_name, username, avatar_emoji")
      .neq("id", excludeSelf)
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(6);
    if (adminOnly) builder = builder.eq("user_type", "admin");
    const { data } = await builder;
    setResults(data ?? []);
    setOpen(true);
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={adminOnly ? t("messages.searchAdmin") : t("messages.searchPlayer")}
        className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command transition-colors"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-ink-border bg-ink-surface2 shadow-crest overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                router.push(`${basePath}/${r.id}`);
                setOpen(false);
                setQuery("");
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-ink-bg text-left transition-colors"
            >
              <span>{r.avatar_emoji ?? "🙂"}</span>
              <span className="text-sm">{r.display_name}</span>
              <span className="text-xs text-ink-faint font-mono ml-auto">@{r.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
