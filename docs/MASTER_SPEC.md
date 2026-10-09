Gym Tracker — Master Product Specification
Step 1 — Consolidated Master Specification
This is the working product specification for your new Gym Tracker.

Gym Tracker — Master Product Specification
Version: 1.0 — Consolidated Design
Status: Requirements defined; implementation pending
1. Product Vision
Build a responsive, personal gym-tracking application that makes logging workouts quick and reliable while providing detailed strength, consistency and body-transformation analytics.
The application must work on mobile and desktop, synchronise user data through Supabase, and remain usable during temporary internet outages.
The existing workout interface will be replaced. Existing local workout data does not need to be migrated.
2. Technology and Architecture
Frontend: React 19, TypeScript, Vite 7.
Backend: Supabase for authentication, PostgreSQL data storage and private media storage.
Offline support: IndexedDB for active workout persistence, with synchronisation after reconnecting.
Authentication: Email and password, including email confirmation.
Responsive layout: Mobile-first interface with bottom navigation; desktop sidebar and wider analytical layouts.
Appearance: Light, Dark and System themes with one consistent Forest Teal accent.
Navigation: Home, Workout, Exercises, Progress and Profile.
Data access: Each user's personal training data and media must be private.
The current Supabase database contains initial tables for profiles, exercises, machine presets, routines, workouts, sets, cardio and measurements. The implementation must review and extend that schema to support all confirmed features.
3. Home
A fixed, non-customisable dashboard featuring:
Suggested next workout in the Push/Pull/Legs rotation and a prominent Start button.
Weekly training activity and consistency summary.
Most recent workout.
Body-weight trend.
Recent personal records.
Mobile uses a vertical scroll. Desktop uses a multi-column dashboard.
4. Workout
4.1 Training Rotation
Default six-session sequence:
Push A → Pull A → Legs A → Push B → Pull B → Legs B
The sequence advances after a completed qualifying workout, not after a rest day. Users create their own routines and select their own exercises.
The Workout landing page shows the suggested session, six routine cards, custom workout access, workout history and standalone cardio.
4.2 Routine Builder
Create and edit routine days and exercise ordering.
Configure exercise sets, default rep ranges and optional per-set rep targets.
Do not store fixed routine target weights; use actual previous performance.
Preview routines in read-only mode.
Save Routine and Cancel actions, with unsaved-change protection.
Reordering through drag-and-drop and Move Up/Down controls.
Exercise substitutions can apply to only the current workout or permanently update the routine.
4.3 Active Workout
Two interchangeable modes:
Overview: All exercise cards displayed in a scrollable list.
Focused: One exercise shown at a time, with all its sets visible simultaneously.
Both modes use the same live workout data.
Set logging includes weight, reps, completion status, optional RPE and notes. The interface displays previous performance and allows direct editing of completed sets.
Automatically suggest previous weights and reps.
Prefer the last performance in the same routine; fall back to the latest overall performance.
Show the last overall exercise performance separately when relevant.
Automatically highlight the next incomplete set without forcing navigation, scrolling or keyboard focus.
Suggest the next exercise once all sets are complete.
Allow sets and exercises to be added, removed or reordered during a session.
Support supersets, trisets and circuits using grouped expandable cards and flexible round tracking.
Keep an accessible active-workout bar throughout the app.
Track workout duration with pause/resume and editable elapsed time, excluding paused periods.
No rest timer.
Automatically save active-workout edits locally and synchronise safely with the cloud.
4.4 Exercise Replacement
When no sets have been completed, replace the original exercise card directly.
When sets have already been completed, preserve them under their original exercise and add the selected replacement for the remaining work.
Never misattribute completed work to a different movement.
4.5 Workout Completion
If all planned sets are completed, open the workout summary directly.
If sets are incomplete, show options to finish and advance rotation, save incomplete without advancing, or continue.
Show actual workout duration, exercises, completed sets, total volume, records and relevant notes.
4.6 History
Switch between chronological list and calendar views.
Search and filter previous workouts.
Open history in read-only mode.
Enter an explicit editing mode with Save Changes and Cancel.
Deleted workouts enter Recently Deleted for 30 days before permanent removal.
Deleted workouts are excluded from active analytics.
4.7 Standalone Cardio
Cardio is logged separately from strength workouts.
Fields include duration, distance, speed, incline, resistance, heart rate, calories and notes. The form should only require fields applicable to the activity.
5. Exercise Library
5.1 Library Landing
Open to muscle-group categories.
Include search, favourites and recently used shortcuts.
Display exercise results as compact lists, not image grids.
Support filters for muscle group and equipment.
Provide a comprehensive preloaded catalogue with verified, appropriately licensed or permitted instructional media.
5.2 Exercise Details
Three tabs:
Guide: Instructions, muscle targets, demonstration images and embedded videos where supported, with an external link fallback.
My Settings: Per-exercise weight unit, increment, machine presets, photos, notes and preferences.
History: Performance metrics, personal records, progress charts and workout history, filterable by routine and date.
5.3 Custom Exercises
Users can create private exercises with custom names, muscle groups, equipment, instructions, photos and tutorial URLs.
Custom exercises and their associated user media are private to the account.
5.4 Weight Controls
Each exercise uses its own weight unit: kg or lb.
Each exercise has its own configurable positive weight increment.
On first use, request the unit and increment once and save them.
Provide both numeric entry and increment/decrement controls.
Changing exercise preferences must not alter historical recorded loads.
5.5 Machine Presets
Multiple presets per exercise.
Fully customisable machine-setting names and values.
Multiple photos per preset, including setup overviews and close-ups.
Automatically select the last-used preset for the exercise.
Display a compact expandable machine summary during the workout.
Editing machine settings updates the selected saved preset.
Preserve historical snapshots of the settings used for each workout.
6. Progress
The landing page provides an overview and three dedicated categories: Strength, Body and Photos.
6.1 Strength
Balanced dashboard with key metrics and a progression chart first, followed by:
Personal records.
Training volume.
Working sets per muscle group.
Workout consistency.
Data-driven progress insights.
Optional on-demand AI coaching.
The progression chart switches between top weight, estimated 1RM, reps at a selected weight and training volume.
Support optional comparison of two date ranges.
PRs include heaviest weight, most reps at a given load, highest estimated 1RM and highest exercise volume in a session. Display recent achievements followed by a searchable exercise PR directory.
Training volume is calculated from logged weights and reps. Working sets count towards the primary muscle group only; secondary muscles do not receive additional set credit.
6.2 Consistency
Show an activity calendar, completed sessions, training frequency and planned routine adherence.
Maintain a normal weekly session target.
Permit adjustments to the current and future weeks.
Lock completed historical weeks.
Calculate adherence against the target set for each week.
Keep routine rotation independent of planned weekly session counts.
Rest days should not automatically be considered missed sessions.
6.3 Smart Insights
Calculation-based insights update automatically and explain their evidence.
Optional AI coaching runs only after the user explicitly requests analysis. It may describe trends and offer recommendations, but cannot modify workouts, routines or preferences automatically.
6.4 Body Progress
Separate entry actions:
Log Weight: Fast weigh-in recording.
Add Measurements: Detailed optional fields for body-fat percentage, chest, waist, hips, neck, biceps, forearms, thighs, calves and custom measurements.
Allow custom field creation, renaming, hiding and reordering.
Track paired body parts independently on the left and right.
Use global preferences for body weight (kg/lb) and circumference (cm/in).
Preserve measurement precision when changing units.
Display individual weigh-ins with an optional seven-day rolling average.
Provide charts and dated history for each measurement.
Allow historical corrections using an explicit Save Changes action.
6.5 Progress Photos
Private photo storage.
Group photos into dated check-ins.
Each check-in can contain Front, Side and Back views independently.
Support editing check-in dates and replacing or adding images.
Compare two dates using side-by-side or draggable overlay views.
Allow independent manual zoom, pan and crop alignment.
Preserve original photos without destructive editing.
7. Profile and Settings
Profile landing page links to five separate settings areas.
7.1 Personal Information
Display name, profile picture, date of birth and height, together with an automatically updated fitness summary.
Training experience is estimated from recorded workouts. Previous training duration may provide a provisional estimate until enough workout history exists. The assessment must indicate uncertainty when evidence is insufficient.
7.2 Training Preferences
Provide access to routine rotation, weekly targets, smart logging preferences and exercise-specific weight controls.
Do not introduce global or equipment-based weight increments.
7.3 Appearance
Light, Dark and System themes using one consistent Forest Teal accent colour.
7.4 Data and Privacy
Export individual datasets as CSV.
Download a complete ZIP backup with structured JSON data, training records, settings and original progress photos.
Backup restoration is outside the initial scope.
Private access to workout data, measurements and media.
7.5 Account
Change email.
Reset password.
Sign out.
View and revoke active sessions where supported.
Request account deletion with a 30-day recovery window.
Allow explicit account recovery before the deletion deadline.
Permanently remove associated personal data after the deadline using a reliable backend process.
8. Quality Requirements
Fast, touch-friendly workout logging.
No loss of an active workout due to refresh, navigation or temporary connectivity failure.
Consistent local and cloud state.
All historical data remains attributed to the exercise and equipment actually used.
Clear confirmation for destructive actions.
Meaningful empty, loading, failure and offline states.
Mobile and desktop usability.
Accessible form labels, controls and status feedback.
Automated tests for calculations and critical workflows.
No invented workout data, exercise media, PRs or AI conclusions.
9. Implementation Principle
Each development phase must implement its allocated features, complete database changes, demonstrate the working UI and pass relevant tests before the next phase begins.
The final application must follow the confirmed specification rather than recreating the previous workout interface.

Step 2 — Phased Implementation Roadmap
0
Foundation & Database
Review existing React/Supabase code, database migrations, reusable UI components, responsive navigation, auth and themes.
1
Workout Engine
Routine builder, PPL rotation, active logging, exercise replacement, machine presets, offline autosave and workout completion.
2
Exercise Library
Verified exercise catalogue, muscle categories, guides, custom exercises, media, per-exercise controls and history.
3
Strength Analytics
Progression charts, PRs, volume, working sets, consistency, adherence and on-demand AI analysis.
4
Body & Photos
Weigh-ins, measurements, trends, private photo galleries and transformation comparisons.
5
Profile, Export & Security
Settings, CSV/ZIP exports, account controls, sessions and 30-day deletion workflow.
6
Integration & Release Testing
Cross-screen consistency, mobile/desktop QA, offline recovery, permissions, error handling and final regression testing.
Step 3 — How We'll Work with Codex
We'll use the same process for every phase: inspect the existing implementation, define the specific changes, implement them, test the results, and review what was built before moving forward.
Our next step is Phase 0: Foundation & Database. We'll start by giving Codex a read-only audit prompt to inspect the existing project and Supabase schema. That lets us identify what can be retained, what must be replaced and which migrations are required—before modifying the code.
One thing we'll preserve throughout: the master specification is the source of truth. Codex shouldn't quietly simplify features or substitute a different design when implementation gets complicated.

