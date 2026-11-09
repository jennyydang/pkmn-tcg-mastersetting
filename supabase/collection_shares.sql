-- Share your collection with friends: a link (/shared?c=<token>) that shows your
-- master sets, which cards you have and which you're missing. The link is live,
-- so friends see changes as you collect. Viewers don't need an account, and they
-- can only read what get_shared_collection returns; nothing else is exposed.
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- Rows go away with the account (ON DELETE CASCADE), so delete_my_account and
-- admin_delete_user need no changes.

CREATE TABLE IF NOT EXISTS public.collection_shares (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Hard to guess: 32 random hex characters. A new link means a new token.
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '')
    CHECK (char_length(token) BETWEEN 16 AND 64),
  -- Shown to friends as "<name>'s collection". NULL = just "A collection".
  display_name text CHECK (display_name IS NULL OR char_length(display_name) <= 40),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Owners manage their own link. Viewers never read this table directly.
ALTER TABLE public.collection_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "collection_shares_own" ON public.collection_shares;
CREATE POLICY "collection_shares_own" ON public.collection_shares
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- What a friend sees for a share token: the owner's display name and their
-- tracked master sets, each with its owned cards (and card list, for custom
-- sets). NULL when the token doesn't exist (never shared, or sharing stopped).
CREATE OR REPLACE FUNCTION public.get_shared_collection(share_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share public.collection_shares%ROWTYPE;
BEGIN
  SELECT * INTO share FROM public.collection_shares WHERE token = share_token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'name', share.display_name,
    'sets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',          t.item_id,
        'type',        t.type,
        'label',       t.label,
        'image',       t.image,
        'total_cards', t.total_cards,
        'subtitle',    t.subtitle,
        -- Read through to_jsonb so this works before supabase/set_status.sql is run.
        'status',      to_jsonb(t) -> 'status',
        'owned', COALESCE((
          SELECT jsonb_agg(o.card_id)
          FROM public.owned_cards o
          WHERE o.user_id = share.user_id AND o.item_id = t.item_id
        ), '[]'::jsonb),
        'custom_cards', CASE WHEN t.type = 'custom' THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', c.card_id, 'name', c.card_name, 'image', c.card_image_small, 'set_name', c.card_set_name
          ))
          FROM public.custom_set_cards c
          WHERE c.user_id = share.user_id AND c.item_id = t.item_id
        ), '[]'::jsonb) END
      ) ORDER BY t.sort_order)
      FROM public.tracked_master_sets t
      WHERE t.user_id = share.user_id
    ), '[]'::jsonb)
  );
END;
$$;

-- Anyone with the link may call it, signed in or not.
REVOKE ALL ON FUNCTION public.get_shared_collection(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_collection(text) TO anon, authenticated;
