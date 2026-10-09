---
name: gym-database
description: "Use when designing, reviewing, migrating or troubleshooting the Gym Tracker Supabase PostgreSQL database, Row Level Security policies, private Storage buckets, data relationships and synchronisation metadata. Inspect verified schema state, prepare safe migrations, preserve historical workout data and validate database privacy and integrity."
---

# Gym Tracker Database Engineering

## 1. Establish Verified Database State

- Review relevant requirements in `docs/MASTER_SPEC.md`.
- Consult `docs/DATABASE.md` when available.
- Inspect existing local migrations and application database types.
- Inspect the live Supabase database only through an available, authorised connection.
- Clearly distinguish verified live schema from local files and documentation.
- Never invent table names, relationships, policies or migration history.
- Never print secrets, service-role credentials or connection strings containing passwords.

Report missing documents, migrations, types or unavailable live access as limitations. Do not treat user-supplied schema descriptions as independently verified live state.

## 2. Design Database Changes

- Identify the smallest schema change that satisfies the approved requirement.
- Prefer versioned SQL migrations.
- Define tables, columns, constraints, indexes and relationships explicitly.
- Determine ownership boundaries for shared catalogue data and private user data.
- Apply appropriate Row Level Security.
- Ensure users cannot access another user's private records.
- Use private Storage buckets and ownership-aware policies for progress photos.
- Preserve historical workout records and immutable snapshots of machine settings.
- Consider offline synchronisation, stable UUIDs, idempotency and revision-based conflict protection.
- Assess the impact of schema changes on existing queries and TypeScript types.

## 3. Prepare a Migration Plan

Follow `docs/PLANS.md` for substantial changes.

Include:

- Current verified schema state
- Objective and approved requirements
- Proposed schema changes
- SQL migration strategy
- Backward compatibility
- Data migration or backfill requirements
- RLS and privacy implications
- Deployment order
- Validation queries and tests
- Rollback strategy
- Risks and approval requirements

Do not execute a migration simply because it has been written.

## 4. Implement Only After Approval

- Apply only explicitly authorised schema changes.
- Prefer locally reviewed migration files over ad hoc production SQL.
- Do not drop tables or columns without explicit approval.
- Do not reset or truncate data.
- Do not weaken RLS to bypass application errors.
- Do not expose private Storage files publicly.
- Preserve existing authentication and profile functionality.
- Coordinate TypeScript type regeneration and application changes when necessary.

Respect the environment-setup and audit approval boundaries in `AGENTS.md`. Approval to inspect, design or prepare a migration does not itself authorise applying it.

## 5. Validate

Where authorised and feasible, verify:

- Migration application status
- Schema structure and constraints
- Foreign-key relationships
- RLS policy behaviour
- Cross-user access restrictions
- Private Storage access restrictions
- Relevant application queries
- Historical data preservation
- Synchronisation safety

Do not claim that a migration or security test passed without running it. Distinguish passed, failed and not-run checks, and label earlier evidence as historical.

## 6. Document and Handoff

Update `docs/DATABASE.md` with verified architectural information and migration changes. If it is missing, report that limitation and create it only within the authorised documentation scope.

Record significant approved database decisions in `docs/DECISIONS.md`.

Update `docs/CURRENT_STATE.md` with actual implementation and test status.

Provide a concise report containing:

1. Database task
2. Verified starting state
3. Files and resources changed
4. Migrations prepared or applied
5. Tests performed
6. Remaining risks
7. Recommended next action

Use `gym-handoff` at `.agents/skills/gym-handoff/SKILL.md` when preparing a substantial session handoff.

## Safety

- No destructive operations without explicit approval.
- No changes to live Supabase resources during a read-only audit.
- Never expose secrets.
- Never silently modify historical workout data.
- Never treat a successful SQL statement as proof that all security policies are correct.
- Never claim that undocumented or inaccessible resources were verified.
