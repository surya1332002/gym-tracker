-- Approved ARC FIT optional programme targets. Safe to rerun.
-- SQL Editor application; no data backfill, history writes, grants or policy changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.routine_exercises ALTER COLUMN target_sets DROP NOT NULL;
ALTER TABLE public.routine_exercises ALTER COLUMN target_sets DROP DEFAULT;
ALTER TABLE public.routine_exercises ADD COLUMN IF NOT EXISTS target_weight_kg numeric;
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.routine_exercises'::regclass AND conname='routine_exercises_target_weight_kg_check') THEN
    ALTER TABLE public.routine_exercises ADD CONSTRAINT routine_exercises_target_weight_kg_check
      CHECK (target_weight_kg IS NULL OR (target_weight_kg >= 0 AND target_weight_kg < 'Infinity'::numeric));
  END IF;
END;
$migration$;

-- Replace the already-deployed trusted RPC in place: retains owner and ACL.
-- auth.uid(), active-exercise ownership, row lock, expected revision, stable save UUID,
-- empty search_path and old day/history preservation remain unchanged.
CREATE OR REPLACE FUNCTION public.arc_fit_save_programme(
  p_id uuid, p_expected_revision integer, p_save_id uuid, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner uuid := auth.uid(); v_programme public.workout_programmes;
  v_muscles text[]; v_count integer; v_created boolean; v_next integer;
  v_day jsonb; v_entry jsonb; v_day_id uuid; v_sequence integer := 0; v_position integer;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_id IS NULL OR p_save_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 THEN
    RAISE EXCEPTION 'Valid programme, save identity and revision required';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string'
    OR length(btrim(p_payload->>'name')) = 0
    OR jsonb_typeof(p_payload->'split') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_payload->'muscles') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_payload->'days') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid programme payload';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload->'muscles') m
    WHERE jsonb_typeof(m) <> 'string' OR length(btrim(m #>> '{}')) = 0) THEN
    RAISE EXCEPTION 'Invalid muscle configuration';
  END IF;
  SELECT coalesce(array_agg(m.value ORDER BY m.ordinality), '{}'::text[]) INTO v_muscles
    FROM jsonb_array_elements_text(p_payload->'muscles') WITH ORDINALITY m(value, ordinality);

  -- Caller retains these UUIDs across ambiguous network retries. A foreign-owned
  -- ID cannot be taken over. ON CONFLICT waits for simultaneous initial saves.
  INSERT INTO public.workout_programmes (id, user_id, name, split, muscles)
    SELECT p_id, v_owner, btrim(p_payload->>'name'), p_payload->>'split', v_muscles
    WHERE p_expected_revision = 0 ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_created := v_count = 1;
  SELECT * INTO v_programme FROM public.workout_programmes
    WHERE id = p_id AND user_id = v_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Programme unavailable' USING ERRCODE = '42501'; END IF;
  IF v_programme.last_save_id = p_save_id THEN
    IF v_programme.last_save_payload IS DISTINCT FROM p_payload THEN
      RAISE EXCEPTION 'Save identity reused with different content';
    END IF;
    RETURN jsonb_build_object('id', p_id, 'user_id', v_owner, 'revision', v_programme.revision);
  END IF;
  IF NOT v_created AND v_programme.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'Programme revision conflict; retain the draft' USING ERRCODE = '40001';
  END IF;
  v_next := CASE WHEN v_created THEN 1 ELSE v_programme.revision + 1 END;
  -- Retain old days/entries. Never delete or rewrite a day referenced by history.
  UPDATE public.routine_days SET is_active = false
    WHERE programme_id = p_id AND user_id = v_owner;
  FOR v_day IN SELECT value FROM jsonb_array_elements(p_payload->'days') LOOP
    v_sequence := v_sequence + 1;
    IF jsonb_typeof(v_day) <> 'object'
      OR jsonb_typeof(v_day->'name') IS DISTINCT FROM 'string'
      OR length(btrim(v_day->>'name')) = 0
      OR jsonb_typeof(v_day->'exercises') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Invalid routine day';
    END IF;
    INSERT INTO public.routine_days (user_id, programme_id, programme_revision, name, sequence_number)
      VALUES (v_owner, p_id, v_next, btrim(v_day->>'name'), v_sequence) RETURNING id INTO v_day_id;
    v_position := 0;
    FOR v_entry IN SELECT value FROM jsonb_array_elements(v_day->'exercises') LOOP
      v_position := v_position + 1;
      IF jsonb_typeof(v_entry) <> 'object'
        OR jsonb_typeof(v_entry->'exercise_id') IS DISTINCT FROM 'string'
        OR coalesce(jsonb_typeof(v_entry->'target_sets'), 'null') NOT IN ('number', 'null')
        OR coalesce(jsonb_typeof(v_entry->'target_weight_kg'), 'null') NOT IN ('number', 'null')
        OR jsonb_typeof(v_entry->'target_reps_min') NOT IN ('number', 'null')
        OR jsonb_typeof(v_entry->'target_reps_max') NOT IN ('number', 'null')
        OR NOT (v_entry ? 'target_reps_min' AND v_entry ? 'target_reps_max') THEN
        RAISE EXCEPTION 'Invalid exercise plan';
      END IF;
      -- Disallow fractions rather than numeric->integer rounding.
      IF (v_entry->>'target_sets')::numeric <> trunc((v_entry->>'target_sets')::numeric)
        OR ((v_entry->>'target_reps_min')::numeric IS NOT NULL AND
          (v_entry->>'target_reps_min')::numeric <> trunc((v_entry->>'target_reps_min')::numeric))
        OR ((v_entry->>'target_reps_max')::numeric IS NOT NULL AND
          (v_entry->>'target_reps_max')::numeric <> trunc((v_entry->>'target_reps_max')::numeric))
        OR ((v_entry->>'target_reps_min') IS NULL) <> ((v_entry->>'target_reps_max') IS NULL) THEN
        RAISE EXCEPTION 'Sets/reps must be integer bounds or paired NULL reps';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.exercises
        WHERE id = (v_entry->>'exercise_id')::uuid AND user_id = v_owner AND NOT is_archived) THEN
        RAISE EXCEPTION 'Exercise must be active and owned' USING ERRCODE = '42501';
      END IF;
      INSERT INTO public.routine_exercises (user_id, routine_day_id, exercise_id, position,
        target_sets, target_reps_min, target_reps_max, target_weight_kg)
        VALUES (v_owner, v_day_id, (v_entry->>'exercise_id')::uuid, v_position,
          ((v_entry->>'target_sets')::numeric)::integer, ((v_entry->>'target_reps_min')::numeric)::integer,
          ((v_entry->>'target_reps_max')::numeric)::integer, (v_entry->>'target_weight_kg')::numeric);
    END LOOP;
  END LOOP;
  UPDATE public.workout_programmes SET name = btrim(p_payload->>'name'), split = p_payload->>'split',
    muscles = v_muscles, revision = v_next, last_save_id = p_save_id, last_save_payload = p_payload,
    updated_at = now() WHERE id = p_id AND user_id = v_owner;
  RETURN jsonb_build_object('id', p_id, 'user_id', v_owner, 'revision', v_next);
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
