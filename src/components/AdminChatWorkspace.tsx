"use client";

import { AdminGroupChat } from "@/components/AdminGroupChat";
import { AdminChatSidePanel, AdminChatMember } from "@/components/AdminChatSidePanel";
import { MobileChatShell } from "@/components/MobileChatShell";
import { useIsMobile } from "@/lib/useIsMobile";
import { useI18n } from "@/components/I18nProvider";
import type { AdminMessage, Department } from "@/lib/types";

interface Props {
  currentUserId: string;
  initialMessages: AdminMessage[];
  admins: AdminChatMember[];
  departments: Department[];
}

/**
 * Bọc Admin Group Chat: desktop = chat + danh bạ cạnh nhau;
 * mobile = full màn hình qua MobileChatShell, danh bạ trong drawer phải.
 */
export function AdminChatWorkspace({ currentUserId, initialMessages, admins, departments }: Props) {
  const isMobile = useIsMobile();
  const { t } = useI18n();

  const chat = <AdminGroupChat currentUserId={currentUserId} initialMessages={initialMessages} />;
  const panel = (
    <AdminChatSidePanel
      admins={admins}
      departments={departments}
      messagesBasePath="/admin/messages"
      profileBasePath="/admin/profile"
      currentUserId={currentUserId}
    />
  );

  if (isMobile) {
    return (
      <MobileChatShell title={t("nav.adminGroupChat")} drawer={panel}>
        {chat}
      </MobileChatShell>
    );
  }

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      <div className="h-[70svh] min-h-[420px] min-w-0 flex-1 xl:h-[calc(100vh-210px)] xl:min-h-[620px]">
        {chat}
      </div>
      <div className="h-[380px] w-full shrink-0 xl:h-[calc(100vh-210px)] xl:min-h-[620px] xl:w-72">
        {panel}
      </div>
    </div>
  );
}
