---
name: gym-qa
description: "Use when testing or reviewing a Gym Tracker feature, change or release against approved requirements, including workout behaviour, calculations, responsive UI, accessibility, offline recovery, synchronisation and privacy. Inspect actual implementation, select relevant checks and report reproducible evidence with passed, failed and unexecuted tests; do not silently change implementation code."
---

# Gym Tracker Quality Assurance

## 1. Establish Test Scope

- Identify the feature, change or release being tested.
- Read relevant sections of `docs/MASTER_SPEC.md`.
- Consult `docs/UI_DESIGN.md` when available.
- Read `docs/CURRENT_STATE.md` and the relevant implementation plan.
- Inspect the actual implementation and existing tests.
- Identify acceptance criteria before testing.
- Do not assume planned functionality has been implemented.

Report missing documents or plans rather than inventing their contents. Keep testing within the authorised scope and environment-setup boundaries in `AGENTS.md`.

## 2. Select Relevant Tests

Choose appropriate verification methods:

- TypeScript type checking
- Production build
- Unit tests
- Integration tests
- Component tests
- End-to-end tests
- Manual UI inspection
- Mobile and desktop responsive checks
- Database relationship and policy checks
- Offline and recovery testing

Do not install new testing frameworks or dependencies without approval. Inspect commands before executing them; identify tests that write records, browser storage or generated files and obtain the necessary authorisation. Use isolated fixtures and environments for mutating tests rather than treating QA as permission to alter production data.

## 3. Verify Core Workout Behaviour

When relevant, test:

- Push/Pull/Legs rotation advancement
- Routine creation and editing
- Previous-performance prefilling
- Set completion and direct editing
- Exercise replacement and historical attribution
- Supersets, trisets and circuits
- Pause/resume duration calculations
- Incomplete workout handling
- Active workout restoration
- Workout history corrections
- Machine preset snapshots
- Personal record recalculation

## 4. Verify Calculations

Check:

- kg/lb conversions
- Exercise-specific weight increments
- Training volume
- Estimated 1RM
- Primary-muscle working-set counts
- Weekly adherence calculations
- Seven-day body-weight averages
- Left/right body measurement comparisons
- Date and timezone handling

Use reproducible expected values and clearly document calculation assumptions.

## 5. Verify Data Integrity and Synchronisation

Where relevant, test:

- Local workout saving
- Browser refresh recovery
- Offline set logging
- Retry after reconnecting
- Duplicate prevention
- Multi-device conflicts
- Historical data preservation
- Storage and retrieval of private media

Never deliberately corrupt production data to test recovery.

## 6. Verify User Interface

Check:

- Mobile touch-target usability
- Desktop navigation
- Light, Dark and System themes
- Loading and empty states
- Error handling
- Keyboard accessibility
- Completed versus incomplete set visibility
- Consistency with approved screen behaviour

A successful compilation does not establish that the user interface works correctly.

## 7. Report Findings

Return a structured QA report:

1. Scope tested
2. Environment and tools
3. Tests executed
4. Passed checks
5. Failed checks
6. Tests not executed
7. Bugs and severity
8. Requirements affected
9. Recommended fixes
10. Final assessment: Pass, Fail or Incomplete

Each finding should contain enough evidence for another developer to reproduce it. Include the relevant requirement, test inputs or reproduction steps, expected and actual behaviour, and supporting observations without private data. Separate verified failures from suspected risks. Use Incomplete when required checks could not be executed; do not infer a pass from missing evidence. Label earlier results as historical.

## 8. Safety and Independence

- Default to read-only QA unless test modification is explicitly authorised.
- Do not silently modify implementation code while reviewing it.
- Do not run destructive database tests against production data.
- Do not expose credentials or private user information.
- Do not invent test results.
- Do not mark a feature complete merely because TypeScript compiles.
- When testing requires a browser, database connection or external tool that is unavailable, report that limitation.
- Keep QA findings independent from implementation claims.
