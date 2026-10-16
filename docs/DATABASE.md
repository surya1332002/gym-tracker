# Gym Tracker — Database Foundation and Proposed Direction

Recorded 2026-10-09. **Historical audit record; proposed changes are DRAFT / AWAITING REVIEW.** No live access, SQL execution, migration or database change occurred during this documentation task.

## Evidence and Project Identity

Target: Gym Tracker, project reference `bqzqiidniitbraapjmyk`. Historical Step 6B connector metadata returned `https://bqzqiidniitbraapjmyk.supabase.co`; inspection returned `current_user = supabase_read_only_user` and `transaction_read_only = on`.

The user confirms Step 6B completed and approved. The original `gym-database-reviewer` supplied retained evidence for this record without calling tools again. Its independently inspected metadata is distinguished below from findings supplied by the parent during that audit. The complete original query transcript and column inventory are not stored here. These findings are verified at the earlier audit boundary, not a claim of unchanged live state today.

The historical inspection role had BYPASSRLS according to the parent. It was used for read-only metadata, not user-isolation testing. No private workout/profile rows, photos, Storage objects or auth records were retrieved; no cross-account write tests were conducted.

## VERIFIED CURRENT STATE — Historical Step 6B

### Ten public application tables

| Table | Existing foundation | Ownership column observed |
|---|---|---|
| `profiles` | Account profile/preferences | `id` |
| `exercises` | User-owned exercises, not a shared catalogue | `user_id` |
| `machine_presets` | Exercise-linked machine configurations | `user_id` |
| `routine_days` | Routine days | `user_id` |
| `routine_exercises` | Ordered routine exercises | `user_id` |
| `workouts` | Workout records, optional routine relationship | `user_id` |
| `workout_exercises` | Workout exercise instances | `user_id` |
| `workout_sets` | Sets under workout exercise instances | `user_id` |
| `cardio_sessions` | Cardio records with an existing workout relationship | `user_id` |
| `body_measurements` | Initial measurement records | `user_id` |

Table names and ownership columns were independently inspected by the reviewer. Functional descriptions identify foundation coverage, not full product compliance. The existing cardio relationship does not override master section 4.7's standalone cardio requirement.

### Relationships and constraints

The parent reported 77 constraints and 32 indexes, with validated composite `(parent_id, user_id)` foreign keys for:

- `machine_presets` to `exercises`.
- `routine_exercises` to `routine_days` and `exercises`.
- `workouts` to `routine_days`.
- `workout_exercises` to `workouts` and `exercises`.
- `workout_sets` to `workout_exercises`.
- `cardio_sessions` to `workouts`.

These ownership-bearing relationships are worth preserving: linking a child to another user's parent must remain prohibited. Counts and relationships are retained parent audit findings, not independently re-inspected by the reviewer. Exact constraint/index names, full column types/defaults, remaining checks, identity foreign keys and deletion actions are not available in the retained evidence and must be recovered before authoring a reproducible baseline. Do not infer cascade behaviour from this list.

### Ownership and RLS

Independently inspected: all ten tables had RLS enabled and FORCE RLS disabled. Each had four permissive policies targeting `authenticated`:

| Policy | Command | Ownership enforcement observed |
|---|---|---|
| `own_select` | SELECT | USING compares `auth.uid()` with ownership column |
| `own_insert` | INSERT | WITH CHECK compares `auth.uid()` with ownership column |
| `own_update` | UPDATE | Both USING and WITH CHECK use that comparison |
| `own_delete` | DELETE | USING uses that comparison |

The ownership field is `profiles.id`, otherwise `user_id`. `exercises.user_id` was required and defaulted to `auth.uid()`. Its policies exposed owned rows, not shared catalogue rows. The update checks support reassignment protection as source metadata; runtime isolation was not tested. RLS enabled status alone is not proof of overall security.

### Excessive grants

Each table's inspected ACL gave `authenticated` SELECT, INSERT, UPDATE, DELETE and additional privileges including TRUNCATE. Independent privilege checks returned authenticated TRUNCATE true on all ten tables; anon SELECT false.

**High-priority finding:** authenticated TRUNCATE grants exceed required per-user access and are not constrained by row ownership policies. Immediate exploitability through the currently exposed frontend/API was not demonstrated. A separately approved hardening task must inspect and narrow grants, preserve working queries and consider privilege defaults for future objects. This document contains no executable remediation SQL.

### Storage, functions, triggers and migration baseline

- Reviewer: no Storage policies appeared in inspected policy metadata; no public views/functions were found. A separate catalogue query found no functions outside the enumerated Supabase/system schemas.
- Parent: Storage bucket metadata, Storage policies, migration history and Edge-function listings were empty within the inspected scope. No noninternal triggers were found on public tables or `auth.users`; timestamp defaults existed without refresh triggers.
- Local reinspection: no local SQL migrations, Supabase directory or generated database types were found. The schema cannot currently be reproduced from repository migrations alone.

Empty listings describe the inspected scope, not proof about inaccessible resources. Do not invent migration versions or trigger definitions. Existing timestamp defaults do not establish automatically refreshed `updated_at` values.

### Application compatibility

`src/lib/profiles.ts` expects `id`, nullable `display_name`, `timezone`, `weight_unit`, `distance_unit`, `created_at` and `updated_at`; validates matching identity; reads by ID; inserts only UUID and rereads after duplicate-key recovery. The reviewer inspected profile defaults and found that insertion approach compatible at audit time. Preserve those defaults and access contracts until a reviewed transition exists.

The legacy workout UI writes browser localStorage rather than these workout tables. Existing tables therefore do not establish implemented workout cloud persistence.

## Coverage and Gaps

| Requirement | Historical foundation assessment |
|---|---|
| Profiles/auth identity | PARTIAL: profile flow exists; full master profile/account lifecycle is not demonstrated |
| Shared catalogue/personal identities | MISSING approved model: existing exercises are user-owned |
| Custom exercises | PARTIAL: owned exercise table; full fields/private media are not demonstrated |
| Routines | PARTIAL: days/exercises foundation; full grouping/rotation contracts outstanding |
| Workouts/sets | PARTIAL: relationships exist; duration, incomplete choices, snapshots and revisions require reviewed extensions |
| Machine presets | PARTIAL: preset relationships; full media and historical snapshot coverage not established |
| Historical integrity/analytics | PARTIAL foundation; complete snapshot, correction and recalculation design not established |
| Body measurements | PARTIAL: initial table; custom/paired precision-preserving requirements outstanding |
| Private progress photos | MISSING observed application Storage/photo infrastructure |
| Offline transactional sync | MISSING observed gateway/revision/receipt/feed infrastructure |
| Account deletion/recovery | UNVERIFIED implementation; no demonstrated 30-day lifecycle/backend purge |

This coverage does not invent absent column definitions. Recover the complete schema evidence before selecting each exact extension.

## PROPOSED CHANGES — Not Approved for Execution

1. Recover a reproducible baseline including columns, defaults, keys, constraints, indexes, policies, grants and applicable function/trigger definitions. Reconcile live migration history before adoption; never reset production to create a baseline.
2. Narrow excessive authenticated privileges using a separately reviewed migration and isolated tests, preserving working authentication/profile queries and ownership foreign keys.
3. Design the GT-013 shared catalogue/personal identity transition without relabelling existing history or removing private ownership.
4. Extend workout domain contracts for stable IDs, input units, immutable-at-use snapshots, timing, explicit completion/advancement, history edits and deletion. Relevant rotation recalculation remains required; its exact qualifying rules remain open.
5. Design GT-014/GT-015 transactional synchronisation, expected revisions, idempotency, preserved conflicts and stale-device recovery. Exact privilege model and protocol are not finalised.
6. Design private Storage and ownership-aware media records in relevant later phases; retain originals. Do not assume a 30-day photo retention rule.
7. Design account recovery and reliable final removal before Phase 5, accounting for backend authorisation and media cleanup.

## Approval and Verification Boundary

See [Phase 0 draft](plans/PHASE_0_FOUNDATION_DRAFT.md). No SQL/migrations are included here. Any future schema capture or database testing requires separately authorised access; production changes require reviewed migration scope and approval. Cross-account and reassignment tests must run in isolation before gateway production use. Protect existing data and obtain a recovery method before changes. No account, photo or workout deletion is authorised by planning.


## Integrated contracts ? verified 2026-10-16

Migrations 20261010_02/03 and 20261011_01 through 10 are applied to the existing project through authorized SQL Editor transactions. They add private references, atomic workout revisions/retry receipts, optional targets/group metadata, owned device keys, weekly targets, measurement/private media records, incomplete classification, exact numeric storage and explicit exercise preferences. Rollback-only owner/isolation/replay checks passed. No real workout completions or catalogue edits were created for testing. Purge service contracts are applied; the scheduled worker is not deployed or enabled. See APPLICATION_IMPLEMENTATION.md and ACCOUNT_RECOVERY_BACKEND.md for verification limits.
