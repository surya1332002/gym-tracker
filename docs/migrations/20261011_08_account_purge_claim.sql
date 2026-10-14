-- Prepared only. Deploy/schedule the protected worker before enabling account deletion UI.
-- Expired account claims serialize with recovery; no existing account data is changed.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.account_deletion_requests ADD COLUMN IF NOT EXISTS purge_claim_id uuid;
ALTER TABLE public.account_deletion_requests ADD COLUMN IF NOT EXISTS purge_claimed_at timestamptz;

CREATE OR REPLACE FUNCTION public.arc_fit_claim_account_purge(p_user_id uuid,p_claim_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.account_deletion_requests;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Scheduled backend required' USING ERRCODE='42501'; END IF;
 IF p_user_id IS NULL OR p_claim_id IS NULL THEN RAISE EXCEPTION 'Account and claim identities required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 SELECT * INTO r FROM public.account_deletion_requests WHERE user_id=p_user_id FOR UPDATE;
 IF r.user_id IS NULL OR r.purge_after>now() THEN RETURN NULL; END IF;
 IF r.purge_claim_id IS NOT NULL AND r.purge_claim_id<>p_claim_id AND r.purge_claimed_at>now()-interval '15 minutes' THEN RETURN NULL; END IF;
 UPDATE public.account_deletion_requests SET purge_claim_id=p_claim_id,purge_claimed_at=now() WHERE user_id=p_user_id RETURNING * INTO r;
 RETURN to_jsonb(r);
END $$;
CREATE OR REPLACE FUNCTION public.arc_fit_verify_account_purge_claim(p_user_id uuid,p_claim_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.account_deletion_requests;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Scheduled backend required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 SELECT * INTO r FROM public.account_deletion_requests WHERE user_id=p_user_id FOR UPDATE;
 IF r.user_id IS NULL OR r.purge_after>now() OR r.purge_claim_id IS DISTINCT FROM p_claim_id OR r.purge_claimed_at IS NULL OR r.purge_claimed_at<=now()-interval '15 minutes' THEN RETURN false; END IF;
 UPDATE public.account_deletion_requests SET purge_claimed_at=now() WHERE user_id=p_user_id;
 RETURN true;
END $$;
-- Runtime preflight proves a cascading owner-column FK path to auth.users for every
-- app-owned dataset. Missing legacy schema evidence fails closed, not by deleting rows.
CREATE OR REPLACE FUNCTION public.arc_fit_account_purge_prerequisites()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Scheduled backend required' USING ERRCODE='42501'; END IF;
 RETURN (
  WITH RECURSIVE owner_cascade(relation_id,owner_attribute) AS (
   SELECT 'auth.users'::regclass::oid,a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid='auth.users'::regclass AND a.attname='id'
   UNION
   SELECT c.conrelid,c.conkey[s.ordinal]
   FROM pg_catalog.pg_constraint c JOIN owner_cascade p ON c.confrelid=p.relation_id
   CROSS JOIN LATERAL generate_subscripts(c.confkey,1) s(ordinal)
   WHERE c.contype='f' AND c.confdeltype='c' AND c.confkey[s.ordinal]=p.owner_attribute
  ), expected(table_name,owner_name) AS (
   VALUES ('profiles','id'),('exercises','user_id'),('machine_presets','user_id'),('workout_programmes','user_id'),('routine_days','user_id'),('routine_exercises','user_id'),('workouts','user_id'),('workout_exercises','user_id'),('workout_sets','user_id'),('cardio_sessions','user_id'),('body_measurements','user_id'),('exercise_performance_references','user_id'),('measurement_fields','user_id'),('progress_checkins','user_id'),('progress_photos','user_id'),('workout_sync_operations','user_id'),('weekly_training_targets','user_id'),('device_vault_keys','user_id'),('account_deletion_requests','user_id'),('exercise_media','user_id')
  )
  SELECT bool_and(EXISTS(SELECT 1 FROM owner_cascade p JOIN pg_catalog.pg_attribute a ON a.attrelid=p.relation_id AND a.attnum=p.owner_attribute WHERE p.relation_id=to_regclass('public.'||e.table_name) AND a.attname=e.owner_name)) FROM expected e
 );
END $$;
-- A deleted user's still-unexpired JWT must not create orphaned originals. The
-- active-user/claim predicate reveals only the caller's own eligibility.
CREATE OR REPLACE FUNCTION public.arc_fit_private_media_write_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid())
 AND NOT EXISTS(SELECT 1 FROM public.account_deletion_requests WHERE user_id=auth.uid() AND purge_claim_id IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.arc_fit_private_media_write_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.arc_fit_private_media_write_allowed() TO authenticated;
DROP POLICY IF EXISTS arc_fit_purge_blocks_private_insert ON storage.objects;
CREATE POLICY arc_fit_purge_blocks_private_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'arc-fit-private' OR public.arc_fit_private_media_write_allowed());
DROP POLICY IF EXISTS arc_fit_purge_blocks_private_update ON storage.objects;
CREATE POLICY arc_fit_purge_blocks_private_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'arc-fit-private' OR public.arc_fit_private_media_write_allowed()) WITH CHECK(bucket_id<>'arc-fit-private' OR public.arc_fit_private_media_write_allowed());

CREATE OR REPLACE FUNCTION public.arc_fit_account_recovery(p_action text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r public.account_deletion_requests;
BEGIN
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u) THEN RAISE EXCEPTION 'Active authentication required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 SELECT * INTO r FROM public.account_deletion_requests WHERE user_id=u FOR UPDATE;
 IF p_action='request' THEN
  INSERT INTO public.account_deletion_requests(user_id) VALUES(u) ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO r FROM public.account_deletion_requests WHERE user_id=u;
  RETURN to_jsonb(r);
 ELSIF p_action='recover' THEN
  IF r.user_id IS NULL THEN RETURN jsonb_build_object('recovered',true); END IF;
  IF r.purge_after<=now() OR r.purge_claim_id IS NOT NULL THEN RAISE EXCEPTION 'Recovery deadline passed or permanent deletion started'; END IF;
  DELETE FROM public.account_deletion_requests WHERE user_id=u;
  RETURN jsonb_build_object('recovered',true);
 END IF;
 RAISE EXCEPTION 'Invalid account action';
END $$;
-- Purge expired trash and its frozen replay payloads in the same row-locked
-- transaction. A concurrent valid restore cannot lose its receipt metadata.
CREATE OR REPLACE FUNCTION public.arc_fit_purge_expired_workout_trash() RETURNS bigint
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; n bigint:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Scheduled backend required' USING ERRCODE='42501'; END IF;
 FOR r IN SELECT id,user_id FROM public.workouts WHERE deleted_at<now()-interval '30 days' FOR UPDATE SKIP LOCKED LOOP
  DELETE FROM public.workout_sync_operations WHERE workout_id=r.id AND user_id=r.user_id;
  DELETE FROM public.workouts WHERE id=r.id AND user_id=r.user_id;
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.arc_fit_purge_expired_workout_trash() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arc_fit_purge_expired_workout_trash() TO service_role;
REVOKE ALL ON FUNCTION public.arc_fit_claim_account_purge(uuid,uuid),public.arc_fit_verify_account_purge_claim(uuid,uuid),public.arc_fit_account_purge_prerequisites() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arc_fit_claim_account_purge(uuid,uuid),public.arc_fit_verify_account_purge_claim(uuid,uuid),public.arc_fit_account_purge_prerequisites() TO service_role;
REVOKE ALL ON FUNCTION public.arc_fit_account_recovery(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.arc_fit_account_recovery(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
