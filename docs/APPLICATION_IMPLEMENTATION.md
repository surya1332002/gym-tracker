# ARC FIT implementation handoff ? 2026-10-16

Branch: develop. No production deployment or merge performed. Earlier working-tree changes and private import files are preserved.

## Implemented

- Mobile workout entry, saved programme/day browsing, selected-day builder, blank targets and empty programmes, safe cancel/save, accessible reorder, per-set targets and grouped rounds.
- Real set logging, per-exercise units/increments, machine presets and historical snapshots, replacements with original attribution, duration pause/correction, overview/focused modes, incomplete completion choices, summaries, explicit history editing and recoverable trash.
- Account-scoped encrypted IndexedDB workout drafts/outbox/conflicts, single-writer protection, revision-aware atomic retries, cached start/builder data, explicit conflict recovery, online device trust and offline passphrase unlock. Release service worker precaches every versioned build chunk without caching private API responses.
- Exercise categories/search/equipment, My List and Custom editing/archiving, favourites/recently-used shortcuts, guide/settings/history, private user-uploaded original exercise/preset media. Catalogue image import and 3D remain excluded.
- Real strength metrics/charts/comparisons, weekly targets/adherence, calendar, Home next-day suggestions, separate cardio, detailed paired/custom measurements and trends, dated private progress photos and aligned comparisons.
- Five Profile areas, unit/theme/training preferences, CSV and ZIP including private originals/device copies, account recovery controls and other-device sign-out. Privileged keys never enter the frontend.

## Database and preservation

Migrations 20261010_02/03 and 20261011_01 through 10 have been applied through the authorized existing-project SQL Editor. Additive owner-scoped tables, precise numeric storage, guarded existing-RPC extensions and RLS are retained. Migrations 05-10 stop safely if their verified prerequisite contracts differ.

Rollback-only authenticated SQL exercised atomic replay/revision conflicts, precise sets, edit/trash/restore, empty programme to NULL targets, group metadata, incomplete classification, explicit exercise preferences, private media isolation/immutable references and purge cascade prerequisites. Anonymous and foreign-owner access were checked without retaining synthetic records.

Live account reads confirm the existing six-day programme retains all 43 slots, 19 undated references retain 57 sets, the existing unfinished session retains 20 sets with zero completed sets/actual loads, and the shared catalogue remains 876. Concurrent user-created programmes/exercises and duration edits were detected and left intact; an original whole-account hash is therefore not claimed unchanged.

## Verification

Final checks on 2026-10-16: all 226 local tests pass. A clean snapshot of exactly the staged application, excluding private import files and credentials, passes all 212 public tests, TypeScript and the production build. All JavaScript chunks are below 500 kB. Pinned public catalogue bytes survive Windows checkout unchanged. Authenticated Chrome checks on 2026-10-14 at actual CSS widths 320 and 390 cover navigation, resumed logging, previous-performance display and no horizontal overflow. No real workout was fabricated or completed to test history; completion/synchronization/privacy failures are tested using isolated fixtures and rollback-only SQL. Native mobile Safari and actual interrupted-network device tests have not been executed.

## Remaining activation requirements

- Phone cold-start offline access/PWA installation needs a trusted HTTPS origin. The current LAN HTTP address is not a secure service-worker origin; existing-tab encrypted workout recovery is implemented.
- Account deletion requests stay disabled until the protected purge function is approved for deployment, its server secret configured and a recurring server job verified. Migration 08 and the backend implementation are ready; no actual purge occurred. See ACCOUNT_RECOVERY_BACKEND.md.
- Optional AI coaching stays disabled until a provider/model, server API credential and protected function deployment are configured. See OPTIONAL_AI_COACHING.md. No training data has been transmitted to an AI provider.
- Supabase's public client supports sign-out of other sessions but not an individual active-session inventory/revocation UI. Such an inventory needs an explicitly scoped backend capability; the UI states this limit.

Private local routine-import helpers, historical CSVs, manifests and earlier detailed notes are deliberately excluded from these commits. They are retained locally, not erased. The committed application does not depend on the private import routes or fixtures.

Next action: test an actual workout on the development app, then approve only the desired HTTPS/backend activation work. No production deployment is authorized.

## Session close

Application modules changed: app/auth shell, encrypted data layer, workout and exercise features, Home/Progress/Body/Cardio/Photos/Profile, release cache configuration and public regression fixtures. Staged administrator-credential and live-account identifier scans passed. Local import routes are intentionally absent from the committed AppShell while the original working copy remains available. No credential or private CSV is committed.
