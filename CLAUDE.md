# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server with HMR
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built `dist/`
- `npm run typecheck` — `tsc -b` (project references: `tsconfig.app.json` for `src/`, `tsconfig.node.json` for config files)
- `npx eslint .` — lint (no npm script defined; flat config in `eslint.config.js`)

Node version is pinned in `.nvmrc` (20). There is no test framework; `src/App.tsx` ends with a small IIFE of `console.assert` self-tests that run in the browser on load — check the devtools console after changing `bestStreak`, `uniqueExerciseCount`, or `formatNumber`.

## Architecture

A single-page React 19 + Vite workout tracker PWA, deployed to Netlify (`netlify.toml`: builds `dist/`, SPA fallback to `index.html`, `service-worker.js` served with `no-cache`).

- **Almost all app code lives in `src/App.tsx`**, which starts with `// @ts-nocheck` — it is effectively untyped JS, so `typecheck` won't catch errors there. It contains shared UI primitives (`Section`, `Button`, `TextInput`, …), the root `WorkoutTrackerApp`, one component per tab (`TodayTab`, `ExercisesTab`, `HistoryTab`, `StatsTab`), calendar helpers, and module-level "action" functions (`startWorkout`, `endWorkout`, `addSetToWorkout`, …) that take `setWorkouts` and apply immutable updates.
- **Styling is Tailwind via the Play CDN** (`<script src="https://cdn.tailwindcss.com">` in `index.html`), not a PostCSS/Vite plugin. There is no Tailwind config; utility classes just work at runtime. `src/index.css`/`App.css` are leftover Vite template styles.
- **Persistence is localStorage only.** Root state is loaded/saved via `load`/`save` helpers under keys in `SK` (`wt_exercises_v1`, `wt_workouts_v1`, `wt_prefs_v1`, `wt_fitbit_daily_v1`). Changing data shapes requires bumping the key or migrating.
- **Data model:** a workout is `{ id, date: "YYYY-MM-DD", inProgress, notes, items[] }`; each item snapshots the exercise (`exerciseId`, `name`, `image`) plus `sets: [{ reps, weight, rpe }]`. At most one workout is `inProgress`; `endWorkout` runs `consolidateWorkoutsByDate` so there is one workout per date, and `startWorkout` reopens today's finished workout rather than creating a duplicate. `addExerciseToSession` reads the exercise library from localStorage (not React state).
- **Fitbit integration expects a backend that doesn't exist in this repo.** The frontend calls `${API_BASE}/api/fitbit/status`, `/api/fitbit/daily?date=`, and redirects to `/api/fitbit/auth?redirect=` with `credentials: 'include'` (httpOnly cookie after OAuth). `API_BASE` is `""` (same origin).
- **PWA:** `public/manifest.json` and a hand-written `public/service-worker.js` (cache-first, cache name `gym-tracker-v1`), registered in `src/main.tsx`. Bump the cache name when changing cached assets, since the SW serves cached responses before network.
