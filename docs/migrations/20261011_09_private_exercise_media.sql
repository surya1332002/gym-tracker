-- User-supplied originals only. The shared catalogue and existing storage policies
-- are unchanged. Existing arc-fit-private owner-path rules cover these objects.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE IF NOT EXISTS public.exercise_media (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 exercise_id uuid NOT NULL REFERENCES public.exercises(id),
 -- Deleting a preset keeps every original photo as an exercise-level attachment.
 preset_id uuid REFERENCES public.machine_presets(id) ON DELETE SET NULL,
 object_path text NOT NULL UNIQUE,
 label text NOT NULL DEFAULT '',
 original_name text NOT NULL,
 mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
 size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 20971520),
 archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(object_path=user_id::text||'/exercise-'||id::text||CASE mime_type WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' WHEN 'image/webp' THEN '.webp' END)
);
CREATE INDEX IF NOT EXISTS exercise_media_owner_exercise ON public.exercise_media(user_id,exercise_id,preset_id);
ALTER TABLE public.exercise_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exercise_media FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.exercise_media TO authenticated;
-- Immutable original identity/path/bytes; only display label and archive status can change.
GRANT UPDATE(label,archived_at) ON public.exercise_media TO authenticated;
DROP POLICY IF EXISTS exercise_media_owner_read ON public.exercise_media;
CREATE POLICY exercise_media_owner_read ON public.exercise_media FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS exercise_media_owner_insert ON public.exercise_media;
CREATE POLICY exercise_media_owner_insert ON public.exercise_media FOR INSERT TO authenticated WITH CHECK(
 user_id=auth.uid()
 AND EXISTS(SELECT 1 FROM public.exercises e WHERE e.id=exercise_id AND e.user_id=auth.uid())
 AND (preset_id IS NULL OR EXISTS(SELECT 1 FROM public.machine_presets p WHERE p.id=preset_id AND p.user_id=auth.uid() AND p.exercise_id=exercise_media.exercise_id))
);
DROP POLICY IF EXISTS exercise_media_owner_update ON public.exercise_media;
CREATE POLICY exercise_media_owner_update ON public.exercise_media FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='arc-fit-private' AND NOT public) THEN RAISE EXCEPTION 'Apply the private photo bucket migration first'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
