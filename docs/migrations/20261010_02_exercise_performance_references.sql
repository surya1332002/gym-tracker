-- Approved one-table migration. Run once in project bqzqiidniitbraapjmyk SQL Editor.
-- No changes to existing tables, history, catalogue, authentication or policies.
begin;
create table public.exercise_performance_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  routine_day_id uuid references public.routine_days(id) on delete restrict,
  performance_date date,
  source_key text not null check (length(trim(source_key)) between 1 and 500),
  recorded_sets jsonb not null check (jsonb_typeof(recorded_sets) = 'array' and jsonb_array_length(recorded_sets) between 1 and 20),
  weight_unit text not null default 'lb' check (weight_unit = 'lb'),
  machine_settings text not null default '',
  per_side_qualifiers text not null default '',
  original_notes text not null default '',
  source_fields jsonb not null check (jsonb_typeof(source_fields) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);
create index exercise_performance_references_lookup
  on public.exercise_performance_references(user_id, exercise_id, routine_day_id);
alter table public.exercise_performance_references enable row level security;
revoke all on public.exercise_performance_references from public, anon, authenticated;
grant select, insert, update on public.exercise_performance_references to authenticated;
create policy performance_references_select on public.exercise_performance_references
  for select to authenticated using ((select auth.uid()) = user_id);
create policy performance_references_insert on public.exercise_performance_references
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = (select auth.uid()))
    and (routine_day_id is null or exists (select 1 from public.routine_days d where d.id = routine_day_id and d.user_id = (select auth.uid())))
  );
create policy performance_references_update on public.exercise_performance_references
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = (select auth.uid()))
    and (routine_day_id is null or exists (select 1 from public.routine_days d where d.id = routine_day_id and d.user_id = (select auth.uid())))
  );
notify pgrst, 'reload schema';
commit;
