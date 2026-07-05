-- =========================================================
-- CHAT FEATURES: Edit, Delete, Reply, Reactions
-- Run in Supabase Dashboard > SQL Editor
-- =========================================================

-- Add edit/delete/reply columns to direct_messages
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES direct_messages(id) ON DELETE SET NULL;

-- Add edit/delete/reply columns to house_messages
ALTER TABLE house_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE house_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE house_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES house_messages(id) ON DELETE SET NULL;

-- Add edit/delete/reply columns to admin_messages
ALTER TABLE admin_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE admin_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE admin_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES admin_messages(id) ON DELETE SET NULL;

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  emoji text NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('dm', 'house', 'admin')),
  message_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, emoji, message_type, message_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_type, message_id);

-- Enable RLS on message_reactions
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Reactions policies
DROP POLICY IF EXISTS "reactions_select" ON message_reactions;
CREATE POLICY "reactions_select" ON message_reactions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reactions_insert" ON message_reactions;
CREATE POLICY "reactions_insert" ON message_reactions FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reactions_delete_own" ON message_reactions;
CREATE POLICY "reactions_delete_own" ON message_reactions FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- Update policies for direct_messages: allow sender to update content/edited_at and soft-delete
DROP POLICY IF EXISTS "dm_update_sender" ON direct_messages;
CREATE POLICY "dm_update_sender" ON direct_messages FOR UPDATE
  TO authenticated USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Update policies for house_messages: allow sender to update/delete own messages
DROP POLICY IF EXISTS "house_msg_update_sender" ON house_messages;
CREATE POLICY "house_msg_update_sender" ON house_messages FOR UPDATE
  TO authenticated USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Update policies for admin_messages: allow sender to update/delete own messages
DROP POLICY IF EXISTS "admin_msg_update_sender" ON admin_messages;
CREATE POLICY "admin_msg_update_sender" ON admin_messages FOR UPDATE
  TO authenticated USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Enable realtime for reactions
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
