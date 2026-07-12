-- Chat message formatting preferences.
-- Run this once in Supabase SQL Editor if your project already exists.

alter table profiles
  add column if not exists chat_markdown_settings jsonb not null default '{}'::jsonb;

alter table direct_messages
  add column if not exists formatting_settings jsonb not null default '{}'::jsonb;

alter table house_messages
  add column if not exists formatting_settings jsonb not null default '{}'::jsonb;

alter table admin_messages
  add column if not exists formatting_settings jsonb not null default '{}'::jsonb;
