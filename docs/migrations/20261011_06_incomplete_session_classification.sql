-- Preserve performed sets while distinguishing explicitly incomplete sessions.
BEGIN; SET LOCAL lock_timeout='5s';
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS is_incomplete boolean NOT NULL DEFAULT false;
DO $migration$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.arc_fit_sync_workout(uuid,integer,uuid,jsonb,text)'::regprocedure);
 IF position('duration_state,is_incomplete)' in definition)=0 THEN
 IF position('advance_rotation,duration_state)' in definition)=0 OR position('p_payload->''duration'')' in definition)=0 THEN RAISE EXCEPTION 'Unexpected workout contract; migration stopped'; END IF;
 definition:=replace(definition,'advance_rotation,duration_state)','advance_rotation,duration_state,is_incomplete)');
 definition:=replace(definition,'p_payload->''duration'')','p_payload->''duration'',coalesce(p_payload->>''completionKind'',''complete'')=''incomplete'')');
 definition:=replace(definition,'duration_state=EXCLUDED.duration_state,updated_at','duration_state=EXCLUDED.duration_state,is_incomplete=EXCLUDED.is_incomplete,updated_at');
 EXECUTE definition; END IF; END $migration$;
NOTIFY pgrst,'reload schema'; COMMIT;
