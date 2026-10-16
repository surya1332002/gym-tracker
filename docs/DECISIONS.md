# Gym Tracker — Product and Architecture Decisions

Recorded: 2026-10-08

Approved means a decision is confirmed, not implemented. Dates below record this log entry, not an inferred original approval date. [MASTER_SPEC.md](MASTER_SPEC.md) governs conflicting product requirements; [ORIGINAL_REQUIREMENTS.md](ORIGINAL_REQUIREMENTS.md) remains historical supporting context.

## GT-001 — Requirement Authority

- **Decision ID:** GT-001
- **Date:** 2026-10-08
- **Topic:** Document precedence.
- **Final decision:** MASTER_SPEC.md takes precedence over ORIGINAL_REQUIREMENTS.md for conflicting requirements.
- **Rationale or source:** Explicit user instruction during documentation standardisation and this documentation task; master Step 3 states that the master is the source of truth.
- **Superseded alternative:** Treating the earlier document's authority statement as overriding newer decisions.
- **Status:** Approved.

## GT-002 — Flexible Weekly Targets

- **Decision ID:** GT-002
- **Date:** 2026-10-08
- **Topic:** Weekly training targets.
- **Final decision:** Targets are adjustable for current and future weeks; completed historical weeks remain locked. Adherence uses each week's target. Routine rotation remains independent.
- **Rationale or source:** Master section 6.2 and explicit approved decision list.
- **Superseded alternative:** Original requirements section 20 excludes broader weekly workout goals.
- **Status:** Approved.

## GT-003 — Muscle-Group Set Credit

- **Decision ID:** GT-003
- **Date:** 2026-10-08
- **Topic:** Working-set attribution.
- **Final decision:** Completed working sets count towards the primary muscle group only. Secondary muscles receive no additional set credit.
- **Rationale or source:** Master section 6.1 and explicit approved decision list.
- **Superseded alternative:** Original requirements section 19.3 considers primary and secondary muscles in distribution calculations.
- **Status:** Approved.

## GT-004 — Focused Workout Layout

- **Decision ID:** GT-004
- **Date:** 2026-10-08
- **Topic:** Focused mode.
- **Final decision:** Display one exercise at a time with all its sets visible simultaneously, using the same live data as overview mode.
- **Rationale or source:** Master section 4.3 and explicit approved decision list.
- **Superseded alternative:** Original requirements section 7.2 describes a current-set-focused interface.
- **Status:** Approved.

## GT-005 — Approved Phase Order

- **Decision ID:** GT-005
- **Date:** 2026-10-08
- **Topic:** Implementation roadmap.
- **Final decision:** Follow Phase 0 Foundation and Database; Phase 1 Workout Engine; Phase 2 Exercise Library; Phase 3 Strength Analytics; Phase 4 Body and Photos; Phase 5 Profile, Export and Security; Phase 6 Integration and Release Testing.
- **Rationale or source:** Master Step 2 and explicit approved roadmap in this task.
- **Superseded alternative:** Original requirements section 32's Phase 1–7 sequence.
- **Status:** Approved.

## GT-006 — Incremental Implementation

- **Decision ID:** GT-006
- **Date:** 2026-10-08
- **Topic:** Development workflow.
- **Final decision:** Use small, approved, tested implementation steps and review each phase before proceeding. Do not build the entire specification in one operation.
- **Rationale or source:** Master section 9 and Step 3; AGENTS.md Development Rules and Implementation Workflow; explicit approved decision list.
- **Superseded alternative:** A single unreviewed full-application implementation.
- **Status:** Approved.

## GT-007 — Instructions and Persistent Context

- **Decision ID:** GT-007
- **Date:** 2026-10-08
- **Topic:** Project memory.
- **Final decision:** Use root AGENTS.md for project instructions and separate project documents for persistent implementation context. CURRENT_STATE.md is the primary development handoff record.
- **Rationale or source:** AGENTS.md Project Documentation and Session Continuity; explicit instructions in this task.
- **Superseded alternative:** No alternative selected; conversational assumptions must not replace verified repository state.
- **Status:** Approved.

## GT-008 — Existing Workout Migration

- **Decision ID:** GT-008
- **Date:** 2026-10-08
- **Topic:** Legacy localStorage data.
- **Final decision:** Existing localStorage workout data does not require migration. This does not authorise deleting or modifying that data during environment setup.
- **Rationale or source:** Master section 1; original requirements sections 1, 24.3 and 31; explicit approved decision list.
- **Superseded alternative:** Mandatory migration of the previous localStorage workout dataset.
- **Status:** Approved.

## GT-009 — Preserve Working Authentication

- **Decision ID:** GT-009
- **Date:** 2026-10-08
- **Topic:** Rebuild compatibility.
- **Final decision:** Preserve existing working authentication and Supabase setup during the rebuild.
- **Rationale or source:** Original requirements section 25.1; explicit instructions and approved decision list in this task. Master section 2 retains Supabase email/password authentication with confirmation.
- **Superseded alternative:** No approved replacement of the working setup.
- **Status:** Approved.

## GT-010 — Confirmed UI Governs the Rebuild

- **Decision ID:** GT-010
- **Date:** 2026-10-08
- **Topic:** Product interface authority.
- **Final decision:** Follow confirmed UI decisions rather than treating the existing workout interface as the approved design.
- **Rationale or source:** Master sections 1 and 9; AGENTS.md Project; explicit approved decision list.
- **Superseded alternative:** Recreating the previous interface as the product design constraint.
- **Status:** Approved.

## GT-011 — Engineering Choices Awaiting Approval

- **Decision ID:** GT-011
- **Date:** 2026-10-08
- **Topic:** Unresolved engineering choices.
- **Final decision:** Not selected. Keep these choices Open until relevant planning and approval: exercise catalogue ownership/provider and media licensing; exact database migrations; synchronisation revision/conflict strategy and whether a worker/service is needed; global state approach; charting library; image processing/caching; photo limits; test tooling and deployment arrangements.
- **Rationale or source:** Original requirements section 35 identifies unresolved implementation choices; master Step 3 calls for inspection and planning before modifications. Existing tools/configuration are evidence to inspect, not automatic approval of a final architecture.
- **Superseded alternative:** None. No implementation technology is selected by this log.
- **Status:** Open.

No additional engineering decision or unresolved product conflict is silently settled here. Report newly discovered conflicts for review; apply GT-001 where the master expressly resolves them.

## Architecture Approval Update — 2026-10-09

The user approved Step 6D reconciliation and explicitly authorised recording D1–D6 below. These entries partially supersede the open list in GT-011; its remaining provider, licensing, protocol, tooling and implementation questions remain open. Approval of a direction is not implementation approval. Step 6C recommendations are not approved wholesale.

### GT-012 — Frontend and Local Persistence Direction (D1)

- **Date:** 2026-10-09 (recorded).
- **Status:** Approved direction; implementation pending.
- **Decision:** React Router, Dexie with IndexedDB, and feature-based React architecture.
- **Source:** Explicit user approval D1; MASTER_SPEC sections 2 and 8; compatible ORIGINAL_REQUIREMENTS sections 24 and 27.
- **Remaining engineering details:** Repository contracts, state boundaries, folder layout, dependency versions and whether another state library is necessary.
- **Supersedes:** GT-011 only insofar as these technologies and architectural direction were previously open.

### GT-013 — Catalogue and Personal Exercise Identities (D2)

- **Date:** 2026-10-09 (recorded).
- **Status:** Approved direction; implementation pending.
- **Decision:** Shared exercise catalogue with separate personal exercise identities. Private custom exercises and personal settings remain account-owned.
- **Source:** Explicit user approval D2; MASTER_SPEC sections 5.1, 5.3–5.5 and 8; compatible ORIGINAL_REQUIREMENTS section 28.3.
- **Remaining engineering details:** Catalogue provider/licensing, mapping and versioning, archival behaviour and historical references. Stable references and snapshots are proposed implementation techniques, not an approved exact schema.
- **Supersedes:** Catalogue ownership uncertainty in GT-011; does not select a provider or media rights.

### GT-014 — Restricted Transactional Sync Gateway (D3)

- **Date:** 2026-10-09 (recorded).
- **Status:** Approved direction; implementation pending.
- **Decision:** Offline-to-Supabase writes use a restricted transactional synchronisation gateway, with isolated security testing before production use.
- **Source:** Explicit user approval D3; MASTER_SPEC sections 2 and 8; compatible ORIGINAL_REQUIREMENTS sections 24 and 28.4.
- **Remaining engineering details:** Privilege model, hosting/execution mechanism, transaction validation, revisions, receipts, change feed and isolated test environment. No particular definer/invoker function, writer role or Edge implementation is approved.
- **Supersedes:** GT-011 gateway direction uncertainty only.

### GT-015 — Whole-Workout Conflict Resolution (D4)

- **Date:** 2026-10-09 (recorded).
- **Status:** Approved direction; implementation pending.
- **Decision:** Detect whole-workout conflicts, preserve both versions and require explicit user resolution. No silent overwriting.
- **Source:** Explicit user approval D4; MASTER_SPEC section 8; compatible ORIGINAL_REQUIREMENTS section 24.6.
- **Remaining engineering details:** Revision protocol, dependent-record boundaries, durable conflict storage and resolution UI. No unconditional last-write-wins or automatic destructive merge is approved.
- **Supersedes:** GT-011 conflict-resolution principle uncertainty, not its exact protocol.

### GT-016 — One Editing Tab per Workout (D5)

- **Date:** 2026-10-09 (recorded).
- **Status:** Approved direction; implementation pending.
- **Decision:** One browser tab edits a given workout; other tabs are read-only for that workout. Support safe takeover after closure/crash and revision checks.
- **Source:** Explicit user approval D5; MASTER_SPEC section 8.
- **Remaining engineering details:** Tab coordination, expiry, crash detection and takeover UX. This does not make other tabs read-only for the entire application and is distinct from the one-primary-active-strength-workout account rule.

### GT-017 — Trusted-Device Offline Access and Safe Logout (D6)

- **Date:** 2026-10-09 (recorded).
- **Status:** Approved direction; implementation pending.
- **Decision:** Trusted-device offline continuation with secure local unlock, account-isolated data, and logout preserving unsynchronised changes unless explicitly discarded by the user.
- **Source:** Explicit user approval D6; MASTER_SPEC sections 2, 7.5 and 8; compatible ORIGINAL_REQUIREMENTS sections 24 and 25.4.
- **Remaining engineering details:** Encryption/unlock mechanism, key lifecycle, recovery, expiry and trust revocation. A UI-only lock is not evidence of secure local unlock. Offline continuation does not authorise bypassing server authentication.

## Approved Step 6D Reconciliation

Product behaviour must not be reopened as an architecture preference: MASTER_SPEC sections 4.1, 4.3, 4.5–4.6, 6.2 and 7.5 settle completion-based PPL, incomplete-session choices, pause-aware editable duration, workout trash and account recovery. Compatible ORIGINAL_REQUIREMENTS sections 6.5 and 7.4 require no unexpected custom-workout advancement and one primary active strength workout per user.

ORIGINAL_REQUIREMENTS section 15.4 requires recalculation of relevant rotation state after historical changes. The Step 6C recommendation for no automatic rotation recalculation is not approved. Exact qualifying edit/deletion/restoration semantics remain open before history implementation. Completed sets in incomplete sessions remain eligible for relevant performance calculations (original section 15.2).

The 30-day workout-trash window and 30-day account-recovery window do not establish photo-trash or sync-metadata retention. Progress-photo originals must be preserved (master section 6.5). There are no further product answers required merely to prepare the Phase 0 plan; task-specific engineering choices and implementation approval remain necessary.

### GT-018 — Red-and-Black Appearance Update

- **Date:** 2026-10-09.
- **Status:** Approved by the user's explicit visual-theme implementation request.
- **Decision:** Near-black backgrounds, charcoal cards, vivid red primary actions and highlights, white text; coordinated red-accented light mode with persistent Light/Dark/System support. Preserve the approved shell layout.
- **Source:** Latest user instruction for this milestone expressly supersedes the Forest Teal accent in MASTER_SPEC section 7.3 for appearance only. MASTER_SPEC itself remains unchanged; no other product behaviour or GT-012–GT-017 direction changes.
- **Implementation:** Separate accessible text-accent colours from the primary action red. No catalogue provider, media licence or personal exercise schema is selected by this milestone.


## Integrated milestone decisions ? 2026-10-16

Retain red/black ARC FIT navigation and the approved compact tile/day flows. Optional targets remain NULL; recorded canonical loads retain precision. Exercise identity and original snapshots survive replacement/editing. Encrypt account-scoped device workout/draft/outbox/conflict payloads with independent record authentication; fail closed when trusted keys cannot be recovered. Internal replay receipts/device keys are excluded from exports. Preserve pinned public dataset bytes across Windows checkout. Do not enable deletion or AI UI actions before their backend capabilities are configured and verified. No production deployment authorized.
