-- Approved full-application milestone. Additive; no workout backfill or history edits.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS advance_rotation boolean NOT NULL DEFAULT false;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS duration_state jsonb;
-- Widen decimal storage without changing any existing values.
ALTER TABLE public.workout_sets ALTER COLUMN weight_kg TYPE numeric;
ALTER TABLE public.workout_sets ADD COLUMN IF NOT EXISTS input_weight text;
ALTER TABLE public.workout_sets ADD COLUMN IF NOT EXISTS input_unit text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS previous_training_months integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS circumference_unit text NOT NULL DEFAULT 'cm';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_target integer NOT NULL DEFAULT 3;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS smart_prefill boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS public.workout_sync_operations (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL,
 workout_id uuid NOT NULL,
 payload jsonb NOT NULL,
 revision integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,operation_id)
);
ALTER TABLE public.workout_sync_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_sync_operations FROM PUBLIC,anon,authenticated;
-- No direct access: receipts are only inspected within the owner-checked gateway.
CREATE OR REPLACE FUNCTION public.arc_fit_sync_workout(
 p_id uuid,p_revision integer,p_operation uuid,p_payload jsonb,p_action text DEFAULT 'save'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid:=auth.uid(); current_row public.workouts; prior public.workout_sync_operations;
 e jsonb; s jsonb; eid uuid; sid uuid; position_no integer:=0; next_revision integer; envelope jsonb;
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_operation IS NULL OR p_revision IS NULL OR p_revision<0 OR p_action IS NULL OR p_action NOT IN ('save','edit','trash','restore') THEN RAISE EXCEPTION 'Invalid workout operation'; END IF;
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Workout object required'; END IF;
 envelope:=jsonb_build_object('action',p_action,'workout',p_payload);
 PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 SELECT * INTO prior FROM public.workout_sync_operations WHERE user_id=owner_id AND operation_id=p_operation;
 IF FOUND THEN
  IF prior.workout_id<>p_id OR prior.payload IS DISTINCT FROM envelope THEN RAISE EXCEPTION 'Operation identity reused'; END IF;
  RETURN jsonb_build_object('id',p_id,'user_id',owner_id,'revision',prior.revision);
 END IF;
 SELECT * INTO current_row FROM public.workouts WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF current_row.user_id<>owner_id THEN RAISE EXCEPTION 'Workout unavailable' USING ERRCODE='42501'; END IF;
  IF current_row.revision<>p_revision THEN RAISE EXCEPTION 'Workout changed on another device' USING ERRCODE='40001'; END IF;
 ELSE
  IF p_revision<>0 OR p_action<>'save' THEN RAISE EXCEPTION 'Workout unavailable'; END IF;
 END IF;
 next_revision:=p_revision+1;
 IF p_action IN ('trash','restore') THEN
  IF current_row.id IS NULL OR current_row.status='in_progress' THEN RAISE EXCEPTION 'Only finished workouts can enter Recently Deleted'; END IF;
  IF p_action='restore' AND (current_row.deleted_at IS NULL OR current_row.deleted_at<now()-interval '30 days') THEN RAISE EXCEPTION 'Recovery period unavailable'; END IF;
  UPDATE public.workouts SET deleted_at=CASE WHEN p_action='trash' THEN now() ELSE NULL END,revision=next_revision,updated_at=now() WHERE id=p_id AND user_id=owner_id;
 ELSE
  IF current_row.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Restore this workout before editing'; END IF;
  IF current_row.status='completed' AND p_action<>'edit' THEN RAISE EXCEPTION 'Use explicit history editing'; END IF;
  IF p_action='edit' AND (current_row.status<>'completed' OR p_payload->>'completedAt' IS NULL) THEN RAISE EXCEPTION 'History edits cannot reopen a workout'; END IF;
  IF p_payload->>'userId' IS DISTINCT FROM owner_id::text OR p_payload->>'id' IS DISTINCT FROM p_id::text THEN RAISE EXCEPTION 'Owner or identity mismatch' USING ERRCODE='42501'; END IF;
  IF length(btrim(coalesce(p_payload->>'name','')))=0 OR jsonb_typeof(p_payload->'exercises') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'exercises')>100 THEN RAISE EXCEPTION 'Valid workout name and exercises required'; END IF;
  IF p_payload->>'completedAt' IS NULL AND EXISTS(SELECT 1 FROM public.workouts WHERE user_id=owner_id AND status='in_progress' AND deleted_at IS NULL AND id<>p_id) THEN RAISE EXCEPTION 'Resume the existing unfinished workout first' USING ERRCODE='40001'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_payload->'exercises'))<>(SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_payload->'exercises')) THEN RAISE EXCEPTION 'Duplicate exercise identities'; END IF;
  INSERT INTO public.workouts(id,user_id,routine_day_id,routine_name_snapshot,workout_date,started_at,status,completed_at,notes,revision,advance_rotation,duration_state)
   VALUES(p_id,owner_id,(p_payload->>'dayId')::uuid,p_payload->>'name',(p_payload->>'date')::date,(p_payload->>'startedAt')::timestamptz,CASE WHEN p_payload->>'completedAt' IS NULL THEN 'in_progress' ELSE 'completed' END,(p_payload->>'completedAt')::timestamptz,nullif(p_payload->>'notes',''),next_revision,(p_payload->>'dayId' IS NOT NULL AND coalesce((p_payload->>'advanceRotation')::boolean,false)),p_payload->'duration')
   ON CONFLICT(id) DO UPDATE SET routine_day_id=EXCLUDED.routine_day_id,routine_name_snapshot=EXCLUDED.routine_name_snapshot,workout_date=EXCLUDED.workout_date,started_at=EXCLUDED.started_at,status=EXCLUDED.status,completed_at=EXCLUDED.completed_at,notes=EXCLUDED.notes,revision=next_revision,advance_rotation=EXCLUDED.advance_rotation,duration_state=EXCLUDED.duration_state,updated_at=now();
  -- Move existing positions away while reordering, avoiding transient unique collisions.
  UPDATE public.workout_exercises SET position=position+100000 WHERE workout_id=p_id AND user_id=owner_id;
  FOR e IN SELECT value FROM jsonb_array_elements(p_payload->'exercises') LOOP
   eid:=(e->>'id')::uuid; position_no:=position_no+1;
   IF EXISTS(SELECT 1 FROM public.workout_exercises WHERE id=eid AND (user_id<>owner_id OR workout_id<>p_id)) THEN RAISE EXCEPTION 'Foreign exercise instance' USING ERRCODE='42501'; END IF;
   IF EXISTS(SELECT 1 FROM public.workout_exercises x JOIN public.workout_sets t ON t.workout_exercise_id=x.id WHERE x.id=eid AND t.is_completed AND x.exercise_id IS DISTINCT FROM (e->>'exerciseId')::uuid) THEN RAISE EXCEPTION 'Completed work must retain original exercise attribution'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.exercises WHERE id=(e->>'exerciseId')::uuid AND user_id=owner_id) THEN RAISE EXCEPTION 'Exercise unavailable' USING ERRCODE='42501'; END IF;
   IF jsonb_typeof(e->'sets') IS DISTINCT FROM 'array' OR jsonb_array_length(e->'sets')>100 THEN RAISE EXCEPTION 'Valid sets required'; END IF;
   IF (SELECT count(*) FROM jsonb_array_elements(e->'sets'))<>(SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(e->'sets')) THEN RAISE EXCEPTION 'Duplicate set identities'; END IF;
   INSERT INTO public.workout_exercises(id,user_id,workout_id,exercise_id,exercise_name_snapshot,equipment_snapshot,position,machine_preset_snapshot,notes)
    VALUES(eid,owner_id,p_id,(e->>'exerciseId')::uuid,e->>'name',e->>'equipment',position_no,e-'sets',nullif(e->>'notes',''))
    ON CONFLICT(id) DO UPDATE SET exercise_id=EXCLUDED.exercise_id,exercise_name_snapshot=EXCLUDED.exercise_name_snapshot,equipment_snapshot=EXCLUDED.equipment_snapshot,position=EXCLUDED.position,machine_preset_snapshot=EXCLUDED.machine_preset_snapshot,notes=EXCLUDED.notes;
   FOR s IN SELECT value FROM jsonb_array_elements(e->'sets') LOOP
    sid:=(s->>'id')::uuid;
    IF EXISTS(SELECT 1 FROM public.workout_sets WHERE id=sid AND (user_id<>owner_id OR workout_exercise_id<>eid)) THEN RAISE EXCEPTION 'Foreign set identity' USING ERRCODE='42501'; END IF;
    IF coalesce((s->>'completed')::boolean,false) AND (nullif(s->>'reps','') IS NULL OR (s->>'reps')::integer<1 OR s->>'completedAt' IS NULL) THEN RAISE EXCEPTION 'Completed sets require actual reps and completion time'; END IF;
    IF s->>'weightKg' IS NOT NULL AND (nullif(s->>'lb','') IS NULL OR abs((s->>'weightKg')::numeric-(s->>'lb')::numeric*0.45359237)>0.000000001) THEN RAISE EXCEPTION 'Canonical and displayed weight mismatch'; END IF;
    INSERT INTO public.workout_sets(id,user_id,workout_exercise_id,set_number,set_type,weight_kg,reps,rpe,is_completed,completed_at,notes,input_weight,input_unit)
     VALUES(sid,owner_id,eid,(s->>'number')::integer,coalesce(s->>'setType','working'),coalesce((s->>'weightKg')::numeric,nullif(s->>'lb','')::numeric*0.45359237),nullif(s->>'reps','')::integer,nullif(s->>'rpe','')::numeric,coalesce((s->>'completed')::boolean,false),CASE WHEN coalesce((s->>'completed')::boolean,false) THEN (s->>'completedAt')::timestamptz ELSE NULL END,nullif(s->>'notes',''),s->>'lb','lb')
     ON CONFLICT(id) DO UPDATE SET set_number=EXCLUDED.set_number,set_type=EXCLUDED.set_type,weight_kg=EXCLUDED.weight_kg,reps=EXCLUDED.reps,rpe=EXCLUDED.rpe,is_completed=EXCLUDED.is_completed,completed_at=EXCLUDED.completed_at,notes=EXCLUDED.notes,input_weight=EXCLUDED.input_weight,input_unit=EXCLUDED.input_unit,updated_at=now();
   END LOOP;
   DELETE FROM public.workout_sets t WHERE t.workout_exercise_id=eid AND t.user_id=owner_id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(e->'sets') v WHERE (v.value->>'id')::uuid=t.id);
  END LOOP;
  DELETE FROM public.workout_exercises x WHERE x.workout_id=p_id AND x.user_id=owner_id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'exercises') v WHERE (v.value->>'id')::uuid=x.id);
  IF p_payload->>'completedAt' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workout_sets t JOIN public.workout_exercises x ON x.id=t.workout_exercise_id WHERE x.workout_id=p_id AND t.is_completed) THEN RAISE EXCEPTION 'Complete an actual set before finishing'; END IF;
 END IF;
 INSERT INTO public.workout_sync_operations(user_id,operation_id,workout_id,payload,revision) VALUES(owner_id,p_operation,p_id,envelope,next_revision);
 RETURN jsonb_build_object('id',p_id,'user_id',owner_id,'revision',next_revision);
END;
$$;
REVOKE ALL ON FUNCTION public.arc_fit_sync_workout(uuid,integer,uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.arc_fit_sync_workout(uuid,integer,uuid,jsonb,text) TO authenticated;
-- The gateway is the sole authenticated strength-workout writer: aggregate revisions
-- cannot be bypassed by direct child/table updates. Owner SELECT/RLS remain intact.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.workouts,public.workout_exercises,public.workout_sets FROM authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
