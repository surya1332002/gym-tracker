---
name: gym-handoff
description: "Use when closing a Gym Tracker development session, preparing a handoff for a new Codex conversation, resuming after an interruption, or explicitly requesting a verified project-status update. Inspect repository state and tests, then maintain current-state, roadmap and decision records without inventing completed work."
---

# Gym Tracker Session Handoff

## Establish Verified State

- Identify the current repository root and Git branch.
- Inspect working-tree changes without modifying or discarding them.
- Read the existing `docs/CURRENT_STATE.md`.
- Inspect relevant code and test results when necessary.
- Distinguish implemented, tested, planned, incomplete and blocked work.
- Never claim that a feature or test is complete without evidence. Label earlier test results as historical; record checks not run as not run.
- Never expose environment secrets.

## Update Project Records

Update `docs/CURRENT_STATE.md` with:

- Last completed task
- Current development phase
- Current implementation status
- Files changed during the session
- Tests actually run and their results
- Known issues and blockers
- Unresolved decisions
- Exact next recommended action

Update `docs/ROADMAP.md` only when a phase's verified status changes.

Update `docs/DECISIONS.md` only when a meaningful technical or product decision has actually been approved.

Do not modify `docs/MASTER_SPEC.md` or `docs/ORIGINAL_REQUIREMENTS.md` merely to reflect implementation progress. The master specification takes precedence where they conflict.

## Produce a Handoff Summary

Return a concise report containing:

1. Completed work
2. Files changed
3. Verification and tests
4. Remaining blockers
5. Next exact task
6. Recommended starting instructions for the next Codex session

## Resume Workflow

When explicitly asked to resume:

- Read `AGENTS.md` and `docs/CURRENT_STATE.md`.
- Confirm the actual Git and repository state.
- Identify the next approved task.
- Check relevant supporting documentation.
- Describe the proposed next action.
- Wait for approval before starting implementation.

## Safety

- Do not commit changes without approval.
- Do not modify application code during a handoff.
- Do not erase existing working-tree changes.
- Do not invent test results.
- Do not treat `docs/ROADMAP.md` as proof that features exist.
- Keep the handoff concise enough for a fresh Codex conversation.
