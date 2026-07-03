"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";

interface Result {
  id: string;
  display_name: string;
  username: string;
  avatar_emoji: string | null;
}

function escapeFilterValue(s: string): string {
  return s.replace(/[%_\\]/g, (c) => "\\" + c);
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
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (q: string) => {
    const escaped = escapeFilterValue(q.trim());
    let builder = supabase
      .from("profiles")
      .select("id, display_name, username, avatar_emoji")
      .neq("id", excludeSelf)
      .or(`display_name.ilike.%${escaped}%,username.ilike.%${escaped}%`)
      .limit(6);
    if (adminOnly) builder = builder.eq("user_type", "admin");
    const { data } = await builder;
    setResults(data ?? []);
    setOpen(true);
  }, [supabase, excludeSelf, adminOnly]);

  function handleInputChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(value), 300);
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={adminOnly ? t("messages.searchAdmin") : t("messages.searchPlayer")}
        aria-label={adminOnly ? t("messages.searchAdmin") : t("messages.searchPlayer")}
        className="w-full rounded-lg bg-ink-surface border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command transition-colors"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-ink-border bg-ink-surface2 shadow-crest overflow-hidden" role="listbox">
          {results.map((r) => (
            <button
              key={r.id}
              disabled={isPending}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                setQuery("");
                startTransition(() => {
                  router.push(`${basePath}/${r.id}`);
                });
              }}
              role="option"
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-ink-bg text-left transition-colors disabled:opacity-60"
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
