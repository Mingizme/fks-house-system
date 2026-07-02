"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NewAnnouncementForm({ adminId }: { adminId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!title.trim() || !content.trim()) {
      setError("Cần nhập đầy đủ tiêu đề và nội dung.");
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase
      .from("announcements")
      .insert({ admin_id: adminId, title: title.trim(), content: content.trim() });
    setSaving(false);
    if (insertError) {
      setError("Không thể đăng, vui lòng thử lại.");
      return;
    }
    setTitle("");
    setContent("");
    router.refresh();
  }

  return (
    <div className="rounded-xl2 border border-ink-border bg-ink-surface p-5 mb-8">
      <p className="font-display font-bold mb-4">Đăng thông báo mới</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề"
        className="w-full rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command mb-3"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Nội dung thông báo..."
        rows={4}
        className="w-full rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 text-sm outline-none focus:border-command mb-3 resize-none"
      />
      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      <button
        onClick={submit}
        disabled={saving}
        className="rounded-lg bg-command hover:bg-command/85 disabled:opacity-50 transition-colors font-semibold px-5 py-2.5 text-sm"
      >
        {saving ? "Đang đăng..." : "Đăng thông báo"}
      </button>
    </div>
  );
}
