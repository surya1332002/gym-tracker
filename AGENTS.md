# Gym Tracker — Codex Project Instructions

## Project

This repository contains a personal Gym Tracker application built with React, TypeScript, Vite and Supabase.

The approved Gym Tracker Master Product Specification is the product source of truth. Do not assume the existing application interface represents the approved design.

## Development Rules

- Work in small, clearly scoped, reviewable steps.
- Follow the approved specification and UI decisions.
- Do not silently remove, simplify or change confirmed requirements.
- Ask for approval before major architecture changes or destructive operations.
- Do not overwrite or discard existing user changes.
- Never expose, commit or print secrets from environment files.
- Treat database schema changes as migrations.
- Never reset or delete a database without explicit permission.
- Keep workout history, exercise attribution and stored measurements accurate.
- Prioritise mobile usability, accessible controls and reliable offline workout persistence.
- Do not claim tests passed unless they were executed successfully.
- Explain blockers and incomplete implementation clearly.

## Project Documentation

When available, use:

- docs/MASTER_SPEC.md — Approved functional requirements
- docs/UI_DESIGN.md — Confirmed UI and interaction behaviour
- docs/ARCHITECTURE.md — Technical architecture
- docs/DATABASE.md — Database schema and migration notes
- docs/DECISIONS.md — Important design and technical decisions
- docs/ROADMAP.md — Implementation phases
- docs/CURRENT_STATE.md — Current implementation status and next action
- docs/PLANS.md — Standards for complex implementation plans

Read only the documents relevant to the current task. Do not load every document automatically.

If documentation is missing, report it instead of inventing its contents.

## Implementation Workflow

For substantial tasks:

1. Review the relevant requirements and existing code.
2. Identify dependencies and risks.
3. Propose an implementation plan.
4. Implement only the approved scope.
5. Run relevant tests and checks.
6. Summarise changes and remaining issues.
7. Update project state and decision records as appropriate.

## Skills and Delegation

Use relevant project skills when available.

Delegate bounded research, independent reviews and testing when supported and useful. The main agent owns architectural decisions and final integration.

Avoid concurrent modifications to the same files by multiple agents.

## Session Continuity

Use docs/CURRENT_STATE.md as the primary development handoff record when it exists.

Before ending a substantial work session, record:

- Completed work
- Files changed
- Tests executed and results
- Known issues
- Pending decisions
- Next recommended action

Do not replace verified repository state with assumptions from previous conversations.

## Current Stage

We are configuring the Codex development environment.

Do not begin rebuilding the Gym Tracker until the environment setup and repository audit are complete and approved.
