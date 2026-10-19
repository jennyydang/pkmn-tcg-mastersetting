-- Want list and per-copy details (quantity, condition, grade, price paid).
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- card_id uses the same keys as owned_cards ("sv03.5-025", or "sv03.5-025|reverse"
-- for a specific version; see lib/variants.ts). Rows go away with the account
-- (ON DELETE CASCADE), so account deletion needs no changes.

CREATE TABLE IF NOT EXISTS public.want_list (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id text NOT NULL CHECK (char_length(card_id) <= 100),
  -- Flag the card once its market price is at or below this. NULL = no target.
  target_price numeric(10, 2) CHECK (target_price IS NULL OR target_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);

CREATE TABLE IF NOT EXISTS public.card_details (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id text NOT NULL CHECK (char_length(card_id) <= 100),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 9999),
  condition text CHECK (condition IN ('NM', 'LP', 'MP', 'HP', 'DMG')),
  grade_company text CHECK (grade_company IN ('PSA', 'BGS', 'CGC', 'TAG', 'Other')),
  grade text CHECK (grade IS NULL OR char_length(grade) <= 10),
  -- Price paid per copy.
  purchase_price numeric(10, 2) CHECK (purchase_price IS NULL OR purchase_price >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);

ALTER TABLE public.want_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_details ENABLE ROW LEVEL SECURITY;

-- Each user can only see and change their own rows.
DROP POLICY IF EXISTS "want_list_own" ON public.want_list;
DROP POLICY IF EXISTS "card_details_own" ON public.card_details;
CREATE POLICY "want_list_own" ON public.want_list
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "card_details_own" ON public.card_details
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
