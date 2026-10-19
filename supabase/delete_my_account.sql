-- Lets a signed-in user permanently delete their own account and data from inside
-- the app (required by App Store Review Guideline 5.1.1(v)). Called from
-- lib/auth.tsx via supabase.rpc("delete_my_account").
-- Run in the Supabase SQL Editor. Safe to re-run.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  DELETE FROM public.owned_cards         WHERE user_id = uid;
  DELETE FROM public.custom_set_cards    WHERE user_id = uid;
  DELETE FROM public.tracked_master_sets WHERE user_id = uid;
  DELETE FROM public.collection_cards    WHERE user_id = uid;
  DELETE FROM public.portfolio_snapshots WHERE user_id = uid;
  DELETE FROM auth.users                 WHERE id = uid;
END;
$$;

-- Only signed-in users may call it, and auth.uid() limits it to their own account.
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
