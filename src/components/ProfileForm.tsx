"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

type SettingsProfile = {
  id: string;
  email: string | null;
  username: string;
  display_name: string;
  avatar_emoji: string | null;
  avatar_url: string | null;
  bio: string | null;
  display_name_changed_at: string | null;
};

const DISPLAY_NAME_COOLDOWN_DAYS = 30;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

export function ProfileForm({
  profile,
  emojiOptions,
}: {
  profile: SettingsProfile;
  emojiOptions: string[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [emoji, setEmoji] = useState(profile.avatar_emoji ?? "🙂");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendingPasswordEmail, setSendingPasswordEmail] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextDisplayNameChange = useMemo(() => {
    if (!profile.display_name_changed_at) return null;
    const changedAt = new Date(profile.display_name_changed_at);
    changedAt.setDate(changedAt.getDate() + DISPLAY_NAME_COOLDOWN_DAYS);
    return changedAt;
  }, [profile.display_name_changed_at]);

  const canChangeDisplayName = !nextDisplayNameChange || Date.now() >= nextDisplayNameChange.getTime();
  const displayNameChanged = displayName.trim() !== profile.display_name;

  async function uploadAvatar(file: File) {
    setError(null);
    setMessage(null);

    if (!file.type.startsWith("image/")) {
      setError(t("profile.avatarInvalidType"));
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setError(t("profile.avatarTooLarge"));
      return;
    }

    setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${profile.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });

    if (uploadError) {
      setError(t("profile.avatarUploadFailed"));
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setMessage(t("profile.avatarReady"));
    setUploading(false);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);

    const nextName = displayName.trim();

    if (!nextName) {
      setError(t("profile.displayNameRequired"));
      setSaving(false);
      return;
    }

    if (nextName.length > 40) {
      setError(t("profile.displayNameTooLong"));
      setSaving(false);
      return;
    }

    if (displayNameChanged && !canChangeDisplayName) {
      setError(
        t("profile.displayNameCooldown", {
          date: nextDisplayNameChange?.toLocaleDateString() ?? "",
        })
      );
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: nextName, avatar_emoji: emoji, avatar_url: avatarUrl, bio: bio.trim() })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setMessage(t("common.saved"));
    router.refresh();
  }

  async function sendPasswordEmail() {
    setError(null);
    setMessage(null);

    if (!profile.email) {
      setError(t("profile.emailMissing"));
      return;
    }

    setSendingPasswordEmail(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setSendingPasswordEmail(false);
      return;
    }

    setMessage(t("profile.passwordEmailSent"));
    setSendingPasswordEmail(false);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl2 border border-ink-border bg-ink-surface p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-ink-surface2 border border-ink-border flex items-center justify-center text-2xl">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              emoji
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{profile.display_name}</p>
            <p className="text-xs text-ink-muted font-mono truncate">@{profile.username}</p>
            {profile.email && <p className="text-xs text-ink-faint truncate">{profile.email}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">{t("profile.displayNameLabel")}</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={!canChangeDisplayName}
              className="w-full rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors disabled:opacity-60"
            />
            <p className="text-xs text-ink-faint mt-1.5">
              {canChangeDisplayName
                ? t("profile.displayNameAvailable")
                : t("profile.displayNameCooldown", {
                    date: nextDisplayNameChange?.toLocaleDateString() ?? "",
                  })}
            </p>
          </div>

          <div>
            <label className="text-xs font-mono text-ink-muted block mb-1.5">{t("profile.bioLabel")}</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              placeholder={t("profile.bioPlaceholder") || "Write something about yourself..."}
              className="w-full rounded-lg bg-ink-surface2 border border-ink-border px-4 py-2.5 outline-none focus:border-command transition-colors resize-none h-24 text-sm"
            />
            <p className="text-xs text-ink-faint mt-1.5 font-mono text-right">
              {bio.length}/200
            </p>
          </div>

          <div>
            <label className="text-xs font-mono text-ink-muted block mb-2">{t("profile.avatarImageLabel")}</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadAvatar(file);
              }}
              className="block w-full text-sm text-ink-muted file:mr-4 file:rounded-lg file:border-0 file:bg-command file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink-text hover:file:bg-command/85"
            />
            <p className="text-xs text-ink-faint mt-1.5">{t("profile.avatarHelp")}</p>
          </div>

          <div>
            <label className="text-xs font-mono text-ink-muted block mb-2">{t("profile.iconLabel")}</label>
            <div className="flex flex-wrap gap-2">
              {emojiOptions.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border transition-colors ${
                    emoji === e ? "border-command bg-command/15" : "border-ink-border hover:border-ink-faint"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={saving || uploading}
              className="rounded-lg bg-command hover:bg-command/85 disabled:opacity-50 transition-colors font-semibold px-5 py-2.5 text-sm"
            >
              {saving ? t("common.saving") : t("common.saveChanges")}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                className="rounded-lg border border-ink-border hover:border-danger/60 text-ink-muted hover:text-danger transition-colors px-5 py-2.5 text-sm"
              >
                {t("profile.removeAvatar")}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl2 border border-ink-border bg-ink-surface p-5">
        <h2 className="font-display font-bold text-xl mb-2">{t("profile.securityTitle")}</h2>
        <p className="text-sm text-ink-muted mb-4">{t("profile.securitySubtitle")}</p>
        <button
          type="button"
          onClick={sendPasswordEmail}
          disabled={sendingPasswordEmail}
          className="rounded-lg border border-command/50 text-command hover:bg-command/10 disabled:opacity-50 transition-colors font-semibold px-5 py-2.5 text-sm"
        >
          {sendingPasswordEmail ? t("auth.sendingReset") : t("profile.sendPasswordEmail")}
        </button>
      </section>

      {message && <p className="text-sm text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">{message}</p>}
      {error && <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}
