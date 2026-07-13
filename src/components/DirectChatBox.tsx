"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DirectMessage } from "@/lib/types";
import { useI18n } from "@/components/I18nProvider";
import { useIsMobile } from "@/lib/useIsMobile";
import { MobileChatShell } from "@/components/MobileChatShell";
import { useMuteStatus, MuteBanner } from "@/components/MuteControls";
import ChatMessage from "./chat/ChatMessage";
import ChatTimeDivider from "./chat/ChatTimeDivider";
import ChatInput from "./chat/ChatInput";
import EmojiPicker from "./chat/EmojiPicker";
import { shouldShowMessageTimeDivider } from "./chat/timeDividers";
import {
  addReaction,
  groupReactions,
  pruneReactions,
  removeReaction,
  type GroupedReactions,
  type MessageReactionRow,
} from "@/lib/chat-reactions";
import { resolveChatMarkdownSettings, type ChatMarkdownSettings } from "@/lib/chat-markdown-settings";
import { sanitizeChatContent } from "@/lib/chat-sanitize";

const PAGE_SIZE = 30;
const SCROLL_EDGE_PX = 260;
const VIRTUAL_OVERSCAN_PX = 700;
const ESTIMATED_MESSAGE_HEIGHT = 112;
const ESTIMATED_DIVIDER_HEIGHT = 36;

type DeliveryStatus = "sending" | "offline" | "sent" | "read" | "failed";

type DirectMessageView = DirectMessage & {
  local_status?: Extract<DeliveryStatus, "sending" | "offline" | "failed">;
};

type PendingDirectMessage = {
  localId: string;
  content: string;
  replyToId: string | null;
  mediaUrl: string | null;
  mediaThumbnailUrl: string | null;
  mediaType: "image" | "video" | null;
  createdAt: string;
  formattingSettings: ChatMarkdownSettings;
};

type VirtualRow =
  | { type: "divider"; key: string; timestamp: string }
  | { type: "message"; key: string; message: DirectMessageView };

interface Props {
  currentUserId: string;
  otherUser: { id: string; display_name: string; avatar_emoji: string | null; avatar_url: string | null };
  initialMessages: DirectMessage[];
  profileBasePath: string;
  isAdminChat?: boolean;
  initiallyBlocked?: boolean;
  composerMarkdownSettings?: ChatMarkdownSettings;
}

function isLocalMessageId(id: string) {
  return id.startsWith("local-");
}

function createLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local-${crypto.randomUUID()}`;
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function MeasuredRow({
  rowKey,
  onMeasure,
  children,
}: {
  rowKey: string;
  onMeasure: (rowKey: string, height: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => onMeasure(rowKey, element.getBoundingClientRect().height);
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children, onMeasure, rowKey]);

  return <div ref={ref}>{children}</div>;
}

export function DirectChatBox({
  currentUserId,
  otherUser,
  initialMessages,
  profileBasePath,
  isAdminChat = false,
  initiallyBlocked = false,
  composerMarkdownSettings,
}: Props) {
  const supabase = createClient();
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<DirectMessageView[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialMessages.length >= PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const { isMuted: chatRestricted, muteStatus } = useMuteStatus(currentUserId, null);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [reactions, setReactions] = useState<GroupedReactions>({});
  const [activePicker, setActivePicker] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [pickerMounted, setPickerMounted] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [newMessagesBelow, setNewMessagesBelow] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [scrollFrame, setScrollFrame] = useState({ top: 0, height: 0 });
  const [measureVersion, setMeasureVersion] = useState(0);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdSetRef = useRef<Set<string>>(new Set(initialMessages.map((message) => message.id)));
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const rowHeightsRef = useRef<Map<string, number>>(new Map());
  const isNearBottomRef = useRef(true);
  const pendingAutoScrollRef = useRef<ScrollBehavior | null>("auto");
  const pendingPrependAdjustmentRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const flushingQueueRef = useRef(false);
  const composerFormattingSettings = useMemo(
    () => resolveChatMarkdownSettings(composerMarkdownSettings),
    [composerMarkdownSettings]
  );
  const queueKey = useMemo(
    () => `direct-chat-pending:${isAdminChat ? "admin" : "dm"}:${[currentUserId, otherUser.id].sort().join(":")}`,
    [currentUserId, isAdminChat, otherUser.id]
  );

  const messageById = useMemo(() => {
    const map = new Map<string, DirectMessageView>();
    for (const message of messages) {
      map.set(message.id, message);
    }
    return map;
  }, [messages]);

  const rows = useMemo<VirtualRow[]>(() => {
    const nextRows: VirtualRow[] = [];
    messages.forEach((message, index) => {
      if (shouldShowMessageTimeDivider(message.created_at, messages[index - 1]?.created_at)) {
        nextRows.push({
          type: "divider",
          key: `divider-${message.created_at}-${message.id}`,
          timestamp: message.created_at,
        });
      }
      nextRows.push({ type: "message", key: `message-${message.id}`, message });
    });
    return nextRows;
  }, [messages]);

  const virtualLayout = useMemo(() => {
    let offset = 0;
    const measuredRows = rows.map((row) => {
      const height =
        rowHeightsRef.current.get(row.key) ??
        (row.type === "divider" ? ESTIMATED_DIVIDER_HEIGHT : ESTIMATED_MESSAGE_HEIGHT);
      const result = { row, start: offset, height };
      offset += height;
      return result;
    });

    const startY = Math.max(0, scrollFrame.top - VIRTUAL_OVERSCAN_PX);
    const endY = scrollFrame.top + scrollFrame.height + VIRTUAL_OVERSCAN_PX;
    let startIndex = measuredRows.findIndex((item) => item.start + item.height >= startY);
    if (startIndex === -1) startIndex = Math.max(0, measuredRows.length - 1);

    let endIndex = measuredRows.findIndex((item) => item.start > endY);
    if (endIndex === -1) endIndex = measuredRows.length;
    endIndex = Math.min(measuredRows.length, Math.max(endIndex + 1, startIndex + 1));

    const visible = measuredRows.slice(startIndex, endIndex);
    const topPadding = visible[0]?.start ?? 0;
    const last = visible[visible.length - 1];
    const bottomPadding = last ? Math.max(0, offset - (last.start + last.height)) : 0;

    return { visible, topPadding, bottomPadding, totalHeight: offset };
  }, [measureVersion, rows, scrollFrame, messages.length]);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  }

  const readPendingMessages = useCallback((): PendingDirectMessage[] => {
    if (typeof window === "undefined") return [];

    try {
      const raw = window.localStorage.getItem(queueKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PendingDirectMessage[]) : [];
    } catch {
      return [];
    }
  }, [queueKey]);

  const writePendingMessages = useCallback(
    (items: PendingDirectMessage[]) => {
      if (typeof window === "undefined") return;
      if (items.length === 0) {
        window.localStorage.removeItem(queueKey);
        return;
      }
      window.localStorage.setItem(queueKey, JSON.stringify(items));
    },
    [queueKey]
  );

  const enqueuePendingMessage = useCallback(
    (pending: PendingDirectMessage) => {
      const existing = readPendingMessages().filter((item) => item.localId !== pending.localId);
      writePendingMessages([...existing, pending]);
    },
    [readPendingMessages, writePendingMessages]
  );

  const dequeuePendingMessage = useCallback(
    (localId: string) => {
      writePendingMessages(readPendingMessages().filter((item) => item.localId !== localId));
    },
    [readPendingMessages, writePendingMessages]
  );

  const pendingToMessage = useCallback(
    (pending: PendingDirectMessage, status: Extract<DeliveryStatus, "sending" | "offline" | "failed">): DirectMessageView => ({
      id: pending.localId,
      sender_id: currentUserId,
      recipient_id: otherUser.id,
      content: pending.content,
      is_admin_chat: isAdminChat,
      created_at: pending.createdAt,
      read_at: null,
      edited_at: null,
      deleted_at: null,
      reply_to_id: pending.replyToId,
      media_url: pending.mediaUrl,
      media_thumbnail_url: pending.mediaThumbnailUrl,
      media_type: pending.mediaType,
      formatting_settings: pending.formattingSettings,
      local_status: status,
    }),
    [currentUserId, isAdminChat, otherUser.id]
  );

  const replaceOptimisticWithServer = useCallback((prev: DirectMessageView[], row: DirectMessage): DirectMessageView[] => {
    const existingIndex = prev.findIndex((message) => message.id === row.id);
    if (existingIndex !== -1) {
      const next = [...prev];
      next[existingIndex] = row;
      return next;
    }

    const optimisticIndex = prev.findIndex(
      (message) =>
        isLocalMessageId(message.id) &&
        message.sender_id === row.sender_id &&
        message.recipient_id === row.recipient_id &&
        message.content === row.content &&
        message.reply_to_id === row.reply_to_id &&
        message.media_url === row.media_url
    );

    const next = [...prev];
    if (optimisticIndex !== -1) {
      next[optimisticIndex] = row;
    } else {
      next.push(row);
    }

    next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return next;
  }, []);

  const persistPendingMessage = useCallback(
    async (pending: PendingDirectMessage) => {
      const { data, error: insertError } = await supabase
        .from("direct_messages")
        .insert({
          sender_id: currentUserId,
          recipient_id: otherUser.id,
          content: pending.content,
          is_admin_chat: isAdminChat,
          reply_to_id: pending.replyToId,
          media_url: pending.mediaUrl,
          media_thumbnail_url: pending.mediaThumbnailUrl,
          media_type: pending.mediaType,
          formatting_settings: pending.formattingSettings,
        })
        .select()
        .single();

      if (insertError) {
        const offlineNow = typeof navigator !== "undefined" && !navigator.onLine;
        if (offlineNow) {
          enqueuePendingMessage(pending);
          setMessages((prev) =>
            prev.map((message) =>
              message.id === pending.localId ? { ...message, local_status: "offline" } : message
            )
          );
        } else {
          dequeuePendingMessage(pending.localId);
          setMessages((prev) =>
            prev.map((message) =>
              message.id === pending.localId ? { ...message, local_status: "failed" } : message
            )
          );
          showError(t("chat.sendFailed"));
        }
        return false;
      }

      if (data) {
        dequeuePendingMessage(pending.localId);
        setMessages((prev) => replaceOptimisticWithServer(prev, data as DirectMessage));
      }

      return true;
    },
    [
      currentUserId,
      dequeuePendingMessage,
      enqueuePendingMessage,
      isAdminChat,
      otherUser.id,
      replaceOptimisticWithServer,
      supabase,
      t,
    ]
  );

  const flushPendingMessages = useCallback(async () => {
    if (flushingQueueRef.current) return;
    const queued = readPendingMessages();
    if (queued.length === 0) return;

    flushingQueueRef.current = true;
    try {
      for (const pending of queued) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === pending.localId ? { ...message, local_status: "sending" } : message
          )
        );
        await persistPendingMessage(pending);
      }
    } finally {
      flushingQueueRef.current = false;
    }
  }, [persistPendingMessage, readPendingMessages]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      const element = scrollAreaRef.current;
      if (!element) return;
      element.scrollTo({ top: element.scrollHeight, behavior });
      isNearBottomRef.current = true;
      setNewMessagesBelow(false);
      setScrollFrame({ top: element.scrollTop, height: element.clientHeight });
    });
  }, []);

  const handleMeasureRow = useCallback((rowKey: string, height: number) => {
    const roundedHeight = Math.ceil(height);
    if (rowHeightsRef.current.get(rowKey) === roundedHeight) return;
    rowHeightsRef.current.set(rowKey, roundedHeight);
    setMeasureVersion((version) => version + 1);
  }, []);

  const refetchReactions = useCallback(
    (ids?: string[]) => {
      const msgIds = (ids ?? [...messageIdSetRef.current]).filter((id) => !isLocalMessageId(id));
      if (msgIds.length === 0) {
        if (!ids) setReactions({});
        return;
      }
      supabase
        .from("message_reactions")
        .select("message_id,user_id,emoji")
        .eq("message_type", "dm")
        .in("message_id", msgIds)
        .then(({ data }) => {
          if (!data) return;
          const grouped = groupReactions(data as MessageReactionRow[]);
          if (ids) {
            setReactions((prev) => ({ ...prev, ...grouped }));
          } else {
            setReactions(grouped);
          }
        });
    },
    [supabase]
  );

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore) return;
    const oldest = messages.find((message) => !isLocalMessageId(message.id));
    if (!oldest) {
      setHasMore(false);
      return;
    }

    const element = scrollAreaRef.current;
    if (element) {
      pendingPrependAdjustmentRef.current = {
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
      };
    }

    setLoadingOlder(true);
    const { data, error: loadError } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("is_admin_chat", isAdminChat)
      .or(
        `and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},recipient_id.eq.${currentUserId})`
      )
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (loadError) {
      pendingPrependAdjustmentRef.current = null;
      showError(t("chat.loadOlderFailed"));
    } else {
      const older = ((data ?? []) as DirectMessage[]).slice().reverse();
      setHasMore(older.length === PAGE_SIZE);
      if (older.length > 0) {
        setMessages((prev) => {
          const existing = new Set(prev.map((message) => message.id));
          return [...older.filter((message) => !existing.has(message.id)), ...prev];
        });
        refetchReactions(older.map((message) => message.id));
      } else {
        pendingPrependAdjustmentRef.current = null;
      }
    }
    setLoadingOlder(false);
  }, [currentUserId, hasMore, isAdminChat, loadingOlder, messages, otherUser.id, refetchReactions, supabase, t]);

  const handleScroll = useCallback(() => {
    const element = scrollAreaRef.current;
    if (!element) return;

    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const nextElement = scrollAreaRef.current;
      if (!nextElement) return;

      const distanceFromBottom = nextElement.scrollHeight - nextElement.scrollTop - nextElement.clientHeight;
      isNearBottomRef.current = distanceFromBottom < SCROLL_EDGE_PX;
      if (isNearBottomRef.current) {
        setNewMessagesBelow(false);
      }
      setScrollFrame({ top: nextElement.scrollTop, height: nextElement.clientHeight });

      if (nextElement.scrollTop < SCROLL_EDGE_PX) {
        void loadOlderMessages();
      }
    });
  }, [loadOlderMessages]);

  const appendServerMessage = useCallback(
    (row: DirectMessage) => {
      if (
        row.is_admin_chat !== isAdminChat ||
        !(
          (row.sender_id === currentUserId && row.recipient_id === otherUser.id) ||
          (row.sender_id === otherUser.id && row.recipient_id === currentUserId)
        )
      ) {
        return;
      }

      if (row.sender_id === currentUserId || isNearBottomRef.current) {
        pendingAutoScrollRef.current = "smooth";
      } else {
        setNewMessagesBelow(true);
      }

      setMessages((prev) => replaceOptimisticWithServer(prev, row));
    },
    [currentUserId, isAdminChat, otherUser.id, replaceOptimisticWithServer]
  );

  const updateServerMessage = useCallback(
    (row: DirectMessage) => {
      if (
        row.is_admin_chat !== isAdminChat ||
        !(
          (row.sender_id === currentUserId && row.recipient_id === otherUser.id) ||
          (row.sender_id === otherUser.id && row.recipient_id === currentUserId)
        )
      ) {
        return;
      }

      setMessages((prev) => prev.map((message) => (message.id === row.id ? row : message)));
    },
    [currentUserId, isAdminChat, otherUser.id]
  );

  const sendTypingState = useCallback(
    (typing: boolean) => {
      channelRef.current
        ?.send({
          type: "broadcast",
          event: "typing",
          payload: { userId: currentUserId, typing },
        })
        .catch(() => {});
    },
    [currentUserId]
  );

  useEffect(() => {
    setPickerMounted(true);
    return () => setPickerMounted(false);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      if (typingResetTimeoutRef.current) clearTimeout(typingResetTimeoutRef.current);
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    const element = scrollAreaRef.current;
    if (!element) return;
    setScrollFrame({ top: element.scrollTop, height: element.clientHeight });
    scrollToBottom("auto");
  }, [scrollToBottom]);

  useLayoutEffect(() => {
    const element = scrollAreaRef.current;
    if (!element) return;

    if (pendingPrependAdjustmentRef.current) {
      const previous = pendingPrependAdjustmentRef.current;
      pendingPrependAdjustmentRef.current = null;
      requestAnimationFrame(() => {
        const current = scrollAreaRef.current;
        if (!current) return;
        current.scrollTop = current.scrollHeight - previous.scrollHeight + previous.scrollTop;
        setScrollFrame({ top: current.scrollTop, height: current.clientHeight });
      });
      return;
    }

    if (pendingAutoScrollRef.current) {
      const behavior = pendingAutoScrollRef.current;
      pendingAutoScrollRef.current = null;
      scrollToBottom(behavior);
    }
  }, [rows.length, virtualLayout.totalHeight, scrollToBottom]);

  useEffect(() => {
    const element = scrollAreaRef.current;
    if (!element) return;

    const update = () => setScrollFrame({ top: element.scrollTop, height: element.clientHeight });
    update();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    refetchReactions();
  }, [refetchReactions]);

  useEffect(() => {
    const ids = new Set(messages.map((message) => message.id));
    messageIdSetRef.current = ids;
    setReactions((prev) => pruneReactions(prev, ids));
  }, [messages]);

  useEffect(() => {
    const queued = readPendingMessages();
    if (queued.length === 0) return;

    setMessages((prev) => {
      const existing = new Set(prev.map((message) => message.id));
      const queuedMessages = queued
        .filter((pending) => !existing.has(pending.localId))
        .map((pending) => pendingToMessage(pending, "offline"));
      return [...prev, ...queuedMessages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, [pendingToMessage, readPendingMessages]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void flushPendingMessages();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus("disconnected");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushPendingMessages]);

  useEffect(() => {
    if (isOnline) {
      void flushPendingMessages();
    }
  }, [flushPendingMessages, isOnline]);

  useEffect(() => {
    const channel = supabase.channel(`dm-${[currentUserId, otherUser.id].sort().join("-")}`, {
      config: {
        broadcast: { self: false },
      },
    });

    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${currentUserId}` },
        (payload) => appendServerMessage(payload.new as DirectMessage)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `sender_id=eq.${currentUserId}` },
        (payload) => appendServerMessage(payload.new as DirectMessage)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${currentUserId}` },
        (payload) => updateServerMessage(payload.new as DirectMessage)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages", filter: `sender_id=eq.${currentUserId}` },
        (payload) => updateServerMessage(payload.new as DirectMessage)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions", filter: "message_type=eq.dm" },
        (payload) => {
          const row = payload.new as MessageReactionRow;
          if (!messageIdSetRef.current.has(row.message_id)) return;
          setReactions((prev) => addReaction(prev, row));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions", filter: "message_type=eq.dm" },
        (payload) => {
          const row = payload.old as Partial<MessageReactionRow>;
          if (!row.message_id || !row.user_id || !row.emoji) {
            refetchReactions();
            return;
          }
          if (!messageIdSetRef.current.has(row.message_id)) return;
          setReactions((prev) => removeReaction(prev, row as MessageReactionRow));
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const typingPayload = payload as { userId?: string; typing?: boolean };
        if (typingPayload.userId !== otherUser.id) return;

        setIsOtherTyping(!!typingPayload.typing);
        if (typingResetTimeoutRef.current) clearTimeout(typingResetTimeoutRef.current);
        if (typingPayload.typing) {
          typingResetTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 2500);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnectionStatus("disconnected");
        } else {
          setConnectionStatus("connecting");
        }
      });

    return () => {
      sendTypingState(false);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [
    appendServerMessage,
    currentUserId,
    otherUser.id,
    refetchReactions,
    sendTypingState,
    supabase,
    updateServerMessage,
  ]);

  useEffect(() => {
    const unreadIds = messages
      .filter(
        (message) =>
          !isLocalMessageId(message.id) &&
          message.sender_id === otherUser.id &&
          message.recipient_id === currentUserId &&
          !message.read_at
      )
      .map((message) => message.id);

    if (unreadIds.length === 0) return;
    const readAt = new Date().toISOString();

    setMessages((prev) =>
      prev.map((message) => (unreadIds.includes(message.id) ? { ...message, read_at: readAt } : message))
    );

    supabase.from("direct_messages").update({ read_at: readAt }).in("id", unreadIds).then(() => {});
  }, [currentUserId, messages, otherUser.id, supabase]);

  const handleOpenFullPicker = useCallback((messageId: string, buttonRect: DOMRect) => {
    let pickerLeft = buttonRect.left - 320 + buttonRect.width;
    if (pickerLeft < 10) pickerLeft = 10;

    let pickerTop = buttonRect.top - 360 - 5;
    if (buttonRect.top - 360 - 5 < 10) {
      pickerTop = buttonRect.top + buttonRect.height + 5;
    }

    setActivePicker({ messageId, x: pickerLeft, y: pickerTop });
  }, []);

  function formatReplyContent(message: Pick<DirectMessage, "content" | "media_url" | "media_type">) {
    if (!message.media_url) return message.content;
    const mediaLabel = message.media_type === "video" ? `[${t("chat.mediaVideo")}]` : `[${t("chat.mediaImage")}]`;
    return message.content ? `${mediaLabel}: ${message.content}` : mediaLabel;
  }

  async function send(
    rawContent: string,
    mediaUrl?: string | null,
    mediaType?: "image" | "video" | null,
    mediaThumbnailUrl?: string | null
  ) {
    const content = sanitizeChatContent(rawContent);
    if (!content && !mediaUrl) return;
    if (blocked) return;
    if (chatRestricted) {
      showError(t("chat.mutedCannotSend"));
      return;
    }

    const pending: PendingDirectMessage = {
      localId: createLocalId(),
      content,
      replyToId: replyingTo?.id || null,
      mediaUrl: mediaUrl || null,
      mediaThumbnailUrl: mediaThumbnailUrl || null,
      mediaType: mediaType || null,
      createdAt: new Date().toISOString(),
      formattingSettings: composerFormattingSettings,
    };

    setReplyingTo(null);
    pendingAutoScrollRef.current = "smooth";
    setMessages((prev) => [...prev, pendingToMessage(pending, isOnline ? "sending" : "offline")]);

    if (!isOnline) {
      enqueuePendingMessage(pending);
      showError(t("chat.offlineQueued"));
      return;
    }

    await persistPendingMessage(pending);
  }

  const retryPendingMessage = useCallback(
    (messageId: string) => {
      const message = messages.find((item) => item.id === messageId);
      if (!message || !isLocalMessageId(message.id)) return;

      const pending: PendingDirectMessage = {
        localId: message.id,
        content: message.content,
        replyToId: message.reply_to_id,
        mediaUrl: message.media_url,
        mediaThumbnailUrl: message.media_thumbnail_url,
        mediaType: message.media_type,
        createdAt: message.created_at,
        formattingSettings: resolveChatMarkdownSettings(message.formatting_settings),
      };

      setMessages((prev) =>
        prev.map((item) => (item.id === messageId ? { ...item, local_status: isOnline ? "sending" : "offline" } : item))
      );

      if (!isOnline) {
        enqueuePendingMessage(pending);
        return;
      }

      void persistPendingMessage(pending);
    },
    [enqueuePendingMessage, isOnline, messages, persistPendingMessage]
  );

  const handleReply = useCallback(
    (messageId: string) => {
      const msg = messageById.get(messageId);
      if (!msg) return;
      const senderName = msg.sender_id === currentUserId ? t("common.you") : otherUser.display_name;
      setReplyingTo({ id: msg.id, content: formatReplyContent(msg), senderName });
    },
    [currentUserId, messageById, otherUser.display_name, t]
  );

  const handleStartEdit = useCallback((messageId: string, content: string) => {
    if (isLocalMessageId(messageId)) return;
    setEditingMessage({ id: messageId, content });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const handleSaveEdit = useCallback(
    async (rawContent: string) => {
      const content = sanitizeChatContent(rawContent);
      if (!editingMessage || !content) return;
      const msgId = editingMessage.id;
      setEditingMessage(null);

      const editedAt = new Date().toISOString();
      const { error: err } = await supabase
        .from("direct_messages")
        .update({
          content,
          edited_at: editedAt,
          formatting_settings: composerFormattingSettings,
        })
        .eq("id", msgId);

      if (err) {
        showError(t("chat.editFailed"));
      } else {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === msgId
              ? { ...message, content, edited_at: editedAt, formatting_settings: composerFormattingSettings }
              : message
          )
        );
      }
    },
    [composerFormattingSettings, editingMessage, supabase, t]
  );

  const handleDelete = useCallback(
    async (messageId: string) => {
      if (isLocalMessageId(messageId)) return;
      if (!window.confirm(t("chat.confirmDelete"))) return;

      const deletedAt = new Date().toISOString();
      const { error: err } = await supabase
        .from("direct_messages")
        .update({
          deleted_at: deletedAt,
        })
        .eq("id", messageId);

      if (err) {
        showError(t("chat.deleteFailed"));
      } else {
        setMessages((prev) =>
          prev.map((message) => (message.id === messageId ? { ...message, deleted_at: deletedAt } : message))
        );
      }
    },
    [supabase, t]
  );

  const handleJumpToMessage = useCallback((messageId: string) => {
    const target = scrollAreaRef.current?.querySelector<HTMLElement>(`[data-chat-message-id="${messageId}"]`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);

    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current));
    }, 1800);
  }, []);

  const handleReact = useCallback(
    async (messageId: string, emoji: string) => {
      if (isLocalMessageId(messageId)) return;
      const { error: err } = await supabase
        .from("message_reactions")
        .insert({
          user_id: currentUserId,
          emoji,
          message_type: "dm",
          message_id: messageId,
        });

      if (err && err.code !== "23505") {
        showError(t("chat.actionFailed"));
      } else {
        setReactions((prev) => addReaction(prev, { message_id: messageId, user_id: currentUserId, emoji }));
      }
    },
    [currentUserId, supabase, t]
  );

  const handleRemoveReact = useCallback(
    async (messageId: string, emoji: string) => {
      if (isLocalMessageId(messageId)) return;
      const { error: err } = await supabase
        .from("message_reactions")
        .delete()
        .eq("user_id", currentUserId)
        .eq("emoji", emoji)
        .eq("message_type", "dm")
        .eq("message_id", messageId);

      if (err) {
        showError(t("chat.actionFailed"));
      } else {
        setReactions((prev) => removeReaction(prev, { message_id: messageId, user_id: currentUserId, emoji }));
      }
    },
    [currentUserId, supabase, t]
  );

  async function toggleBlock() {
    const prevBlocked = blocked;
    try {
      if (blocked) {
        setBlocked(false);
        const { error: err } = await supabase
          .from("blocks")
          .delete()
          .eq("blocker_id", currentUserId)
          .eq("blocked_id", otherUser.id);
        if (err) throw err;
      } else {
        setBlocked(true);
        const { error: err } = await supabase
          .from("blocks")
          .insert({ blocker_id: currentUserId, blocked_id: otherUser.id });
        if (err) throw err;
      }
    } catch {
      setBlocked(prevBlocked);
      showError(t("chat.actionFailed"));
    }
  }

  const getDeliveryStatus = useCallback(
    (message: DirectMessageView): DeliveryStatus | undefined => {
      if (message.sender_id !== currentUserId) return undefined;
      if (message.local_status) return message.local_status;
      return message.read_at ? "read" : "sent";
    },
    [currentUserId]
  );

  const renderMessageRow = useCallback(
    (message: DirectMessageView) => {
      const mine = message.sender_id === currentUserId;
      const msgReactions = reactions[message.id] || [];
      const replyMsg = message.reply_to_id ? messageById.get(message.reply_to_id) : null;
      const replyContent = replyMsg ? formatReplyContent(replyMsg) : "";

      return (
        <ChatMessage
          id={message.id}
          content={message.content}
          senderId={message.sender_id}
          senderName={mine ? undefined : otherUser.display_name}
          senderEmoji={mine ? null : otherUser.avatar_emoji}
          senderAvatarUrl={mine ? null : otherUser.avatar_url}
          currentUserId={currentUserId}
          timestamp={message.created_at}
          editedAt={message.edited_at}
          deletedAt={message.deleted_at}
          replyTo={
            replyMsg
              ? {
                  id: replyMsg.id,
                  content: replyContent,
                  senderName: replyMsg.sender_id === currentUserId ? t("common.you") : otherUser.display_name,
                }
              : null
          }
          reactions={msgReactions}
          profileBasePath={profileBasePath}
          showSender={false}
          showTimestamp={false}
          mediaUrl={message.media_url}
          mediaThumbnailUrl={message.media_thumbnail_url}
          mediaType={message.media_type}
          highlighted={highlightedMessageId === message.id}
          markdownSettings={message.formatting_settings}
          deliveryStatus={getDeliveryStatus(message)}
          onReply={handleReply}
          onEdit={handleStartEdit}
          onDelete={handleDelete}
          onReact={handleReact}
          onRemoveReact={handleRemoveReact}
          onOpenFullPicker={handleOpenFullPicker}
          onJumpToMessage={handleJumpToMessage}
          onRetrySend={retryPendingMessage}
        />
      );
    },
    [
      currentUserId,
      getDeliveryStatus,
      handleDelete,
      handleJumpToMessage,
      handleOpenFullPicker,
      handleReact,
      handleRemoveReact,
      handleReply,
      handleStartEdit,
      highlightedMessageId,
      messageById,
      otherUser.avatar_emoji,
      otherUser.avatar_url,
      otherUser.display_name,
      profileBasePath,
      reactions,
      retryPendingMessage,
      t,
    ]
  );

  const backHref = profileBasePath.startsWith("/admin") ? "/admin/messages" : "/messages";
  const showReconnectBanner = !isOnline || connectionStatus !== "connected";

  const blockButton = (
    <button
      onClick={toggleBlock}
      aria-label={blocked ? t("messages.unblock") : t("messages.block")}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors shrink-0 lg:px-4 lg:py-2 lg:text-sm ${
        blocked
          ? "border-danger/40 text-danger bg-danger/10 hover:bg-danger/15"
          : "border-ink-border text-ink-muted hover:text-danger hover:border-danger/40"
      }`}
    >
      {blocked ? t("messages.unblock") : t("messages.block")}
    </button>
  );

  const messageList = (
    <>
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto overflow-x-hidden p-3 pb-6 sm:p-4 sm:pb-10 lg:p-6 lg:pb-12"
        role="log"
        aria-live="polite"
      >
        <div style={{ height: virtualLayout.topPadding }} />

        {loadingOlder && (
          <p className="py-2 text-center text-xs text-ink-muted lg:text-sm">{t("chat.loadingOlder")}</p>
        )}
        {!hasMore && messages.length > PAGE_SIZE && (
          <p className="py-2 text-center text-xs text-ink-muted lg:text-sm">{t("chat.noMoreMessages")}</p>
        )}
        {messages.length === 0 && (
          <p className="text-sm text-ink-muted text-center mt-8 lg:text-base">{t("messages.noDirectMessages")}</p>
        )}

        <div className="space-y-3 lg:space-y-4">
          {virtualLayout.visible.map(({ row }) => (
            <MeasuredRow key={row.key} rowKey={row.key} onMeasure={handleMeasureRow}>
              {row.type === "divider" ? <ChatTimeDivider timestamp={row.timestamp} /> : renderMessageRow(row.message)}
            </MeasuredRow>
          ))}
        </div>

        <div style={{ height: virtualLayout.bottomPadding }} />

        {newMessagesBelow && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="sticky bottom-3 left-1/2 z-20 mx-auto flex -translate-x-0 items-center rounded-full border border-command/40 bg-command px-3 py-1.5 text-xs font-medium text-white shadow-crest lg:text-sm"
          >
            {t("chat.newMessagesBelow")}
          </button>
        )}
      </div>

      {showReconnectBanner && (
        <div className="px-3 pb-1">
          <p className="text-xs text-ink-muted bg-ink-surface2 border border-ink-border rounded-lg px-3 py-1.5 lg:text-sm">
            {t("chat.reconnecting")}
          </p>
        </div>
      )}

      {isOtherTyping && (
        <div className="px-3 pb-1">
          <p className="text-xs text-ink-muted lg:text-sm">
            {t("chat.typing", { name: otherUser.display_name })}
          </p>
        </div>
      )}

      {error && (
        <div className="px-3 pb-1">
          <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-1.5 lg:text-sm">{error}</p>
        </div>
      )}

      <MuteBanner muteStatus={muteStatus} />

      <ChatInput
        onSend={send}
        onTypingChange={sendTypingState}
        disabled={blocked || chatRestricted}
        placeholder={
          blocked
            ? t("messages.blockedPlaceholder")
            : chatRestricted
            ? t("chat.mutedCannotSend")
            : t("messages.placeholder")
        }
        sendLabel={t("common.send")}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
      />

      {pickerMounted &&
        activePicker &&
        createPortal(
          <div className="fixed z-[9999]" style={{ top: activePicker.y, left: activePicker.x }}>
            <EmojiPicker
              positionClass="relative"
              onSelect={(emoji) => {
                handleReact(activePicker.messageId, emoji);
                setActivePicker(null);
              }}
              onClose={() => setActivePicker(null)}
            />
          </div>,
          document.body
        )}
    </>
  );

  if (isMobile) {
    return (
      <MobileChatShell
        title={otherUser.display_name}
        titleContent={
          <Link
            href={`${profileBasePath}/${otherUser.id}`}
            className="flex min-w-0 items-center gap-2 rounded-lg pr-1 text-ink-text hover:text-command"
            aria-label={t("member.viewProfile")}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-border bg-ink-surface2 text-lg">
              {otherUser.avatar_url ? (
                <img src={otherUser.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                otherUser.avatar_emoji ?? "\u{1F642}"
              )}
            </span>
            <span className="block min-w-0 flex-1 truncate text-sm font-semibold leading-tight">
              {otherUser.display_name}
            </span>
          </Link>
        }
        backHref={backHref}
        drawer={
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-ink-surface2 border border-ink-border flex items-center justify-center text-2xl overflow-hidden shrink-0">
                {otherUser.avatar_url ? (
                  <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  otherUser.avatar_emoji ?? "\u{1F642}"
                )}
              </span>
              <p className="font-semibold truncate">{otherUser.display_name}</p>
            </div>
            <Link
              href={`${profileBasePath}/${otherUser.id}`}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm bg-ink-surface2 hover:bg-ink-border transition-colors"
            >
              <span className="w-4 text-center">{"\u{1F464}"}</span>
              {t("member.viewProfile")}
            </Link>
            <div>{blockButton}</div>
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-ink-surface">{messageList}</div>
      </MobileChatShell>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-ink-surface">
      <div className="flex items-center justify-between gap-3 border-b border-ink-border bg-ink-surface px-3 py-3 sm:p-4 lg:gap-4 lg:px-6 lg:py-4">
        <div className="flex items-center gap-3 min-w-0 lg:gap-4">
          <Link
            href={backHref}
            className="text-ink-muted hover:text-ink-text text-lg pr-1 lg:pr-2 lg:text-2xl"
            title={t("common.back")}
          >
            &larr;
          </Link>
          <Link
            href={`${profileBasePath}/${otherUser.id}`}
            className="flex min-w-0 items-center gap-2 rounded-lg pr-2 hover:text-command transition-colors lg:gap-3"
            aria-label={t("member.viewProfile")}
          >
            <span className="w-7 h-7 rounded-full bg-ink-surface2 border border-ink-border flex items-center justify-center text-lg overflow-hidden shrink-0 lg:h-11 lg:w-11 lg:text-2xl">
              {otherUser.avatar_url ? (
                <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                otherUser.avatar_emoji ?? "\u{1F642}"
              )}
            </span>
            <span className="font-semibold truncate lg:text-xl">{otherUser.display_name}</span>
          </Link>
        </div>
        {blockButton}
      </div>

      {messageList}
    </div>
  );
}
