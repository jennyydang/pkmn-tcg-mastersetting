-- Table behind the My Collection page (lib/store.tsx: collection_cards).
-- Run in the Supabase SQL Editor. Safe to re-run: it only adds what's missing.

CREATE TABLE IF NOT EXISTS public.collection_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The app upserts with onConflict "user_id,card_id", which needs this constraint.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collection_cards_user_card') THEN
    ALTER TABLE public.collection_cards ADD CONSTRAINT collection_cards_user_card UNIQUE (user_id, card_id);
  END IF;
END $$;

-- Each user can only see and change their own rows.
ALTER TABLE public.collection_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collection_cards_select_own" ON public.collection_cards;
DROP POLICY IF EXISTS "collection_cards_insert_own" ON public.collection_cards;
DROP POLICY IF EXISTS "collection_cards_update_own" ON public.collection_cards;
DROP POLICY IF EXISTS "collection_cards_delete_own" ON public.collection_cards;

CREATE POLICY "collection_cards_select_own" ON public.collection_cards
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "collection_cards_insert_own" ON public.collection_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collection_cards_update_own" ON public.collection_cards
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collection_cards_delete_own" ON public.collection_cards
  FOR DELETE USING (auth.uid() = user_id);
