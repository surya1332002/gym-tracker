-- First-use configuration is an explicit decision, independent of a nullable increment.
-- Applied with the approved integrated milestone. Canonical loads, history, ownership and existing preferences are preserved.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS weight_preferences_configured boolean NOT NULL DEFAULT false;
DO $migration$
DECLARE definition text; anchor text; pattern text;
BEGIN
 definition:=pg_get_functiondef('public.arc_fit_sync_workout(uuid,integer,uuid,jsonb,text)'::regprocedure);
 IF position('weight_preferences_configured=true' IN definition)>0 THEN RETURN; END IF;
 IF position('coalesce((e->>''savePreferences'')::boolean,false)' IN definition)=0 THEN RAISE EXCEPTION 'Explicit preference save guard missing; migration stopped'; END IF;
 anchor:=$anchor$UPDATE public.exercises SET weight_unit=e->>'unit',weight_increment=(e->>'increment')::numeric,updated_at=now() WHERE id=(e->>'exerciseId')::uuid AND user_id=owner_id;$anchor$;
 pattern:=$pattern$UPDATE public[.]exercises SET weight_unit=e->>'unit',weight_increment=[(]e->>'increment'[)]::numeric,updated_at=now[(][)] WHERE id=[(]e->>'exerciseId'[)]::uuid AND user_id=owner_id;$pattern$;
 IF regexp_count(definition,pattern)<>1 OR position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Unexpected owned preference contract; migration stopped'; END IF;
 definition:=replace(definition,anchor,$replacement$UPDATE public.exercises SET weight_unit=e->>'unit',weight_increment=(e->>'increment')::numeric,weight_preferences_configured=true,updated_at=now() WHERE id=(e->>'exerciseId')::uuid AND user_id=owner_id;$replacement$);
 EXECUTE definition;
END $migration$;
NOTIFY pgrst,'reload schema';
COMMIT;
