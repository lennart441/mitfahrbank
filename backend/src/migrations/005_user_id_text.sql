-- Authentik (and other IdPs) may use non-UUID subject identifiers.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS child_table, c.conname
    FROM pg_constraint c
    WHERE c.confrelid = 'public.users'::regclass
      AND c.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.child_table, r.conname);
  END LOOP;
END $$;

ALTER TABLE users ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE ride_requests ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE ride_requests ALTER COLUMN driver_id TYPE TEXT USING driver_id::text;
ALTER TABLE shopping_requests ALTER COLUMN creator_id TYPE TEXT USING creator_id::text;
ALTER TABLE shopping_requests ALTER COLUMN helper_id TYPE TEXT USING helper_id::text;
ALTER TABLE chat_messages ALTER COLUMN sender_id TYPE TEXT USING sender_id::text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'push_subscriptions'
  ) THEN
    ALTER TABLE push_subscriptions
      ALTER COLUMN user_id TYPE TEXT USING user_id::text;
  END IF;
END $$;

ALTER TABLE ride_requests
  ADD CONSTRAINT ride_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ride_requests
  ADD CONSTRAINT ride_requests_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES users(id);

ALTER TABLE shopping_requests
  ADD CONSTRAINT shopping_requests_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE shopping_requests
  ADD CONSTRAINT shopping_requests_helper_id_fkey
  FOREIGN KEY (helper_id) REFERENCES users(id);

ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'push_subscriptions'
  ) THEN
    ALTER TABLE push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
