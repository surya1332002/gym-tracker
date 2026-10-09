-- Version: 20261009_01. DRAFT: isolated verification authorised ONLY.
-- Never execute against live project bqzqiidniitbraapjmyk.
-- Stored outside supabase/migrations to prevent automatic deployment.
-- Supabase CLI is unavailable; this is a versioned review artifact, not an
-- applied migration or a reproducible schema baseline. Nothing has been run.
-- Before execution: verify the test project's identity is distinct from live,
-- use synthetic users/data, reproduce current schema/RLS/ACL/FKs, and capture
-- baseline row counts, constraints, policies and grants in that test database.

-- Live read-only metadata, 2026-10-09, PostgreSQL 17.11:
-- authenticated has direct postgres-granted SELECT/INSERT/UPDATE/DELETE,
-- TRUNCATE/REFERENCES/TRIGGER/MAINTAIN; no grant options or column ACLs.
-- authenticated has no parent role memberships, no superuser/BYPASSRLS,
-- and no CREATE on public. anon has no exercise-table grants.
-- RLS enabled; own_select/insert/update/delete enforce auth.uid() = user_id.
-- Existing FK dependencies (not modified): exercises.user_id -> auth.users;
-- machine_presets -> exercises CASCADE; routine_exercises/workout_exercises
-- -> exercises RESTRICT. Only internal FK triggers found on exercises.
-- No non-system routine source mentioning exercises or authenticated-owned
-- routine found. This source scan does not prove absence of dynamic SQL or
-- external deployment workflows. Local source scan found no privilege use.
-- Existing FK checks/triggers survive revoking REFERENCES/TRIGGER; creation
-- of new constraints/triggers remains the responsibility of deployment roles.
-- MAINTAIN is newly discovered and intentionally retained pending separate
-- review; this migration is not complete database-wide privilege hardening.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.exercises
  ADD COLUMN weight_unit text,
  ADD COLUMN weight_increment numeric,
  ADD CONSTRAINT exercises_weight_unit_check
    CHECK (weight_unit IN ('kg', 'lb')),
  ADD CONSTRAINT exercises_weight_increment_check
    CHECK (weight_increment > 0 AND weight_increment < 'Infinity'::numeric);

-- NULL remains allowed for existing/unconfigured records; no backfill or
-- account-wide default. PostgreSQL numeric ordering rejects NaN and Infinity
-- with the upper-bound check, and negative Infinity with the positive check.
-- No profiles, historical loads, ownership constraints or policies changed.
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.exercises FROM authenticated RESTRICT;

COMMIT;

-- Verification plan (NOT EXECUTED). Run separately, not as migration writes:
-- BEGIN READ ONLY;
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='exercises'
-- ORDER BY ordinal_position;
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid='public.exercises'::regclass;
-- SELECT relrowsecurity, relforcerowsecurity, relacl FROM pg_class
-- WHERE oid='public.exercises'::regclass;
-- SELECT policyname, roles, cmd, qual, with_check FROM pg_policies
-- WHERE schemaname='public' AND tablename='exercises';
-- SELECT role_name, privilege,
--        has_table_privilege(role_name,'public.exercises',privilege) AS allowed
-- FROM (VALUES ('anon'),('authenticated')) r(role_name)
-- CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
--                    ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege);
-- COMMIT;
-- Expected: authenticated CRUD true; three revoked privileges false; anon
-- denied; MAINTAIN unchanged; existing constraints/policies identical.
-- Isolated behaviour tests required BEFORE production approval:
-- * existing rows preserved with both new columns NULL;
-- * synthetic account A can create/read/edit/archive/delete its own record;
-- * NULL/kg/lb units accepted; other values rejected;
-- * NULL and finite positive increments accepted; zero/negative/NaN/+/-Infinity
--   rejected by the database, not just client validation;
-- * authenticated B cannot read/update/delete A's rows, insert with A's owner
--   or reassign B's record to A; test nonprivileged roles/JWT claims;
-- * anonymous exercise access denied;
-- * FK cross-owner rejection, restrictive history links and internal FK
--   triggers still work; verify actual role capabilities after revocation;
-- * profile read/create defaults and cross-account isolation unchanged;
-- * test transactional rollback in isolation and retain migration evidence.

-- Rollback considerations (NOT an authorised down migration): failures before
-- COMMIT roll back all changes. After use, prefer reverting the application
-- while retaining nullable columns; dropping them loses saved preferences.
-- Do not automatically restore TRUNCATE. Any privilege restoration requires
-- explicit review against the captured original postgres-granted ACL.
-- RESTRICT avoids silently cascading dependent grants. Never add CASCADE
-- to bypass a dependency failure. Separately approve production deployment.
