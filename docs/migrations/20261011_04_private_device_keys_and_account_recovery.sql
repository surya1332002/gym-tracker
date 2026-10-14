-- Account-isolated device keys and reversible deletion requests. No existing data changes.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS last_machine_preset_id uuid;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS is_incomplete boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_photo_path text;
CREATE TABLE IF NOT EXISTS public.device_vault_keys (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 device_id uuid NOT NULL,
 key_material text NOT NULL CHECK (length(key_material)=44 AND octet_length(decode(key_material,'base64'))=32),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,device_id)
);
ALTER TABLE public.device_vault_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_vault_keys FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.device_vault_keys TO authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='device_vault_keys' AND policyname='owner_read') THEN
 CREATE POLICY owner_read ON public.device_vault_keys FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
 CREATE POLICY owner_insert ON public.device_vault_keys FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()));
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 requested_at timestamptz NOT NULL DEFAULT now(),
 purge_after timestamptz NOT NULL DEFAULT now()+interval '30 days',
 CHECK(purge_after>=requested_at+interval '30 days')
);
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.account_deletion_requests TO authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='account_deletion_requests' AND policyname='owner_read') THEN
 CREATE POLICY owner_read ON public.account_deletion_requests FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.arc_fit_account_recovery(p_action text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r public.account_deletion_requests;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 SELECT * INTO r FROM public.account_deletion_requests WHERE user_id=u FOR UPDATE;
 IF p_action='request' THEN
  INSERT INTO public.account_deletion_requests(user_id) VALUES(u) ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO r FROM public.account_deletion_requests WHERE user_id=u;
  RETURN to_jsonb(r);
 ELSIF p_action='recover' THEN
  IF r.user_id IS NULL THEN RETURN jsonb_build_object('recovered',true); END IF;
  IF r.purge_after<=now() THEN RAISE EXCEPTION 'Recovery deadline passed'; END IF;
  DELETE FROM public.account_deletion_requests WHERE user_id=u;
  RETURN jsonb_build_object('recovered',true);
 END IF;
 RAISE EXCEPTION 'Invalid account action';
END $$;
REVOKE ALL ON FUNCTION public.arc_fit_account_recovery(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.arc_fit_account_recovery(text) TO authenticated;
-- Only a deployed trusted backend may inspect due deletion jobs or purge workout trash.
GRANT SELECT ON public.account_deletion_requests TO service_role;
CREATE OR REPLACE FUNCTION public.arc_fit_purge_expired_workout_trash() RETURNS bigint
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n bigint;
BEGIN
 DELETE FROM public.workouts WHERE deleted_at<now()-interval '30 days';
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.arc_fit_purge_expired_workout_trash() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arc_fit_purge_expired_workout_trash() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
