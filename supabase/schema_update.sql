-- =========================================================
-- SCHEMA UPDATE: Security hardening & performance
-- Run this in Supabase Dashboard > SQL Editor
-- =========================================================

-- Add SET search_path = public to security definer functions
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION my_house_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT house_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION has_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a)
  );
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, display_name, user_type, house_id)
  VALUES (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'player',
    null
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_profile_display_name_cooldown()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.display_name IS DISTINCT FROM old.display_name THEN
    IF old.display_name_changed_at IS NOT NULL
       AND old.display_name_changed_at > now() - interval '30 days' THEN
      RAISE EXCEPTION 'Display name can only be changed once every 30 days.';
    END IF;
    new.display_name_changed_at = now();
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION protect_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = new.id THEN
    IF new.email IS DISTINCT FROM old.email
       OR new.username IS DISTINCT FROM old.username
       OR new.user_type IS DISTINCT FROM old.user_type
       OR new.admin_role IS DISTINCT FROM old.admin_role
       OR new.house_id IS DISTINCT FROM old.house_id THEN
      RAISE EXCEPTION 'Protected profile fields cannot be changed from user settings.';
    END IF;
  END IF;
  RETURN new;
END;
$$;

-- Add index for recipient-based DM queries (unread messages, conversation list)
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages(recipient_id, read_at, created_at);
