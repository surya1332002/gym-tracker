-- Additive body tracking and private originals. Existing data is not rewritten.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.body_measurements ADD COLUMN IF NOT EXISTS custom_values jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.body_measurements ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.body_measurements ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.cardio_sessions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.cardio_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS is_favourite boolean NOT NULL DEFAULT false;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS tutorial_url text;
CREATE TABLE IF NOT EXISTS public.measurement_fields (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(btrim(name))>0),unit_kind text NOT NULL CHECK(unit_kind IN ('length','percentage','number')),
 is_hidden boolean NOT NULL DEFAULT false,position integer NOT NULL CHECK(position>0),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.progress_checkins (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 checkin_date date NOT NULL,notes text,created_at timestamptz NOT NULL DEFAULT now(),archived_at timestamptz,
 UNIQUE(id,user_id)
);
CREATE TABLE IF NOT EXISTS public.progress_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 checkin_id uuid NOT NULL,label text NOT NULL CHECK(label IN ('front','side','back','other')),
 object_path text NOT NULL UNIQUE,original_name text NOT NULL,mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
 size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=20971520),created_at timestamptz NOT NULL DEFAULT now(),archived_at timestamptz,
 FOREIGN KEY(checkin_id,user_id) REFERENCES public.progress_checkins(id,user_id) ON DELETE RESTRICT,
 CHECK(split_part(object_path,'/',1)=user_id::text)
);
ALTER TABLE public.measurement_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
DO $policies$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['measurement_fields','progress_checkins','progress_photos'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO authenticated',t);
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='owner_read') THEN
   EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()))',t);
   EXECUTE format('CREATE POLICY owner_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()))',t);
   EXECUTE format('CREATE POLICY owner_update ON public.%I FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()))',t);
  END IF;
 END LOOP;
END;
$policies$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('arc-fit-private','arc-fit-private',false,20971520,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
DO $storage$
BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='arc-fit-private' AND public) THEN RAISE EXCEPTION 'Refusing public media bucket'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='arc_fit_private_read') THEN
  CREATE POLICY arc_fit_private_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='arc-fit-private' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
  CREATE POLICY arc_fit_private_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='arc-fit-private' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
 END IF;
END;
$storage$;
-- Originals are immutable; no UPDATE/DELETE grants or policies added to Storage.
NOTIFY pgrst,'reload schema';
COMMIT;
