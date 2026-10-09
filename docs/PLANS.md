# Gym Tracker — Implementation Planning Standards

## When a Plan Is Required

Require a written implementation plan before:

- Major application architecture changes
- Supabase schema migrations
- Offline persistence and synchronisation work
- Changes affecting workout history or data integrity
- Multi-feature or multi-phase development
- Account deletion and private media storage
- Any task likely to require substantial coordinated changes

Small, isolated changes may use a brief plan in the Codex conversation.

## Required Plan Sections

Every substantial plan must include:

1. Objective
2. Relevant specification references
3. Current verified implementation state
4. Scope and explicit exclusions
5. Dependencies and prerequisites
6. Technical approach
7. Files expected to change
8. Database changes, if applicable
9. Data integrity and privacy considerations
10. Implementation steps
11. Testing strategy
12. Acceptance criteria
13. Risks and rollback approach
14. Open questions requiring approval
15. Completion and handoff checklist

## Planning Rules

- Inspect the relevant existing code before proposing changes.
- Distinguish confirmed requirements from engineering assumptions.
- Do not invent database schemas, APIs or existing functionality.
- Compare planned work against MASTER_SPEC.md.
- Consult ORIGINAL_REQUIREMENTS.md only for additional details that do not conflict with the master specification.
- Identify cross-feature dependencies early.
- Prefer small, independently testable implementation steps.
- Keep an explicit list of out-of-scope features.
- Do not silently simplify approved requirements.
- Do not execute a plan merely because it has been written.
- Wait for approval before implementation when approval is required by AGENTS.md.
- Update the plan with verified implementation and test results as work progresses.

## Phase Plans

Store substantial phase plans in:

```text
docs/plans/
```

Use names such as:

```text
PHASE_0_FOUNDATION.md
PHASE_1_WORKOUT_ENGINE.md
PHASE_2_EXERCISE_LIBRARY.md
```

These are examples; do not create them yet.

## Completion Criteria

A task is complete only when:

- The required functionality is implemented.
- Relevant tests have been executed.
- Results and limitations are documented.
- No known data-integrity issue is concealed.
- The implementation matches the approved requirements.
- CURRENT_STATE.md reflects verified progress.
- ROADMAP.md reflects the actual phase status.
