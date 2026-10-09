# Phase 0 — Foundation and Database

**DRAFT / AWAITING REVIEW — revised after Step 6F, 2026-10-09.** The entire Phase 0 plan is not approved for blanket implementation. Only Step 6G's separately authorised local profile-test script task is complete. Every other implementation task below is pending. This revision authorises no installation, migration, database access or further implementation.

## 1. Objective

Establish a reproducible, maintainable, offline-first React/Supabase foundation with protected account data, preserved authentication/profile handling and a responsive shell. Deliver small independently reviewable tasks, not a full rebuild.

## 2. Relevant Specification References

[MASTER_SPEC.md](../MASTER_SPEC.md): sections 1–2, 4.1–4.6, 5.3–5.5, 6.2/6.5, 7.4–7.5, 8–9 and Step 2. Compatible [ORIGINAL_REQUIREMENTS.md](../ORIGINAL_REQUIREMENTS.md): sections 6.5, 7.4, 8.6, 13, 15.2/15.4, 24–25, 28–30 and 33. [DECISIONS.md](../DECISIONS.md): GT-001–GT-010 and GT-012–GT-017. [ARCHITECTURE.md](../ARCHITECTURE.md) and [DATABASE.md](../DATABASE.md) contain draft boundaries and evidence limitations. This plan follows [PLANS.md](../PLANS.md).

## 3. Current Verified Implementation State

Source inspection: main mounts AuthGate and legacy App; authentication/profile helpers exist; workout storage is unscoped localStorage. Router/Dexie are approved but not installed. No local migration baseline or generated database types were found.

Step 6F independent review completed with verdict READY WITH CHANGES; this draft applies its approved corrections without approving the complete plan. Step 6G completed only the package script `"test": "node --test tests/profiles.test.mjs"`. The exact command `npm.cmd run test` discovered 7 tests, passed 7, failed 0 and exited 0. Tests mock Supabase and bundle in memory; they cover profile-helper control flow only, not auth UI, live RLS or workout persistence. esbuild is supplied transitively; reproducible direct dependency ownership remains an open tooling detail. No source, dependencies, lockfile or documentation changed in Step 6G; existing edits were preserved. These are actual Step 6G results, not tests rerun during this documentation revision.

Step 6F read-only checks observed Node v22.18.0, satisfying the existing lockfile ranges for Vite 7.1.7, Supabase JS 2.117.3 and esbuild 0.25.10. Recheck compatibility before adding new tools. Prefer the working `npm.cmd` launcher; PowerShell's npm launcher encountered an authorisation error during review.

The user confirms completed environment validation and approved Steps 6A/6B audits and 6D reconciliation. Step 6C was reviewed but not fully approved. Recovered historical Step 6B evidence includes ten owned tables, RLS/composite ownership relationships, excessive authenticated TRUNCATE grants, no observed shared catalogue/private media/sync infrastructure and baseline limitations. Exact retained definitions are incomplete: recover them before migrations, without inventing schema.

## 4. Scope and Explicit Exclusions

Proposed scope: evidence/baseline, least privileges, domain/repository contracts, test infrastructure, routes/themes/preserved auth, protected durable local transactions, tab coordination and isolated sync/security foundation.

Future phases: full workout engine/routines/history/standalone cardio (1), catalogue/media (2), strength analytics/AI (3), body/photos (4), export/full account lifecycle (5), release acceptance (6). Scaffolding does not implement those modules. Legacy data migration is unnecessary; deletion is not authorised. No rest timers, forced substitutions, automatic workout-data changes, global exercise increments, wearable requirement or backup restore is introduced.

## 5. Dependencies and Prerequisites

- Review/approval of this draft and separately scoped implementation tasks.
- Preserve existing modifications and browser/cloud data.
- Local profile testing and shell scaffolding do not require schema recovery or complete workout-domain implementation. Recover full schema evidence and decide baseline adoption before schema reproduction/migrations.
- Authorised isolated environment and synthetic accounts/data before security tests; no production cross-account testing.
- Review runtime/tool compatibility before dependencies are installed.
- Review gateway/protocol, secure unlock/key lifecycle and task-specific UI choices before affected tasks. No new product answer is needed simply to plan Phase 0.

## 6. Technical Approach

Approved product: five responsive routes/themes, one primary active strength workout, shared Overview/Focused data, completion-based rotation, explicit incomplete choices, pause-aware editable duration, history corrections and privacy. Approved directions: GT-012–GT-017.

Proposed implementation: feature modules over typed domain/repository interfaces; Dexie transactions atomically save edits and pending sync intent; stable UUIDs and revision contracts; restricted aggregate transactions preserve conflict copies. Exact folders/interfaces/schema/protocol/privileges/encryption remain proposals. Cached offline identity never authorises server writes. Preserve current RLS/composite ownership and profile insertion contracts.

## 7. Files Expected to Change in Future Approved Tasks

Potential paths only: package/lockfile, `src/main.tsx`, existing auth helpers, `src/app/`, `src/domain/`, `src/data/`, feature modules, shared CSS, test configuration and `tests/`. Future local Supabase configuration/migration paths depend on approved tooling/baseline design. Existing worker caching requires review. Documentation should reflect verified results after implementation. Skills/subagents are outside scope.

## 8. Database Changes — Proposed Only

Recover columns/defaults/keys/constraints/indexes/policies/grants/functions/triggers and reconcile migration history first. Proposed migrations address excessive grants and approved identity/workout/sync contracts. No executable SQL is included. Define compatibility, backfill, type regeneration, deployment and recovery for each task. Preserve UUID-only profile creation and ownership relationships. Never reset production to establish a baseline; production deployment needs separate approval.

## 9. Data Integrity and Privacy

Bind records, queues and operations to account identity. Account switching invalidates prior readers/writers. Logout preserves protected unsynced work unless explicitly discarded. Do not report saved before durable commit. Reject partial aggregate writes, duplicate replay and silent stale overwrites. Preserve original movement/preset attribution, units/precision and intended local dates. Completed sets in incomplete workouts still contribute relevant performance; history corrections recalculate relevant rotation. Thirty-day workout trash/account recovery do not define photo/protocol retention. Never use private content in fixtures/logs/public caches.

## 10. Implementation Steps and Recommended Order

The original P0-01–10 groups are superseded by the bounded units below. Approval of Step 6F corrections approves this documentation revision, not execution of these pending units. The table order is an understandable route through the work; independent tracks may proceed separately after their own approvals. Each task must declare its exact files/resources before execution. No task installs an entire speculative tool stack.

### Local tooling — independent of database recovery

| ID / status | Deliverable and dependencies | Acceptance / verification | Immediate approval gate and likely resources |
|---|---|---|---|
| P0-L1 COMPLETED (Step 6G) | Existing mocked profile test entry point; local Node/esbuild only | Exact `test` script and `npm.cmd run test`; 7/7 passed, exit 0; package-only insertion; no network/database | Already separately authorised and executed; `package.json` only |
| P0-L2 PENDING | Reproducible local test ownership and commands; depends only on L1/local compatibility | Review direct esbuild dependency policy and runtime; existing seven cases remain runnable; new fixture tests require a concrete consumer; no database prerequisite | Approve exact dependency/version/install scope if changed; package/lockfile/test configuration as separately scoped |
| P0-L3 PENDING | Incremental component/IndexedDB/browser harnesses when their consumers need them; after L2 | Each addition runs a relevant synthetic check; real-browser checks complement simulations; no live credentials | Select tools/versions per consumer; installation/browser downloads require scope approval; test config/tests |

### Database evidence, isolation, preparation and verification

| ID / status | Deliverable and dependencies | Acceptance / verification | Immediate approval gate and likely resources |
|---|---|---|---|
| P0-E1 PENDING | Recover complete historical schema artifacts; independent of local tooling | Provenance manifest and definitions satisfy section 11; missing evidence explicitly listed | Recover existing audit artifacts first. If unavailable, separately authorise metadata-only access with enforced read-only boundary; audit/docs artifacts |
| P0-D1 PENDING | Isolated database target and guarded security harness; after target design, not after complete application schema | Fail-closed production-target tests, separate fixtures/ordinary-user execution; section 11 isolation criteria | Approve local/disposable environment, versions, identifiers and synthetic-account setup; test configuration only for approved target |
| P0-D2 PENDING | Reproduce audited application baseline in isolation; after E1 and D1 | Object-level comparison, repeatable fresh setup, auth/profile defaults and migration provenance accounted for; managed objects separated | Approve baseline/adoption approach before preparing files; future baseline/config/type artifacts; no production replay |
| P0-D3 PENDING | Prepare least-privilege migration and effective privilege matrix; after D2 | Reviewed allow/deny matrix and compatibility/recovery plan; no production changes | Approve exact grant/default-privilege scope; migration preparation is a separate future authorisation |
| P0-D4 PENDING | Verify prepared migration and ownership regressions in isolation; after D3 | Denied TRUNCATE/other prohibited privileges, allowed profile operations, reassignment/cross-account rejection and recovery checks | Approve isolated execution only; synthetic fixtures and migration/security tests |

### Consumer-driven contracts and shell

| ID / status | Deliverable and dependencies | Acceptance / verification | Immediate approval gate and likely resources |
|---|---|---|---|
| P0-C1 PENDING | Minimal identity/ownership contracts; local test baseline; schema evidence before DB mappings | Separate catalogue/personal identities; stable new-record IDs; mismatched owner/parent rejected with synthetic cases | Review exact identity/mapping contract; domain types/tests, no comprehensive catalogue implementation |
| P0-C2 PENDING | Minimal synthetic workout aggregate/repository contract; after C1 | Session/exercise/set identity and ownership; explicit lifecycle/advancement representation; one-primary-session invariant accommodated | Review aggregate boundary and consumer needs; types/validation/tests only; no full routine/history UI |
| P0-C3 PENDING | Split value/snapshot contracts into separate consumer-sized changes; after C2 | Original/canonical units, local dates, pause intervals and machine attribution tested independently; template/preset edits cannot rewrite snapshots | Approve each concrete value contract; no unused future-feature repository scaffold; exact historical rotation semantics remain deferred |
| P0-U1 PENDING | Router/shell/themes and preserved online auth; local component harness, not full C2/C3 or schema recovery | Five mobile/desktop routes, keyboard/labels/states, Forest Teal Light/Dark/System; named auth regressions | Review Router/version/hosting and shell choices; app/main/auth/CSS; personal repository integration waits for P3 |
| P0-U2 PENDING | Worker update/deep-link/auth-callback verification; after U1/browser harness | Section 11 routing/cache criteria; prior release and new shell load coherently | Review caching/deployment strategy and route fallback; worker/hosting config/browser tests |

### Key management and protected local persistence

| ID / status | Deliverable and dependencies | Acceptance / verification | Immediate approval gate and likely resources |
|---|---|---|---|
| P0-K1 PENDING | Reviewed secure-unlock threat model and key lifecycle; independent of gateway implementation | Specify protection limits, key storage/unlock/recovery, expiry, revocation and lost-key behaviour; no UI-only-lock claim | Approve concrete mechanism before implementation; design record, no final mechanism chosen here |
| P0-K2 PENDING | Isolated key/unlock implementation proof with synthetic data; after K1/local harness | Locked reads denied, allowed recovery demonstrated, key lifecycle/expiry failures preserve protected pending data as designed | Approve bounded proof; key module/tests; never log keys or private records |
| P0-P1 PENDING | Local schema/transaction contract; after C2, required C3 slices, K1 and S1 | Atomic edit+queue representation and reviewed upgrades; no persistence schema incompatible with protocol/key design | Approve exact Dexie schema/encryption boundary and upgrade strategy; contracts/tests |
| P0-P2 PENDING | Protected Dexie transactions/restoration; after P1/K2/IndexedDB harness | Interrupted commit, quota failure, close/reopen and upgrade criteria in section 11 | Approve adapter scope/version; persistence modules/tests; synthetic records before production personal-data integration |
| P0-P3 PENDING | Auth/account switching and safe unsynced logout integration; after P2 and U1 | Account-A outstanding operations cannot reach B; secure logout/unlock/recovery assertions pass | Review exact access-state/async invalidation integration; auth/repository tests; preserve legacy keys without exposing unscoped data through new repositories |
| P0-T1 PENDING | Per-workout editor coordination; after P2/S1 and browser harness | Safe crash takeover, suspended former writer rejection and read-only scope assertions | Approve mechanism/expiry; coordinator/browser tests; independent of production gateway deployment |

### Sync protocol, gateway, adapter and integration

| ID / status | Deliverable and dependencies | Acceptance / verification | Immediate approval gate and likely resources |
|---|---|---|---|
| P0-S1 PENDING | Protocol/aggregate revision and operation contracts; after C2 and required C3 contracts, before P1/T1 | Reviewed replay identity, expected revisions, receipts/feed/tombstones, conflict preservation and stale-device recovery scenarios | Approve protocol/retention choices; design/types/contract fixtures; no gateway privilege mechanism selected implicitly |
| P0-S2 PENDING | Restricted gateway preparation and isolated proof; after S1/D4 and privilege design | Atomic validation, ownership rejection and bypass-prevention matrix; rejected aggregate and receipt unchanged | Approve gateway privilege/execution model and any migration preparation; isolated gateway/tests only |
| P0-S3 PENDING | Account-bound client queue adapter; after S2/P3/T1 | Retry/ack handling, token expiry and stale-account dispatch rejection; durable copies survive errors | Approve adapter contract; sync client/tests; no production endpoint enabled |
| P0-S4 PENDING | Isolated end-to-end sync/security verification; after S3 | Lost-response replay, stale revision, both conflict versions, explicit resolution and two-device starts meet section 11 | Approve synthetic integration scope; distinct nonprivileged users; no live cross-account tests |
| P0-R1 PENDING, SEPARATE AUTHORISATION | Production adoption/deployment only for explicitly approved changes; after relevant D4/S4/U2 and recovery evidence | Target/drift checks, staged compatibility, recovery method and post-deployment verification; no broad plan approval inferred | Separate approval naming project/resources/migrations and rollback; isolated success alone never authorises deployment |
| P0-A1 PENDING | Foundation integration/exit review; after all foundation units above except R1 only where deployment is applicable and separately approved | Unchanged section 12 exit criteria; executed checks, actual DB scope/UI and user acceptance; all limitations recorded | Explicit phase review; no scaffold counts as completed later-phase features |

Suggested execution: L1 (done) → L2; E1 and D1 form a separate evidence/isolation track → D2 → D3 → D4. C1/C2 and U1 can proceed on their own reviewed dependencies. Then needed C3 slices → S1; K1/K2 can progress independently. S1 and key decisions precede P1/P2 → P3/T1 → S2/S3 → S4. U2 precedes rollout; R1 is separate where applicable → A1. No cycle exists: S1 is protocol design, not client/gateway implementation.

Do not perform schema migrations as part of local tool setup. Reliable local saving precedes cloud connection, but protocol design precedes persisted queue schema. Gateway/security proofs use synthetic aggregates, not Phase 1 workout screens. Any scope reduction must explicitly revise acceptance and dependencies rather than silently mark the full phase complete.

## 11. Testing Strategy

Only L1 profile tests have executed (Step 6G). Everything below is acceptance work for later approved tasks, not a passed check. Choose compatible tools incrementally; Vitest/RTL, IndexedDB simulation and Playwright remain recommendations. Typecheck/build complement behavioural tests.

| Area / task | Concrete input/action and expected assertion |
|---|---|
| Profile regression, L1/L2 | Run `npm.cmd run test`: discover all seven existing cases, pass 7, fail 0, exit 0. Preserve existing-preference reads, UUID-only creation/default reread, concurrent-request deduplication, matching-session guard, permission-denial propagation, duplicate-creation recovery and required post-insert readability. No network/database; mocked RLS errors are not policy verification |
| Provenance/baseline, E1/D2 | Record source project, capture time, database/tool versions, scope/exclusions and hashes. Recover columns/defaults/keys/checks/FK actions/indexes/policies/effective grants/functions/triggers and available migration history. Distinguish managed objects. Reproduce in a fresh isolated target and compare object by object; explain every mismatch, especially profile defaults and ownership FKs. Do not reconstruct missing definitions from counts |
| Target safeguards, D1 | Missing, ambiguous or production target identifier/URL causes failure before connection/setup/mutation. Explicit isolated allowlist and separate configuration; credentials never logged. Privileged synthetic setup separated from authenticated/anon test execution. Cleanup restricted to the isolated synthetic scope |
| Privileges/gateway, D4/S2 | Positive permitted profile CRUD cases and negative cross-account parent/reassignment cases; verify effective inherited/PUBLIC grants, relevant schema/sequence/function access and default grants of actual creators. Deny prohibited TRUNCATE and other privileges. Ordinary browser roles cannot bypass required revision/aggregate checks through direct table writes; preserve reviewed profile-access exceptions. Rejected transactions change neither aggregate nor receipt |
| Interrupted persistence, P2 | Inject failure between edit and queue writes: transaction retains prior record and queue, creates no partial new state, and never reports saved. Successful commit restores exact synthetic edits/IDs/units/notes/order/timing after offline closure/reopen. Quota failure surfaces recovery feedback and retains prior durable data |
| Account switch, P3 | Delay A's reads/writes/queue dispatch, switch to B, then complete A's operations. No A data enters B's UI/cache/repository/queue; no A operation is sent under B's credentials. Returning to A restores its own pending work. Expired online authorisation cannot dispatch server writes |
| Secure logout/recovery, K2/P3 | With unsynced A changes, logout locks reads and releases/restricts keys as reviewed, retains protected records/queue, and permits approved A unlock/recovery. B cannot unlock/replay A data. Wrong unlock, expiry and lost-key scenarios follow reviewed recovery policy without silent discard; explicit discard requires confirmation |
| Retry/idempotency, S3/S4 | Commit then lose response; retry same operation identity/payload: exactly one accepted write/receipt, no duplicate sets. Changed payload under same identity follows reviewed rejection rule. Restart preserves queued work; local ack cleanup cannot erase an unacknowledged operation |
| Whole-workout conflict, S4 | Two devices submit from same revision: stale version cannot overwrite accepted state. Both complete versions remain durably available across refresh; explicit resolution uses current revision and can itself conflict safely. Preserve competing offline starts while choosing one primary strength session; no automatic data discard |
| Tab takeover, T1 | Two tabs open one workout: only one commits. Simulate owner crash/suspension, permit reviewed takeover, then resume old writer: stale writes rejected. Other tab remains read-only for this workout, not the whole app. Local pending edits are retained through ownership changes |
| Schema upgrade/rollback, D2/D4/P2/R1 | Seed versioned synthetic records/queues/conflicts, interrupt at declared upgrade points and execute reviewed recovery. Preserve counts/IDs/attribution/pending operations; no destructive storage clearing. Verify old-client/new-schema compatibility or safe refusal before writes. Test recovery in isolation before production approval |
| Worker/routes/auth, U2 | Test direct route load/refresh and reviewed hosting fallback on mobile/desktop; confirmation and resend redirects/callback errors still work. Upgrade from previous cached release with an active synthetic pending workout: coherent entry/assets, preserved data, meaningful offline/unavailable-route feedback, no private API/media responses in shared public caches |

Use appropriate nonprivileged test identities. BYPASSRLS metadata inspection cannot prove isolation. Record exact commands, inputs, expected/actual outcomes and unexecuted checks. Later phases still implement full rotation/duration/history recalculation, PR/volume and private-media tests from original section 33; foundation fixtures do not satisfy those feature acceptance gates.

## 12. Acceptance Criteria

Reviewed scope has reproducible compatible migrations where needed, demonstrated responsive shell/themes and preserved auth/profile flows. Protected local saving/recovery, account boundaries, tab and sync foundations satisfy approved directions with executed tests and isolated security evidence. Preserve existing changes/data; disclose failures and unverified behaviour. User reviews results before phase completion or Phase 1. Documentation or compilation alone is not acceptance.

## 13. Risks and Rollback Approach

Risks: schema drift, missing baseline, changed profile defaults, excessive gateway privileges, account queue reuse, lost keys, quota/eviction, stale writers/devices, interrupted migrations and stale worker assets. Require verified recovery/backups before authorised database changes; no private backup retrieval now.

Prefer additive compatible changes and staged adoption. Use reviewed forward repair or tested rollback; never drop data-bearing additions merely to revert. Preserve queued operations/conflict copies. Test local upgrades/interruption; clearing IndexedDB is not routine recovery. Production deployment/rollback needs explicit scope approval and recovery evidence.

## 14. Open Questions Requiring Approval

No reapproval of GT-012–GT-017 or settled product behaviour is required. Gates below occur immediately before the affected task, not as prerequisites to all Phase 0 work. Only L1 is already implemented; no pending task is authorised by this revision.

| Open detail | Decision required before | Recommended default — not approval |
|---|---|---|
| Direct esbuild ownership, exact runtime/tool versions | L2/L3 | Retain working Node cases; consider a direct development dependency, not selected here |
| Missing schema artifacts/read-only capture permission | E1 | Recover historical artifacts first; new access needs enforced read-only authorisation |
| Isolated environment/target allowlist/fixture cleanup | D1 | Fail closed on production/unknown targets; no private fixtures |
| Complete baseline provenance and adoption | D2 | Reproduce and compare in isolation; reconcile existing migration state |
| Effective grants/default privileges and compatibility | D3, before preparation | Least privileges with preserved allowed profile access |
| Identity mapping, aggregate and value/snapshot contracts | C1/C2/each C3 slice | Consumer-sized contracts and preserved historical attribution |
| Router hosting/callbacks and cache/update strategy | U1/U2 | Preserve existing online auth; route/worker checks before rollout |
| Encryption/unlock/key recovery/session expiry | K1, then approved design before K2 | Protected account storage; concrete mechanism requires security review |
| Local schema/upgrade/encryption transaction boundary | P1, before P2 | Atomic protected edit+queue; interruption-tested upgrades |
| Tab coordination/expiry/takeover | T1 | Coordination plus current revision checks |
| Revisions/receipts/feed/tombstones/stale-device recovery | S1, before P1/T1/S2 | No correctness-critical pruning before safe recovery/replay rejection |
| Gateway execution/permissions/direct-write restrictions | S2 | Least privilege and explicit ownership/relationship validation; no mechanism finalised here |
| Production adoption/resources/recovery method | R1 | Separate deployment approval after isolated acceptance and drift checks |
| Competing offline starts/history rotation edits | Accommodate C2/S1; settle before relevant Phase 1 behaviour | Preserve work; explicit advancement, no duplicates; relevant recalculation retained |
| Closure/clock anomalies and unusual resistance | Affected Phase 1 functions | Persist timing and original inputs; no implicit pause-on-close approved |
| Catalogue/media rights, photo limits/retention, account pending-deletion access | Phases 2/4/5 | Verified permitted media, retained originals, idempotent cleanup; details deferred |

## 15. Completion and Handoff Checklist

- [ ] User reviews/approves draft scope and task sequence.
- [ ] Task-specific decisions reviewed before relevant gates.
- [ ] Existing changes/data preserved; authorised files/resources identified.
- [ ] Migrations/security results reviewed before production use.
- [ ] Acceptance checks executed; failures/unexecuted checks disclosed.
- [ ] Actual changes and recovery steps recorded.
- [ ] CURRENT_STATE/ROADMAP/DATABASE updated from results.
- [ ] Phase 0 accepted before Phase 1 starts.

L1 alone is completed (Step 6G); all other implementation items and phase exit approval remain pending. The original section 12 exit criteria are unchanged. Next action: review this revised draft, then separately scope the next task. L2 is the recommended next local unit; direct dependency ownership/version and any installation scope must be reviewed before changes. Database evidence recovery can be authorised independently.
