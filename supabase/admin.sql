-- Anonymous feedback, in-app announcements and the /admin dashboard.
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- Make yourself an admin afterwards (use your sign-in email):
--   INSERT INTO public.admins (user_id)
--   SELECT id FROM auth.users WHERE email = 'you@example.com'
--   ON CONFLICT DO NOTHING;
--
-- All access is enforced here (row-level security and the admin_* functions),
-- not by the /admin page, so non-admins can't read feedback or user data even
-- by calling the API directly.

-- ── Admins ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- No policies: the table is only reachable through the functions below.
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ── Feedback (anonymous: no user ID is stored) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN ('bug', 'idea', 'other')),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 5000),
  -- Only if the sender chose to leave one for a reply.
  contact_email text CHECK (contact_email IS NULL OR char_length(contact_email) <= 320),
  page text CHECK (page IS NULL OR char_length(page) <= 500),
  app_info text CHECK (app_info IS NULL OR char_length(app_info) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wont_fix')),
  admin_note text CHECK (admin_note IS NULL OR char_length(admin_note) <= 5000),
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_status_created ON public.feedback (status, created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_insert_anyone" ON public.feedback;
DROP POLICY IF EXISTS "feedback_select_admin" ON public.feedback;
DROP POLICY IF EXISTS "feedback_update_admin" ON public.feedback;
DROP POLICY IF EXISTS "feedback_delete_admin" ON public.feedback;

-- Anyone, signed in or not, can send feedback, but only as a new, untriaged item.
CREATE POLICY "feedback_insert_anyone" ON public.feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'open' AND admin_note IS NULL AND resolved_at IS NULL);
CREATE POLICY "feedback_select_admin" ON public.feedback
  FOR SELECT USING (public.is_admin());
CREATE POLICY "feedback_update_admin" ON public.feedback
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "feedback_delete_admin" ON public.feedback
  FOR DELETE USING (public.is_admin());

-- ── Announcements (banner shown to everyone) ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 500),
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning')),
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_select_active" ON public.announcements;
DROP POLICY IF EXISTS "announcements_select_admin" ON public.announcements;
DROP POLICY IF EXISTS "announcements_write_admin" ON public.announcements;

CREATE POLICY "announcements_select_active" ON public.announcements
  FOR SELECT USING (active);
CREATE POLICY "announcements_select_admin" ON public.announcements
  FOR SELECT USING (public.is_admin());
CREATE POLICY "announcements_write_admin" ON public.announcements
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── Admin functions ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN json_build_object(
    'users_total',      (SELECT count(*) FROM auth.users),
    'users_new_7d',     (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'users_active_7d',  (SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '7 days'),
    'users_active_30d', (SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '30 days'),
    'tracked_sets',     (SELECT count(*) FROM public.tracked_master_sets),
    'owned_cards',      (SELECT count(*) FROM public.owned_cards),
    'collection_cards', (SELECT count(*) FROM public.collection_cards),
    'feedback_open',    (SELECT count(*) FROM public.feedback WHERE status = 'open'),
    'feedback_in_progress', (SELECT count(*) FROM public.feedback WHERE status = 'in_progress')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users(search text DEFAULT '', lim int DEFAULT 50, off int DEFAULT 0)
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned boolean,
  is_admin boolean,
  tracked_sets bigint,
  owned_cards bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, u.created_at, u.last_sign_in_at,
           COALESCE(u.banned_until > now(), false),
           EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = u.id),
           (SELECT count(*) FROM public.tracked_master_sets t WHERE t.user_id = u.id),
           (SELECT count(*) FROM public.owned_cards o WHERE o.user_id = u.id)
    FROM auth.users u
    WHERE search = '' OR u.email ILIKE '%' || search || '%'
    ORDER BY u.created_at DESC
    LIMIT LEAST(GREATEST(lim, 1), 200) OFFSET GREATEST(off, 0);
END;
$$;

-- Blocks sign-in (and token refresh) until unbanned.
CREATE OR REPLACE FUNCTION public.admin_set_banned(target uuid, banned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF target = auth.uid() THEN RAISE EXCEPTION 'You can''t ban yourself'; END IF;
  UPDATE auth.users SET banned_until = CASE WHEN banned THEN 'infinity'::timestamptz ELSE NULL END WHERE id = target;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_admin(target uuid, make_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF target = auth.uid() AND NOT make_admin THEN RAISE EXCEPTION 'You can''t remove your own admin access'; END IF;
  IF make_admin THEN
    INSERT INTO public.admins (user_id) VALUES (target) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.admins WHERE user_id = target;
  END IF;
END;
$$;

-- Same cleanup as delete_my_account, for another user (e.g. spam or a request by email).
CREATE OR REPLACE FUNCTION public.admin_delete_user(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF target = auth.uid() THEN RAISE EXCEPTION 'Use Account → Delete Account to delete yourself'; END IF;
  DELETE FROM public.owned_cards         WHERE user_id = target;
  DELETE FROM public.custom_set_cards    WHERE user_id = target;
  DELETE FROM public.tracked_master_sets WHERE user_id = target;
  DELETE FROM public.collection_cards    WHERE user_id = target;
  DELETE FROM public.portfolio_snapshots WHERE user_id = target;
  DELETE FROM public.admins              WHERE user_id = target;
  DELETE FROM auth.users                 WHERE id = target;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users(text, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_banned(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_admin(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_banned(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_admin(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
