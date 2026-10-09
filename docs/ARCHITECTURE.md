# Gym Tracker — Draft Architecture

**Status: DRAFT / AWAITING REVIEW.** Recorded 2026-10-09. Approved directions are GT-012–GT-017 in [DECISIONS.md](DECISIONS.md); the implementation design below is proposed and has not been authorised for execution.

## Authority and Evidence

Priority: [MASTER_SPEC.md](MASTER_SPEC.md), explicit architecture approvals, compatible [ORIGINAL_REQUIREMENTS.md](ORIGINAL_REQUIREMENTS.md), then engineering recommendations. See [DATABASE.md](DATABASE.md) for historical Step 6B evidence and limitations and [Phase 0 draft](plans/PHASE_0_FOUNDATION_DRAFT.md) for implementation gates.

Step 6A and Step 6B were completed and approved according to the user's explicit handoff. Complete audit transcripts are not saved in this repository. Local foundation facts were re-inspected for this documentation task; database findings were recovered from the original database reviewer without new database access. Step 6C was reviewed, not fully approved. Step 6D reconciliation is approved.

## Current Local Foundation — Source Inspected

- `src/main.tsx` mounts StrictMode and `src/auth/AuthGate.tsx`; the latter renders the legacy `src/App.tsx` after authentication.
- `src/auth/AuthGate.tsx` implements signup, confirmation/resend, password login, session restoration and local-scope logout. Preserve its useful behaviour; secure offline continuation is not implemented by this gate.
- `src/lib/profiles.ts` validates matching sessions and response ownership, loads profiles by ID, inserts only the UUID when missing and handles duplicate creation with a reread. `src/auth/ProfileStatus.tsx` provides the existing profile presentation.
- `src/App.tsx` contains the legacy four-tab UI, workout/exercise handling and unscoped `wt_*_v1` localStorage keys. It uses `@ts-nocheck`, short random identifiers and UTC-derived day strings. These are replacement risks, not approved new domain contracts.
- `public/service-worker.js` provides a basic cache-first fetch handler, registered from main with swallowed registration errors. This does not establish reliable offline workout restoration, cached release coherence or account isolation.
- `tests/profiles.test.mjs` contains seven Node test-runner cases with mocked Supabase and esbuild bundling. They test profile control flow, not live RLS or workouts. `package.json` has build/typecheck/dev/preview scripts, no test script, React 19, TypeScript 5.8, Vite 7 and Supabase JS 2.117.3. React Router and Dexie are approved but not installed.

No application tests, build or browser checks were run for this documentation task. No local SQL migrations or generated database types were found in the repository inventory. No Fitbit backend was found; legacy API calls do not establish a working integration or a rebuild requirement.

## Proposed React Structure and Shell

GT-012 approves feature architecture, not exact directory names. Proposed responsibilities:

| Area | Responsibility |
|---|---|
| `src/app/` | Router, providers, responsive shell, theme, route/error boundaries |
| `src/features/auth/` or retained `src/auth/` | Existing authentication integration plus explicitly designed trusted-device states |
| `src/features/home/` | Dashboard from actual data, no fabricated metrics |
| `src/features/workouts/` | Routines, rotation, shared workout presentation, history and standalone cardio |
| `src/features/exercises/` | Catalogue, personal identities, custom exercises, guides and presets |
| `src/features/progress/` | Strength, body and photo screens |
| `src/features/profile/` | Settings, exports and account lifecycle |
| `src/domain/` | Typed identities, validation and pure calculations |
| `src/data/` | Repository contracts, Dexie adapter, queue and sync adapter |
| `src/lib/` | Preserved Supabase/profile helpers and shared utilities |

React Router provides Home, Workout, Exercises, Progress and Profile routes (master section 2). Mobile bottom navigation and desktop sidebar share one route model. An accessible active-workout entry remains visible across routes. Light/Dark/System themes use Forest Teal. Initial route scaffolds are not evidence that later-phase modules are implemented. `UI_DESIGN.md` is absent; detailed typography/layout must not be invented as confirmed design.

## Shared Workout State and Domain Boundaries

Overview and Focused views read the same live workout state; Focused shows all sets of one exercise (master section 4.3). Proposed commands validate changes, persist them locally and expose durable save status. UI selection, expanded cards and transient input composition are separate from saved domain records. Show persistence failures explicitly; never report saved before durable commit.

Proposed aggregate: session, ordered exercise instances, stable set identities, group/round membership, notes, original load/unit, canonical calculation values, machine snapshots, persisted duration intervals, completion and explicit advancement decisions. Exact schema is open. Routine and preset edits must not rewrite historical attribution. Replacements preserve already completed sets under their original movement.

Confirmed behaviour: one primary active strength workout per account; PPL advances through qualifying completion, not rest; incomplete finish choices are explicit; custom workouts do not unexpectedly advance PPL. Duration excludes pauses and permits correction. Historical saves recalculate dependent statistics and relevant rotation state. Exact historical deletion/restoration effects remain open; do not implement the rejected blanket no-recalculation recommendation.

## Authentication and Ownership

Preserve Supabase email/password confirmation and profile compatibility (GT-009). Proposed access states distinguish online authenticated, trusted-device offline unlocked, locally locked, and signed out. The exact state machine requires review. GT-017 requires secure unlock and account-isolated storage; UI hiding alone is insufficient. No encryption/key mechanism is finalised.

Every local read/write and queued operation must be bound to its account; switching accounts must not reuse another account's repositories or queue. Logout preserves unsynchronised work unless explicitly discarded and denies casual access to locked data. Reconnection revalidates server authorisation; cached identity is not authority for server writes. Shared catalogue entries and private personal identities have separate ownership (GT-013).

## Dexie and Offline Persistence

Dexie manages IndexedDB records, versioned upgrades and durable queued changes. Proposed local transactions atomically persist an edit and its pending sync intent. Stable client UUIDs, not legacy short IDs, are recommended for new records. Retain input precision and intended local dates; do not derive workout dates solely from UTC slicing.

The queue survives refresh/closure, retries transient failures and exposes saved-locally/syncing/synced/offline/error states. Recovery must handle quota or transaction failure. Browser storage can be cleared or evicted; do not describe it as a backup. Existing localStorage data need not be migrated, but no deletion is authorised by that requirement.

Remote guides/uploads may wait for connectivity; do not imply uncached content works offline. App-shell caching and installability are separate from durable workout persistence; review the existing worker's cache/update strategy before shipping the new shell.

## Transactional Sync and Conflicts

GT-014 approves a restricted transactional gateway and isolated security testing. Proposed request contracts include account identity, stable operation identity, expected revision and validated aggregate changes. The server should apply an authorised aggregate transaction or reject it without partial writes. Receipts/revisions/change feeds/tombstones are proposed concepts; their representation and retention are not finalised.

GT-015 requires whole-workout conflict detection, durable preservation of both versions and explicit resolution. Do not silently overwrite, destructively merge or erase queued edits after a conflict. Competing offline starts must preserve work while resolving the account's primary active session. Exact resolution UI and protocol are open.

Gateway privileges, execution mechanism, replay window, stale-device recovery and deletion propagation require reviewed designs and isolated tests. No service-role credentials belong in browser code. No production gateway is authorised by this draft.

## One Editor per Workout

GT-016 scopes exclusivity to a given workout. Other tabs can navigate and use unrelated features, but display that workout read-only. Safe takeover after closure/crash must validate ownership and current revisions. The proposed coordinator must tolerate a suspended or stale former editor; a tab's belief that it owns a lock is insufficient. Mechanism, expiry and crash semantics remain open.

## Testing Boundaries and Deferred Work

Master sections 8–9 and original section 33 require calculation, critical workflow, integration and user-flow tests. Existing mocked profile tests cannot prove authentication UI, database isolation or offline safety. Proposed tools are Vitest/RTL, IndexedDB simulation and Playwright, subject to compatibility review and approval; they are not selected by D1.

Foundation acceptance should cover atomic persistence/queue intent, restoration, account switching, safe logout, tab takeover, replay idempotency, revision conflicts and cross-account rejection in an isolated environment. Database role and Storage tests must use appropriate nonprivileged identities; metadata inspection or an administrative/read-only role is not proof of user isolation.

Full workout UI, catalogue content/licensing, analytics, media quotas/processing, export and account deletion remain in their roadmap phases. Private media originals must be preserved. Workout trash and account recovery each require 30 days; photo and protocol retention are separate open questions.
