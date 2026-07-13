-- Safe performance patch for larger chat/message traffic.
-- Run this once in the Supabase SQL editor; every statement is idempotent.

create index if not exists idx_direct_messages_sender_recent
  on direct_messages(is_admin_chat, sender_id, created_at desc);

create index if not exists idx_direct_messages_recipient_recent
  on direct_messages(is_admin_chat, recipient_id, created_at desc);

create index if not exists idx_direct_messages_pair_recent
  on direct_messages(is_admin_chat, sender_id, recipient_id, created_at desc);

create index if not exists idx_direct_messages_recipient_pair_recent
  on direct_messages(is_admin_chat, recipient_id, sender_id, created_at desc);

create index if not exists idx_admin_messages_recent
  on admin_messages(created_at desc);

create index if not exists idx_profiles_display_name
  on profiles(display_name);

create index if not exists idx_ip_bans_active_ip
  on ip_bans(ip_address)
  where lifted_at is null;

-- DELETE realtime payloads otherwise may only include the primary key, which
-- forces every open chat client to refetch reactions after a reaction removal.
alter table message_reactions replica identity full;
