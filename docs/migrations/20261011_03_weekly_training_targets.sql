-- Per-week owner targets. Existing completed weeks remain unknown unless recorded;
-- no historical targets, sessions or adherence values are invented.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE IF NOT EXISTS public.weekly_training_targets (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 week_start date NOT NULL CHECK(extract(isodow FROM week_start)=1),
 session_target integer NOT NULL CHECK(session_target BETWEEN 0 AND 14),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,week_start)
);
ALTER TABLE public.weekly_training_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weekly_training_targets FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.weekly_training_targets TO authenticated;
DROP POLICY IF EXISTS weekly_training_targets_owner_read ON public.weekly_training_targets;
CREATE POLICY weekly_training_targets_owner_read ON public.weekly_training_targets FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.arc_fit_set_week_target(p_week_start date,p_session_target integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid:=auth.uid(); zone_name text; local_today date; current_monday date;
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT timezone INTO zone_name FROM public.profiles WHERE id=owner_id;
 IF zone_name IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=zone_name) THEN RAISE EXCEPTION 'Set a valid profile timezone first'; END IF;
 local_today:=(now() AT TIME ZONE zone_name)::date;
 current_monday:=local_today-(extract(isodow FROM local_today)::integer-1);
 IF p_week_start IS NULL OR extract(isodow FROM p_week_start)<>1 OR p_session_target IS NULL OR p_session_target NOT BETWEEN 0 AND 14 THEN RAISE EXCEPTION 'Choose a Monday and a target from 0 to 14'; END IF;
 IF p_week_start<current_monday THEN RAISE EXCEPTION 'Completed historical weeks are locked'; END IF;
 INSERT INTO public.weekly_training_targets(user_id,week_start,session_target) VALUES(owner_id,p_week_start,p_session_target)
 ON CONFLICT(user_id,week_start) DO UPDATE SET session_target=EXCLUDED.session_target,updated_at=now();
 RETURN jsonb_build_object('user_id',owner_id,'week_start',p_week_start,'session_target',p_session_target);
END;
$$;
REVOKE ALL ON FUNCTION public.arc_fit_set_week_target(date,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.arc_fit_set_week_target(date,integer) TO authenticated;
-- Capture the current week's chosen default during an owner preference save.
-- A deliberate override is preserved, and no completed week is backfilled.
CREATE OR REPLACE FUNCTION public.arc_fit_snapshot_profile_week_target()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE local_today date; current_monday date;
BEGIN
 IF NEW.id IS DISTINCT FROM auth.uid() THEN RETURN NEW; END IF;
 IF NEW.weekly_target IS NULL OR NEW.weekly_target NOT BETWEEN 0 AND 14 OR NEW.timezone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=NEW.timezone) THEN RETURN NEW; END IF;
 local_today:=(now() AT TIME ZONE NEW.timezone)::date;
 current_monday:=local_today-(extract(isodow FROM local_today)::integer-1);
 INSERT INTO public.weekly_training_targets(user_id,week_start,session_target) VALUES(NEW.id,current_monday,NEW.weekly_target) ON CONFLICT(user_id,week_start) DO NOTHING;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.arc_fit_snapshot_profile_week_target() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS arc_fit_snapshot_profile_week_target ON public.profiles;
CREATE TRIGGER arc_fit_snapshot_profile_week_target AFTER INSERT OR UPDATE OF weekly_target ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.arc_fit_snapshot_profile_week_target();
-- The first actual completed workout captures its contemporaneous weekly target.
-- Completion corrections/imports for older weeks do not assign invented targets.
CREATE OR REPLACE FUNCTION public.arc_fit_snapshot_workout_week_target()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE zone_name text; normal_target integer; local_today date; current_monday date;
BEGIN
 IF NEW.user_id IS DISTINCT FROM auth.uid() OR NEW.status<>'completed' OR NEW.completed_at IS NULL OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
 SELECT timezone,weekly_target INTO zone_name,normal_target FROM public.profiles WHERE id=NEW.user_id;
 IF normal_target IS NULL OR normal_target NOT BETWEEN 0 AND 14 OR zone_name IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=zone_name) THEN RETURN NEW; END IF;
 local_today:=(now() AT TIME ZONE zone_name)::date;
 current_monday:=local_today-(extract(isodow FROM local_today)::integer-1);
 IF NEW.workout_date<current_monday OR NEW.workout_date>=current_monday+7 THEN RETURN NEW; END IF;
 INSERT INTO public.weekly_training_targets(user_id,week_start,session_target) VALUES(NEW.user_id,current_monday,normal_target) ON CONFLICT(user_id,week_start) DO NOTHING;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.arc_fit_snapshot_workout_week_target() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS arc_fit_snapshot_workout_week_target ON public.workouts;
CREATE TRIGGER arc_fit_snapshot_workout_week_target AFTER INSERT OR UPDATE OF status ON public.workouts FOR EACH ROW EXECUTE FUNCTION public.arc_fit_snapshot_workout_week_target();
NOTIFY pgrst,'reload schema';
COMMIT;
