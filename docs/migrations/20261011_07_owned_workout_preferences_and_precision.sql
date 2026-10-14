-- Exact canonical conversions and atomic owned exercise preferences. No existing values rewritten.
BEGIN; SET LOCAL lock_timeout='5s';
ALTER TABLE public.body_measurements ALTER COLUMN weight_kg TYPE numeric,ALTER COLUMN body_fat_pct TYPE numeric,ALTER COLUMN waist_cm TYPE numeric,ALTER COLUMN chest_cm TYPE numeric,ALTER COLUMN hips_cm TYPE numeric,ALTER COLUMN arm_cm TYPE numeric,ALTER COLUMN thigh_cm TYPE numeric,ALTER COLUMN neck_cm TYPE numeric;
ALTER TABLE public.cardio_sessions ALTER COLUMN distance_km TYPE numeric;
DO $migration$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.arc_fit_sync_workout(uuid,integer,uuid,jsonb,text)'::regprocedure);
 IF position('Preset unavailable' in definition)=0 THEN
 IF position('IF jsonb_typeof(e->''sets'')' in definition)=0 THEN RAISE EXCEPTION 'Unexpected workout contract; migration stopped'; END IF;
 definition:=replace(definition,'IF jsonb_typeof(e->''sets'')',$preferences$   -- Persist only explicitly chosen preferences and an owned preset in the same atomic operation.
   IF e ? 'selectedPresetId' AND e->>'selectedPresetId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.machine_presets WHERE id=(e->>'selectedPresetId')::uuid AND user_id=owner_id AND exercise_id=(e->>'exerciseId')::uuid) THEN RAISE EXCEPTION 'Preset unavailable' USING ERRCODE='42501'; END IF;
   IF coalesce((e->>'savePreferences')::boolean,false) THEN
    IF e->>'unit' IS NULL OR e->>'unit' NOT IN ('kg','lb') OR (e->>'increment' IS NOT NULL AND ((e->>'increment')::numeric<=0 OR (e->>'increment')::numeric>1000)) THEN RAISE EXCEPTION 'Invalid exercise weight preferences'; END IF;
    UPDATE public.exercises SET weight_unit=e->>'unit',weight_increment=(e->>'increment')::numeric,updated_at=now() WHERE id=(e->>'exerciseId')::uuid AND user_id=owner_id;
   END IF;
   IF e ? 'selectedPresetId' THEN UPDATE public.exercises SET last_machine_preset_id=(e->>'selectedPresetId')::uuid WHERE id=(e->>'exerciseId')::uuid AND user_id=owner_id; END IF;
   IF p_payload->>'completionKind'='incomplete' AND coalesce((p_payload->>'advanceRotation')::boolean,false) THEN RAISE EXCEPTION 'Incomplete sessions cannot advance rotation'; END IF;
$preferences$||'IF jsonb_typeof(e->''sets'')');
 EXECUTE definition; END IF; END $migration$;
NOTIFY pgrst,'reload schema'; COMMIT;
