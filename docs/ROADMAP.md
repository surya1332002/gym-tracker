# Gym Tracker — Development Roadmap

Updated: 2026-10-09

Source: [MASTER_SPEC.md](MASTER_SPEC.md), Step 2. This approved Phase 0–6 sequence supersedes the older sequence in [ORIGINAL_REQUIREMENTS.md](ORIGINAL_REQUIREMENTS.md), section 32. Phase completion requires the allocated features, relevant database migrations, a demonstrated working UI and successful relevant tests. The acceptance criteria below translate the master requirements into review checkpoints; they do not report completed implementation.

Allowed status values: Not Started, In Progress, Blocked, Completed.

## Environment Setup — Separate from Implementation

- **Status:** Completed.
- **Evidence:** User confirms all four project skills and specialist subagents passed functional tests and are approved. Earlier In Progress status is retained as historical context in CURRENT_STATE.md; tests were not repeated during this documentation task.
- **Scope:** Project instructions, authoritative documents, handoff records, planning standards, project skills and supported subagent workflows.
- **Dependencies:** Approved specifications and preservation of existing worktree changes.
- **Acceptance criteria:** Documentation and workflow configuration are reviewed and approved; supported skills and delegation workflows are validated; permission boundaries and the next audit scope are agreed.
- **Boundary:** Environment setup completion is not blanket rebuild approval. Step 6G and the separately authorised responsive shell milestone are complete; further implementation requires separately approved scope.

## Phase 0 — Foundation and Database

- **Status:** In Progress. Step 6G/P0-L1 and the responsive shell milestone delivered. This does not approve the entire plan or establish phase completion.
- **Visible shell milestone:** Five protected React Router routes, mobile bottom navigation/desktop sidebar, browser-persistent Light/Dark/System, preserved auth/profile flow, explicit placeholders and future workout access. Seven profile tests, four shell/worker tests, typecheck and production build pass; isolated mocked-auth browser navigation/theme/mobile/logout checks performed. Live auth and deployed worker/hosting lifecycle not verified. Remaining database, domain, encrypted persistence, tab coordination and sync units pending; U1 delivered within this milestone scope, U2 only partially verified (deployment/update lifecycle pending).
- **Planning status:** In Progress. [Revised Draft Foundation plan](plans/PHASE_0_FOUNDATION_DRAFT.md) remains DRAFT / AWAITING REVIEW. Step 6F verdict READY WITH CHANGES; approved review corrections applied as documentation only.
- **Completed narrow task:** Step 6G added `"test": "node --test tests/profiles.test.mjs"` and executed `npm.cmd run test`: 7/7 mocked profile-helper tests passed, zero failed, exit 0. esbuild remains transitive; auth UI, live RLS and workout recovery are not verified by these tests. No other Phase 0 implementation task is complete.
- **Revised sequence:** Local tooling (L1 complete, L2/L3 pending) is independent of schema evidence (E1), isolated target/reproduction (D1/D2), privilege preparation/verification (D3/D4). Consumer-sized contracts (C1–C3), shell/worker checks (U1/U2), key design/proof (K1/K2), protocol design (S1), protected persistence (P1–P3), editor coordination (T1), gateway/client/integration (S2–S4) and acceptance (A1) follow their gates. Production adoption/deployment (R1) requires separate authorisation. See the draft for the dependency order; no full domain prerequisite for shell and no database prerequisite for local tests.
- **Discovery milestones:** Step 6A local audit and Step 6B Supabase audit completed and approved; Step 6C proposal reviewed but not fully approved; Step 6D reconciliation approved. Six approved architecture directions are GT-012–GT-017 in DECISIONS.md. See ARCHITECTURE.md and DATABASE.md for draft design and historical evidence limitations.
- **Scope:** Review existing React/Supabase implementation, live schema and policies, migrations, reusable components, responsive navigation, authentication and themes. Establish the approved foundation and database changes for the master specification while preserving working authentication.
- **Dependencies:** Approved environment setup; separately authorised repository/database audit; access to verified live schema and policies; approved Phase 0 plan and architecture decisions.
- **Acceptance criteria:** Audit findings and implementation boundaries reviewed; required schema changes represented as migrations; approved responsive navigation and Light/Dark/System foundation demonstrated; authentication remains functional; relevant checks pass. No claim of completion based only on existing setup.

## Phase 1 — Workout Engine

- **Status:** Not Started.
- **Scope:** Routine builder, completion-based PPL A/B rotation, overview and focused logging, previous performance, exercise replacement, machine presets and historical snapshots, grouped exercises, duration, offline autosave, completion flow and workout history. Standalone cardio belongs to the Workout area and must be included in the phase plan rather than silently omitted.
- **Dependencies:** Phase 0 foundation and approved domain/schema contracts. Coordinate catalogue interfaces with Phase 2 without assuming its full library already exists; approve how exercises are selected for Phase 1.
- **Acceptance criteria:** Users can build routines and log a workout in both modes using the same state; focused mode shows all sets for one exercise; refresh/offline recovery preserves work; completed sets retain original exercise attribution; duration excludes pauses; incomplete-session advancement is explicit; history can be viewed and explicitly edited; relevant persistence and calculation tests pass.

## Phase 2 — Exercise Library

- **Limited milestone delivered:** Five-entry local starter library, search, muscle/equipment filters, detail routes and explicit unavailable metadata; red theme approved as GT-018. Six exercise tests, four existing shell tests, seven profile tests, typecheck/build and isolated responsive browser checks passed. Full phase requirements remain pending; this does not complete Phase 2 or bypass unfinished foundation/security work.

- **Status:** In Progress.
- **Scope:** Verified catalogue and permitted media, muscle-group categories, search, favourites/recent items, compact lists, guides, private custom exercises, per-exercise units and increments, machine media and exercise history.
- **Dependencies:** Phase 0 security/schema foundation; Phase 1 workout and exercise contracts; approved dataset, ownership model and media rights.
- **Acceptance criteria:** Users can find and select catalogue/custom exercises; Guide, My Settings and History tabs work; media has verified sources and fallbacks; first-use unit/increment preferences persist; preference changes preserve historical loads; private exercises/media respect ownership; relevant tests pass.

## Phase 3 — Strength Analytics

- **Status:** Not Started.
- **Scope:** Progression charts, personal records, volume, primary-muscle working sets, consistency, flexible weekly targets, adherence, evidence-based insights and optional user-requested AI coaching.
- **Dependencies:** Accurate Phase 1 logs and historical editing; Phase 2 exercise metadata; approved calculation rules and, if needed, AI service/privacy choices.
- **Acceptance criteria:** Charts and PRs use actual completed performance and remain correct after edits; only primary muscles receive set credit; historical weekly targets stay locked while current/future targets are adjustable; rotation remains independent of weekly targets; AI runs only on explicit request and cannot automatically change training data; relevant calculation tests pass.

## Phase 4 — Body and Photos

- **Status:** Not Started.
- **Scope:** Fast weigh-ins, optional/custom measurements, paired left/right measurements, precision-preserving units, optional rolling average, trends and dated history, private photo check-ins, side-by-side/overlay comparisons and manual alignment.
- **Dependencies:** Phase 0 ownership/security foundation; approved measurement model, private storage design and upload limits; relevant chart interfaces from Phase 3.
- **Acceptance criteria:** Weight and measurements can be logged and explicitly corrected; conversions preserve precision; charts use saved records; dated photo check-ins support independent views and editing; comparison zoom/pan/crop does not destructively alter originals; private access and relevant tests pass.

## Phase 5 — Profile, Export and Security

- **Status:** Not Started.
- **Scope:** Personal information and fitness summary, training preferences, appearance, data/privacy and account settings; CSV datasets, complete ZIP backup with JSON and original photos; supported session controls; account deletion/recovery with a 30-day window and backend final removal. Workout Recently Deleted retention must be retained and verified across phases.
- **Dependencies:** Earlier phase data models and ownership rules; preserved working authentication/profile setup; approved account lifecycle, export and backend-processing design.
- **Acceptance criteria:** Required settings persist without changing historical measurements; uncertain training-experience estimates are labelled; exports contain expected user data and original photos; backup restoration is excluded from initial scope; account recovery and final deletion are demonstrated with relevant safeguards; ownership/session tests pass.

## Phase 6 — Integration and Release Testing

- **Status:** Not Started.
- **Scope:** Cross-screen consistency, mobile/desktop QA, offline recovery, permissions, empty/loading/error states, accessibility, performance and final regression testing.
- **Dependencies:** Phases 0–5 accepted; complete requirement traceability, suitable test data and approved release criteria.
- **Acceptance criteria:** Critical end-to-end workflows run successfully; offline/reconnect and competing edits do not lose or duplicate records; private data/media access is verified; UI follows confirmed decisions on mobile and desktop; calculation/integration/regression checks pass; remaining issues and release readiness are explicitly reviewed.
