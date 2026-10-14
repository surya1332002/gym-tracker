-- Retain all programme revisions and nullable targets. Abort on an unexpected save contract.
BEGIN; SET LOCAL lock_timeout='5s';
ALTER TABLE public.routine_exercises ADD COLUMN IF NOT EXISTS plan_metadata jsonb NOT NULL DEFAULT '{}';
DO $migration$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.arc_fit_save_programme(uuid,integer,uuid,jsonb)'::regprocedure);
 IF position('target_weight_kg, plan_metadata)' in definition)=0 THEN
 IF position('target_reps_max, target_weight_kg)' in definition)=0 OR position('(v_entry->>''target_weight_kg'')::numeric);' in definition)=0 THEN RAISE EXCEPTION 'Unexpected programme contract; migration stopped'; END IF;
 definition:=replace(definition,'target_reps_max, target_weight_kg)','target_reps_max, target_weight_kg, plan_metadata)');
 definition:=replace(definition,'(v_entry->>''target_weight_kg'')::numeric);','(v_entry->>''target_weight_kg'')::numeric, coalesce(v_entry->''plan_metadata'',''{}''::jsonb));');
 definition:=replace(definition,'INSERT INTO public.routine_exercises (', $validation$      IF v_entry ? 'plan_metadata' THEN
        IF jsonb_typeof(v_entry->'plan_metadata') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid plan metadata'; END IF;
        IF (v_entry->'plan_metadata') ? 'per_set_reps' THEN
          IF jsonb_typeof(v_entry->'plan_metadata'->'per_set_reps') IS DISTINCT FROM 'array' OR jsonb_array_length(v_entry->'plan_metadata'->'per_set_reps')>20 THEN RAISE EXCEPTION 'Invalid per-set targets'; END IF;
          IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_entry->'plan_metadata'->'per_set_reps') x WHERE jsonb_typeof(x) NOT IN ('number','null') OR (x #>> '{}')::numeric NOT BETWEEN 1 AND 1000 OR (x #>> '{}')::numeric<>trunc((x #>> '{}')::numeric)) THEN RAISE EXCEPTION 'Invalid per-set reps'; END IF;
        END IF;
        IF (v_entry->'plan_metadata') ? 'group' AND (coalesce(v_entry->'plan_metadata'->'group'->>'type','') NOT IN ('superset','triset','circuit') OR coalesce(v_entry->'plan_metadata'->'group'->>'id','')='' OR coalesce(v_entry->'plan_metadata'->'group'->>'name','')='') THEN RAISE EXCEPTION 'Invalid exercise group'; END IF;
      END IF;
$validation$||'INSERT INTO public.routine_exercises (');
 EXECUTE definition;
 END IF; END $migration$;
NOTIFY pgrst,'reload schema'; COMMIT;
