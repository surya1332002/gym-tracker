---
name: gym-feature
description: "Use when implementing, extending or refactoring an approved Gym Tracker application feature, including React UI, workout logging, exercise management, progress tracking and related frontend/backend integration. Follow the approved specification, inspect existing code, plan scoped changes, run relevant tests and document verified results."
---

# Gym Tracker Feature Development

## 1. Establish Scope

- Read the relevant sections of `docs/MASTER_SPEC.md`.
- Consult `docs/ORIGINAL_REQUIREMENTS.md` only for compatible additional details.
- Review `docs/UI_DESIGN.md` when it exists and is relevant.
- Review `docs/CURRENT_STATE.md` and the relevant phase plan.
- Inspect the current implementation before proposing changes.
- Identify which requirements are confirmed and which engineering decisions remain open.
- Do not invent missing requirements. Report missing relevant documents or plans rather than assuming their contents.

## 2. Plan the Feature

For substantial changes:

- Follow `docs/PLANS.md`.
- Identify dependencies, files to change and database impacts.
- Break work into independently testable tasks.
- Define acceptance criteria before implementation.
- Explain any conflict with approved requirements.
- Obtain approval when required by `AGENTS.md`.

Do not begin implementation merely because a plan exists. Preserve the current environment-setup restriction in `AGENTS.md` until the setup and repository audit are complete and approved.

## 3. Implement Approved Changes

- Modify only the approved scope.
- Prefer reusable components and maintainable TypeScript.
- Preserve the existing working authentication flow.
- Follow mobile-first responsive requirements.
- Use accessible controls and clear loading/error states.
- Keep workout and measurement data accurate.
- Avoid unnecessary packages and architecture changes.
- Never embed credentials or service-role secrets in frontend code.

If schema modifications are required, coordinate with the `gym-database` workflow once available. Do not improvise database changes. If that workflow is unavailable, report the dependency and obtain an approved migration approach before changing the schema; continue independently authorised work where possible.

## 4. Test and Verify

Run relevant checks, including where applicable:

- TypeScript checks
- Production build
- Unit tests
- Integration tests
- UI interaction tests

Verify actual user behaviour rather than relying on successful compilation alone.

For data-sensitive features, examine:

- Historical data integrity
- Offline behaviour
- Synchronisation and duplicate prevention
- Error recovery
- Permissions and privacy

Clearly distinguish tests that passed, tests that failed and tests that were not run. Label earlier results as historical rather than claiming they were executed in this session.

## 5. Report Results

Provide:

1. Feature implemented
2. Files changed
3. Requirements satisfied
4. Tests executed and results
5. Known limitations
6. Outstanding decisions
7. Recommended next task

Update relevant project documentation when appropriate.

For substantial completed sessions, use the `gym-handoff` skill at `.agents/skills/gym-handoff/SKILL.md` to prepare the development handoff.

## Safety

- Never overwrite unrelated user changes.
- Do not delete historical data without explicit approval.
- Do not silently change confirmed UI decisions.
- Do not run destructive Git or database commands without approval.
- Do not claim unfinished features are complete.
- Do not commit automatically.
- Do not start unrelated features.
