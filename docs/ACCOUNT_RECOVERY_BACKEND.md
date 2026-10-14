# ARC FIT account recovery backend

Status: **migration 08 applied; backend prepared, not deployed, scheduled or run against real accounts**. Account deletion requests remain disabled in the UI. Recovery of existing requests uses the already applied owner-only recovery RPC.

## Files and activation order

1. Apply `docs/migrations/20261011_08_account_purge_claim.sql` after migrations 01-07. This migration was applied through the authorized SQL Editor and its cascade prerequisites passed a rollback-only owner-isolation test. It adds expiry-checked service-only claim/verification RPCs and a cascading-owner-FK preflight. The claim uses the same account advisory lock as recovery. Existing rows are not modified.
2. Configure `ARC_FIT_PURGE_CRON_SECRET` through Supabase Edge Function Secrets. Use a cryptographically random value with at least 32 characters. Never put it in frontend environment variables, Git, command output or request URLs. The server uses the platform-provided `SUPABASE_SECRET_KEYS.default` or `SUPABASE_SERVICE_ROLE_KEY`; neither enters frontend code or backup exports.
3. Deploy `supabase/functions/account-purge/index.ts` **only after deployment approval**. The prepared command is `supabase functions deploy account-purge --project-ref bqzqiidniitbraapjmyk --no-verify-jwt`. This endpoint verifies its mandatory server-only secret header instead of accepting user JWTs as authority.
4. Schedule a server POST to `/functions/v1/account-purge`, for example hourly. Supply `x-arc-fit-purge-secret` from Supabase Vault or another server secret store. Do not inline its value into a SQL migration. Scheduling and secret storage follow the [Supabase scheduling guide](https://supabase.com/docs/guides/functions/schedule-functions).
5. Verify the worker's prerequisite check, secret rejection, recurring job success and retry monitoring using an isolated disposable account. Only then pass `backendReady=true` to `AccountRecovery` from a verified application capability/configuration. It defaults to false.

No automatic restoration of purged accounts is offered. Account recovery is available before the server deadline, and a successful claim after that deadline starts permanent deletion.

## Safety and retry contract

The worker accepts POST only. Missing configuration returns 503; absent or incorrect secret returns 401 before an administrative client is created. Secrets are compared using fixed-size SHA-256 digests. Responses contain aggregate counts, never credentials, paths, emails or account identifiers. No caller-provided account ID is accepted.

The worker considers at most five due accounts per invocation, with a 90-second overall work budget, 10-second network timeouts, 100-object Storage batches and a 15-minute renewable claim lease. It verifies the exact claim before traversal, every removal batch and auth deletion. Invalid/future/foreign claims fail closed. Storage or auth errors are retryable and never counted as successful account deletion. Partial original removal after an authorized expired claim is intentionally irreversible; the retained claim allows cleanup to resume.

Before deleting any original, the service-only preflight verifies cascading owner-column foreign-key paths to `auth.users` for every existing app-owned dataset. The original foundation `0001` SQL is not present in this checkout, so its cascade coverage is **not asserted from a missing file**. Missing or incompatible ownership constraints stop the worker before destructive operations; no schema changes or forced cleanup are substituted.

The worker removes only objects below the claimed user's UUID in `arc-fit-private`, including nested and replaced originals. It lists again and requires empty storage before deleting that exact auth user. Supabase documents that [users owning Storage objects cannot be deleted and existing JWTs can survive until expiry](https://supabase.com/docs/guides/auth/managing-user-data). Migration 08 therefore adds restrictive private-bucket insert/update predicates: claimed accounts and deleted auth identities cannot create new originals. Existing ownership policies remain in force, and accounts inside their recovery window retain normal media access.

Recovery and claim serialize under the same advisory lock. Recovery that succeeds first removes the request, so claim returns null. Recovery cannot cancel a claimed/expired request. Claim verification rejects missing, replaced or expired leases. Auth-user deletion then relies on the verified ownership cascade; an auth deletion error stops success reporting instead of attempting unrelated table deletion.

Expired workout trash cleanup runs through its service-only RPC. Migration 08 row-locks each expired workout and removes its frozen replay payloads in the same transaction, so a concurrent valid restore cannot lose those receipts. Existing active sessions and unexpired trash are excluded.

ZIP backups contain user application records, decrypted device workout copies/conflicts and owned original media. Internal `workout_sync_operations` receipts and `device_vault_keys` are intentionally excluded; the backup does not widen database grants.

## Verification boundary

`tests/account-purge.test.mjs` executes fixture-only tests for secret protection, exact owned Storage paths, successful storage-before-auth order, recovery/stale-claim races, future/foreign/unsafe references, retryable failures, missing cascade preflight and final claim revalidation. The Edge entrypoint receives a syntax check. No production Edge runtime, recurring job or actual purge is claimed verified.

Deployment, server secret configuration and scheduling remain required before enabling deletion requests. Backend deployment needs the user's approval under the project's deployment boundary.
