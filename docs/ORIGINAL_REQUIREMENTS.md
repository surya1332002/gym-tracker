GYM TRACKER
Master Product Requirements & Technical Specification
Version: 1.0
Date: 8 October 2026
Status: Requirements consolidated; UI redesign and implementation pending
Implementation environment: VS Code + Codex

1. Product Vision
Build a personalised gym tracking application that makes it effortless to log workouts on a phone and analyse long-term progress on a desktop.
The application must support structured training without forcing the user to follow a rigid plan.
The primary training programme is a six-session Push/Pull/Legs A/B rotation, but the user can select a different workout, modify exercises, create a custom workout or end a session early.
The application must provide:
Fast, reliable workout logging
Smart progressive overload suggestions
Detailed workout and exercise history
Personal records and strength analytics
Comprehensive exercise information
Customisable machine configurations
Body measurements and transformation photography
Offline-first storage with Supabase synchronisation
An uncluttered mobile interface and capable desktop interface
Core principle: The app must be more useful during an actual workout than a spreadsheet, notebook or generic exercise logger.
The existing UI and workout features are not product requirements and may be replaced. Existing localStorage workout data does not need to be migrated.

2. Existing Project and Technology
2.1 Existing application
Framework: React 19
Build system: Vite 7
Language: TypeScript
Local project folder: C:\My Space\Work Space\my projects\Gym\gym-tracker
Existing application implementation: primarily src/App.tsx
Existing tabs: Today, Exercises, History, Stats
Existing workout storage: browser localStorage
The existing application is a development starting point, not a design constraint.
2.2 Supabase configuration
Project name: GYM TRACKER
Project reference: bqzqiidniitbraapjmyk
URL: https://bqzqiidniitbraapjmyk.supabase.co
Authentication: email/password
Email confirmation: enabled
Frontend client: @supabase/supabase-js
Environment file: .env.local
Existing Supabase client: src/lib/supabase.ts
Environment variable names:
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
The publishable key is used by the frontend. Service-role and secret keys must never be included in client code.
2.3 Completed setup
Supabase project created
Initial relational database schema created
Ten initial public tables created
Supabase client installed
Authentication interface implemented
Signup, login, email confirmation and logout implemented
Authenticated user profile flow implemented
Profile retrieval verified in the running application
Existing TypeScript and build checks passed
2.4 Existing database tables
profiles
exercises
machine_presets
routine_days
routine_exercises
workouts
workout_exercises
workout_sets
cardio_sessions
body_measurements
These tables provide an initial foundation but do not yet fully represent all the requirements in this specification. Additional columns, tables, relationships and storage policies will be needed.
Any schema changes must be planned and applied as migrations, not improvised within UI components.

3. Target Devices and Experience
3.1 Mobile experience
Primary usage: At the gym.
Optimise for:
One-handed operation
Large, easy-to-tap controls
Minimal text entry
Numerical keyboards for weights and reps
Fast switching between exercises
Automatic restoration of unfinished sessions
Readable information in bright or dim environments
Limited reliance on internet connectivity
The workout interface must avoid unnecessary navigation and modal interruptions.
3.2 Desktop experience
Primary usage: Planning routines, reviewing history and analysing performance.
Optimise for:
Wide layouts
Sidebar navigation
Detailed charts
Multiple visible panels
Efficient exercise search and routine editing
Rich photo and measurement comparisons
3.3 Responsive behaviour
Use one responsive web application, not two separate codebases.
The same authenticated account and saved data must be accessible from mobile and desktop.

4. Visual Design System
4.1 Theme modes
Support:
Light
Dark
Follow system preference
The user may manually override the system theme.
Theme preferences must persist between sessions and, where feasible, across devices.
4.2 Visual direction
Modern, clean, restrained and functional.
Prioritise:
Legible typography
Clear numerical values
Distinct completed and incomplete states
Consistent spacing
Accessible contrast
Subtle animations
Strong visual hierarchy
Fast loading
Avoid excessive decorative elements, unnecessary gradients and crowded workout forms.
4.3 Interaction requirements
Large touch targets on mobile
Clear feedback when a set is saved
Visible disabled and loading states
Confirmation before destructive operations
Accessible labels
Proper keyboard navigation on desktop
Reduced-motion compatibility
4.4 Navigation
Five main tabs:
Home
Workout
Exercises
Progress
Profile
Mobile: Bottom navigation bar.
Desktop: Persistent sidebar navigation.
An active workout must remain accessible from any section.

5. Home Dashboard
5.1 Purpose
Provide a concise summary of current training status and immediate next actions.
Home should not duplicate the full analytics dashboard.
5.2 Required components
Next workout
Display:
Suggested next routine
Routine name, such as Push A
Brief exercise count and expected workload, where available
Primary Start Workout action
Option to select another planned workout or create a custom session
Weekly activity
Display:
Number of completed workouts
Simple weekly activity indicator
Recent training days
Recent workouts
Display the latest completed sessions with:
Date
Routine name
Number of exercises
Duration
Link to full workout details
Body-weight trend
Display:
Most recent logged weight
Small historical trend or comparison
Link to body transformation dashboard
Personal records
Display a small selection of recent or notable PRs.
Do not overwhelm Home with every available metric.
5.3 Empty states
For a new user:
Show the next relevant setup action
Offer to create the first routine
Explain that statistics will appear after workouts are logged
Never display fictional performance data as real data

6. Training Programme and Routine Builder
6.1 Core programme
The primary routine consists of six sessions:
Push A
Pull A
Legs A
Push B
Pull B
Legs B
After Legs B, return to Push A.
6.2 Rotation rules
The schedule is completion-based, not tied to fixed weekdays.
Example:
Monday: Push A completed
Tuesday: Rest
Wednesday: Pull A suggested
Rest days do not advance the rotation.
The system must identify the next suggested session based on the recorded workout sequence and the user's explicit advance decisions.
Users may start a different day without losing their routine configuration.
6.3 Custom routine building
The user creates their own routines.
Do not force a predesigned PPL programme.
For each routine day, support:
Routine name
Exercise selection
Exercise order
Target number of sets
Minimum target reps
Maximum target reps
Optional effort target
Personal notes
Exercise groups, including supersets and circuits
Routines remain editable.
6.4 Routine changes
Changing a saved routine must not retroactively modify completed workout history.
When replacing a planned exercise, provide:
Just this workout
Replace the exercise in the active workout only
Keep the saved routine unchanged
Update my routine
Replace the exercise in the saved routine
Use the replacement in future sessions
Preserve all previous training records
6.5 Custom workouts
Support sessions that are not part of the six-day programme.
Custom workouts must not unexpectedly advance the PPL rotation.

7. Active Workout Experience
7.1 Starting a workout
When a workout begins:
Create an active session
Associate it with the chosen routine, if any
Load the planned exercises
Load the user's preferred exercise units
Retrieve previous performance
Retrieve available machine presets
Prepare editable sets
Begin workout-duration tracking
Start saving progress automatically
7.2 Two workout display modes
Overview mode
A vertically scrollable list of exercises.
Each exercise appears as an expandable card containing:
Exercise name
Equipment
Previous performance
Planned sets
Weight and reps fields
Completion controls
Notes
Machine preset
Options to reorder or replace
The user can expand and collapse individual exercises.
Focused mode
Show one exercise at a time.
Include:
Large weight and reps inputs
Current set
Previous performance
Progression suggestion
Set completion button
Previous and Next exercise navigation
Access to machine settings and notes
7.3 Mode switching
The user can switch between Overview and Focused modes during an active workout.
Switching must preserve:
Input values
Completed sets
Current exercise
Notes
Machine presets
Save state
7.4 Persistent workout access
While a workout is active:
Mobile
Display a persistent workout bar above bottom navigation
Show routine name
Show approximate workout completion progress
Provide a Continue action
Desktop
Display workout status and Continue action in the sidebar
The user can browse other sections and return without losing progress.
Only one primary active strength workout should exist per user at a time unless explicit multi-session support is later designed.

8. Set Logging
8.1 Required fields
For each set:
Set number
Weight
Number of reps
Completion state
Optional RPE
Optional set note
8.2 Smart prefilled values
When an exercise is opened, use previous performance to suggest weight and rep values.
Prefilled values are editable and are not considered completed sets.
The app must distinguish between:
Suggested/prefilled values
User-edited values
Completed and saved values
Only completed sets should contribute to completed training statistics.
8.3 User interaction
Completing a set should require minimal effort.
The interface must allow users to:
Edit weight
Edit reps
Mark complete
Undo completion
Add a set
Remove a set
Reorder sets when necessary
Add optional notes
8.4 Set classifications
The confirmed initial interface is detailed rather than fully advanced.
Normal working sets are the primary experience.
The underlying data model may retain support for warm-up, drop or failure classifications, particularly where useful for grouped workouts, but advanced classification controls should remain hidden unless implemented as an optional feature.
8.5 RPE
RPE is optional.
Users must be able to log workouts without entering effort ratings.
Do not require RIR, tempo or other advanced fields for normal logging.
8.6 Weight units
Preferred weight units are configured per exercise.
Supported:
Kilograms
Pounds
The chosen display unit should appear directly beside weight inputs.
Store a canonical converted value for calculations while retaining enough information to reproduce the original displayed weight and unit.
Conversion must not produce misleading extra decimal precision.

9. Progressive Overload
9.1 Confirmed method
Performance-based progression suggestions.
Consider:
Previous completed sets
Actual reps
Weights lifted
Planned rep ranges
Recent performance consistency
Optional RPE
9.2 Suggested actions
Depending on performance, the app may suggest:
Maintain current weight
Increase one or more rep targets
Increase weight by a reasonable available increment
Maintain the target while building consistency
9.3 Example
Exercise target: 3 sets of 8–12 reps.
Previous completed session:
45 lb × 12
45 lb × 12
45 lb × 11
Suggested next target:
Attempt 12 reps on all three sets before increasing weight
9.4 Behaviour rules
Never automatically change actual completed workout data
Never force a suggestion
Explain why each suggestion is being made
Base suggestions on real historical performance
Do not invent improvements
Allow the user to ignore a suggestion
Avoid suggesting weight increases when the evidence is inadequate
Handle missing or inconsistent historical data gracefully
9.5 Exercise-specific targets
Allow each exercise to have targets such as:
Target weight
Target reps
Target sets
Show progress toward the target.
No separate general-purpose goal management system is required in the initial release.

10. Exercise Library
10.1 Library scope
Create a comprehensive, searchable library containing hundreds of exercises.
Include:
Machine exercises
Cable exercises
Dumbbell exercises
Barbell exercises
Bodyweight exercises
Other common strength movements
10.2 Exercise attributes
Each exercise should support:
Name
Primary muscle
Secondary muscles
Equipment
Movement category
Description
Instructions
Technique cues
Common mistakes
Demonstration image
Demonstration animation, where available
Tutorial video or external link
Personal notes
Preferred weight unit
Favourite status
Archived status
10.3 Library sourcing
Use a structured, reliable exercise dataset.
Do not fabricate hundreds of exercise records or made-up demonstration URLs.
For third-party images, videos and animations:
Check source reliability
Check usage rights and attribution requirements
Avoid broken links
Provide fallbacks where media is unavailable
10.4 Custom exercises
Users can create their own exercises with:
Custom name
Muscle-group classification
Equipment
Instructions
Personal notes
Images
Video URLs
Preferred unit
Custom exercises must work with routines, workout history, statistics and machine presets.
10.5 Exercise picker
Support:
Text search
Muscle-group filtering
Equipment filtering
Favourites
Recently used exercises
Context-relevant recommendations
10.6 Alternative exercises
Suggest movements that target similar muscle groups when the planned exercise is unavailable.
Prioritise reasonable alternatives based on:
Primary muscle
Movement pattern
Equipment
Available exercise metadata
Alternatives are suggestions, not automatic replacements.
When replacing a routine exercise, ask whether the change is temporary or permanent.
10.7 Exercise detail screen
Provide:
Exercise guide
Demonstration media
Equipment information
Personal notes
Machine presets
Historical performance
PRs
Progress charts
Relevant alternatives

11. Machine Settings and Presets
11.1 Purpose
Remember exact settings used on gym machines.
11.2 Multiple configurations
Each exercise may have multiple named presets.
Examples:
Hammer Strength Chest Press
Technogym Chest Press
Alternate machine configuration
11.3 Custom fields
Users must be able to create arbitrary setting names and values.
Examples:
Seat height = 4
Backrest = 3
Handle = Wide
Bench angle = 30°
Foot position = High
Starting position = 2
Do not restrict presets to a predefined set of fields.
11.4 Additional data
Each preset may include:
Preset name
Machine name or brand
Custom settings
Personal notes
Optional photos
11.5 Historical accuracy
When using a preset in a workout, save a snapshot of the configuration used.
Editing a preset later must not change previous workout records.

12. Supersets, Trisets and Circuits
12.1 Supported grouping modes
Standard exercise
Superset: two exercises
Triset: three exercises
Circuit: three or more exercises
12.2 Group configuration
Support:
Creating groups in routine planning
Creating groups during an active workout
Reordering exercises within groups
Removing exercises from groups
Changing group type
Ungrouping exercises
12.3 Logging
Every exercise retains its own:
Sets
Weight
Reps
Completion state
Notes
Historical performance
PR calculations
Grouped exercises must not be merged into a single set record.
12.4 Circuit rounds
Support logging multiple rounds while preserving the individual exercise results.
The app does not need a rest timer for supersets or circuits.

13. Workout Duration
13.1 Required capabilities
Automatic start time
Pause
Resume
Finish time
Active duration excluding pauses
Manual corrections
13.2 After completion
Allow correction of:
Start time
End time
Total recorded training duration
13.3 Offline and app closure
Pausing, resuming and closing the app must not corrupt the recorded duration.
Use persisted timestamps and pause intervals rather than relying only on an in-memory JavaScript timer.
13.4 Explicit exclusion
Do not implement a rest timer.
Workout-duration tracking is distinct from between-set rest tracking.

14. Workout Notes
Support optional notes at three levels.
14.1 Workout notes
For overall training observations.
Examples:
Low energy
Felt strong
Interrupted midway
Changed programme today
14.2 Exercise notes
For movement-specific observations.
Examples:
Wider grip felt better
Machine unavailable
Adjusted setup
14.3 Set notes
For observations about one completed or attempted set.
Examples:
Last rep was difficult
Weight felt light
Mild discomfort
Historical notes remain associated with the relevant workout, exercise and set.

15. Completing and Editing Workouts
15.1 Finish flow
When finishing a workout:
Preserve all completed sets
Preserve exercise and session notes
Save workout duration
Determine final completion status
Save to local storage immediately
Queue cloud synchronisation
Show the completion summary
15.2 Incomplete workouts
When ending a session early, ask:
Finish and advance
Save completed work
Count the session as complete for rotation purposes
Advance to the next PPL day
Save as incomplete
Save completed work
Mark the session as incomplete
Do not advance the rotation
Incomplete workouts still contribute their genuinely completed sets to relevant performance calculations.
15.3 Full historical editing
Users may edit completed workouts.
Support:
Weight changes
Rep corrections
Adding sets
Removing sets
Adding exercises
Removing exercises
Reordering exercises
Editing notes
Editing date
Editing duration
Deleting a workout
Show confirmation for destructive actions.
15.4 Recalculations
When historical records change, recalculate dependent:
Personal records
Volume totals
Performance charts
Workout summaries
Training statistics
Relevant rotation state
Do not leave outdated calculated statistics in the UI.

16. Workout Completion Summary
The user selected a detailed summary, without an additional recommendations panel.
Include:
Workout name
Date
Duration
Exercise count
Number of completed sets
Total training volume
PRs achieved
Exercise-by-exercise performance
Comparisons with previous sessions
Progression recommendations remain available while preparing or logging exercises, not as a required section of the completion summary.

17. Workout History
17.1 History access
Workout history should be accessible within the Workout section, with relevant summaries available from Home and Progress.
17.2 Full workout history
Users may browse:
Date
Routine
Duration
Exercises
All sets
Weights
Reps
RPE where recorded
Notes
Machine settings used
Completion status
17.3 Exercise-specific history
Show previous sessions for an exercise.
Include:
Session date
Completed sets
Weight and reps
Training volume
Personal records
Relevant notes
Historical charts
17.4 Editing
History is editable according to the full historical editing rules.

18. Personal Records
Calculate automatically from completed performance data.
18.1 Required PR types
Heaviest weight
Highest completed load for the exercise.
Most reps at a given weight
Highest rep count achieved at a particular load.
Estimated one-rep maximum
Calculate an estimated 1RM using a defined formula.
Label estimates clearly; do not present them as actual tested maximums.
Highest exercise session volume
Highest total completed weight × reps for an exercise in a single session.
18.2 Calculation requirements
Use canonical units
Exclude incomplete sets
Recalculate after edits
Handle bodyweight exercises appropriately
Avoid misleading estimated 1RM results from unusually high-rep sets
Clearly distinguish all-time records from recent performance
Custom milestone tracking is not part of the initial specification.

19. Advanced Training Analytics
19.1 Exercise charts
Visualise:
Weight progression
Repetition progression
Estimated strength progression
Exercise volume across sessions
19.2 Weekly training volume
Provide:
Total completed sets
Total lifted volume
Comparisons across weeks
19.3 Muscle-group distribution
Show approximate training distribution by major muscle group.
Account for the exercise's primary and secondary muscles without automatically treating every muscle involved as an equal full set.
Use a consistent, documented counting method.
19.4 Consistency
Display:
Sessions per week
Workout frequency over time
Training streaks
Historical activity
The rotation remains independent of weekday scheduling.
19.5 Performance insights
Include:
Estimated strength trends
Recent improvements
Possible plateaus
Changes in training volume
Insights must be based on sufficient actual data.
Use cautious language for plateau detection rather than presenting it as a medical or coaching diagnosis.
19.6 Filters
Recommended analytics filters:
Date range
Exercise
Muscle group
Routine day

20. Exercise-Specific Targets
Allow exercise-level targets.
Examples:
50 lb × 12 reps
3 sets × 10 reps
Planned rep-range completion
Display progress toward those targets using saved performance.
Exercise-specific targets must not overwrite actual workout logs.
Broader weekly workout goals and body-composition target programmes are not included in the initial confirmed requirements.

21. Standalone Cardio Tracking
21.1 Important requirement
Cardio sessions are standalone, not attached to strength workouts.
A cardio session can be created independently on any date.
21.2 Cardio fields
Support, where applicable:
Activity type
Date
Duration
Distance
Speed
Incline
Resistance
Average heart rate
Estimated calories
Notes
Machine-specific settings
21.3 Supported activities
Examples:
Treadmill
Walking
Running
Cycling
Elliptical
Stair climber
Other cardio
21.4 Cardio history
Provide:
Chronological sessions
Session detail view
Duration trends
Distance trends
Relevant performance comparisons
No recurring cardio plan or separate cardio-goal system is required.

22. Body Measurements
22.1 Required measurements
Support:
Body weight
Body-fat percentage
Chest
Waist
Hips
Arms
Thighs
Neck
Other custom measurement types where practical
22.2 Measurement entries
Each entry should retain:
Date
Measurement values
Units
Notes
Creation and update timestamps
22.3 Historical charts
Provide charts for:
Weight
Body fat
Individual circumference measurements
22.4 Comparison
Allow selecting two dates or periods and show numerical changes.
Show the direction of the change, but avoid automatically classifying every gain or loss as good or bad.

23. Progress Photos and Transformation Dashboard
23.1 Photo capture
Support dated progress photos in categories:
Front
Side
Back
Optional other
Users may upload photos from mobile or desktop.
23.2 Privacy
Photos must be private to the authenticated user.
Use private Supabase Storage buckets with ownership-aware storage policies.
Do not use publicly accessible permanent image URLs for private progress photos.
23.3 Timeline
Display photos by date.
Allow:
Browsing history
Opening full-size images
Editing date and category
Replacing images
Deleting images with confirmation
23.4 Comparisons
Provide:
Side-by-side photo comparisons
Date selectors
Interactive before/after slider
Matching front/side/back views
23.5 Transformation dashboard
Combine:
Selected progress photos
Body-weight changes
Body-fat changes
Circumference measurement changes
Historical trends
Summaries for selected time periods
23.6 Image handling
Recommended implementation requirements:
Validate image type and size
Compress suitable uploads
Preserve an adequate-resolution original where appropriate
Remove unnecessary image metadata where practical
Support interrupted-upload recovery
Avoid rendering full-resolution files in large gallery grids

24. Offline-First Saving and Cloud Synchronisation
24.1 Required principle
Never require a working internet connection to record a workout.
24.2 Local persistence
Automatically save:
Active workout
Exercise order
Set inputs
Completed sets
Notes
Machine configurations used
Workout duration state
Unfinished changes
Persistence should survive refreshes and browser closure.
24.3 Recommended local storage
Use IndexedDB for structured offline records and a durable synchronisation queue.
Existing localStorage workout data does not need to be migrated.
LocalStorage may remain appropriate for small interface preferences.
24.4 Synchronisation
When connected:
Upload queued changes
Retrieve current server data
Track synchronisation state
Retry transient failures
Avoid duplicate records
24.5 Synchronisation indicators
Display understandable states:
Saved locally
Syncing
Synced
Offline, waiting to sync
Sync error
24.6 Conflict protection
Prevent silent overwrites when edits occur on more than one device.
Recommended strategy:
Stable UUIDs generated on the client
Local operation queue
Idempotent write operations
Row revision or version checking
Explicit conflict resolution when the system cannot safely merge changes
Do not use unconditional last-write-wins for competing completed workout edits.
24.7 Offline limitations
Strength workout logging must work offline.
Functions requiring online resources, such as remote videos, exercise-library downloads or photo uploads, may be deferred until connectivity returns.
Don't imply those features are available offline unless their data has actually been cached.

25. Authentication and User Profiles
25.1 Authentication
Keep the existing working Supabase authentication.
Support:
Email signup
Email confirmation
Login
Session persistence
Logout
Error handling
25.2 User profile
Store and manage:
Display name
Timezone
Default weight unit
Distance unit
Theme preference
Other non-sensitive interface preferences
25.3 Account experience
Do not display raw authentication UUIDs, developer status messages or backend diagnostics as major elements of the normal UI.
Technical information should be accessible only where useful for troubleshooting.
25.4 Data isolation
Every authenticated user must access only their own:
Workouts
Routines
Custom exercises
Machine presets
Body measurements
Progress photos
User preferences

26. Application Navigation and Screen Structure
26.1 Home
Sections:
Next workout
Weekly activity
Recent workouts
Body-weight trend
Recent PRs
26.2 Workout
Sections/screens:
Routine rotation overview
PPL routine builder
Active workout
Focused exercise view
Workout history
Workout detail and editing
Completion summary
Standalone cardio logger
Cardio history
26.3 Exercises
Sections/screens:
Exercise library
Search and filtering
Exercise detail
Exercise demonstrations
Custom exercise editor
Machine presets
Exercise performance
Alternative exercise picker
26.4 Progress
Sections/screens:
Training analytics overview
Strength progression
Personal records
Muscle-group distribution
Consistency
Exercise-specific charts
Body measurements
Progress photos
Transformation comparisons
26.5 Profile
Sections/screens:
Account details
Units
Theme
Timezone
Relevant application preferences
Logout

27. Recommended Frontend Architecture
The current monolithic App.tsx should be refactored into maintainable components.
Suggested structure:
src/app/
App shell
Navigation
Routing
Theme handling
src/features/auth/
Login and signup
Authentication state
Profile loading
src/features/home/
Dashboard components
src/features/workouts/
Routine rotation
Routine builder
Workout session
Exercise cards
Set editor
Completion summary
History
src/features/exercises/
Exercise library
Search
Exercise guide
Exercise editor
Machine presets
Alternatives
src/features/cardio/
Cardio logger
Cardio history
src/features/progress/
Training charts
PR calculations
Body measurements
Photo comparisons
src/features/settings/
Preferences
Theme
Account settings
src/lib/
Supabase client
Unit conversion
Date handling
Shared utilities
src/data/
Local persistence
Sync queue
Repository interfaces
Database adapters
src/types/
Shared domain types
This structure is a technical recommendation, not a requirement to use these exact folder names.

28. Database Architecture Changes Required
The initial ten tables need to be audited against the complete product requirements.
28.1 Existing tables to extend
profiles
Potential additions:
Theme preference
Other UI preferences
exercises
Potential additions:
Preferred weight unit
Exercise guide metadata
Video references
Source attribution
Favourites
Shared/global versus user-owned exercise handling
machine_presets
Potential additions:
Machine images
Flexible custom-setting definitions
Better preset naming and metadata
routine_days and routine_exercises
Potential additions:
Group membership
Superset/triset/circuit ordering
Exercise-specific targets
workouts
Potential additions:
Pause/resume duration data
Effective active duration
Rotation advance decision
Explicit incomplete status
Synchronisation revision metadata
workout_exercises
Potential additions:
Group identifiers
Historical exercise snapshots
Preset references where appropriate
workout_sets
Potential additions:
Original input unit
Historical calculated or displayed values as necessary
Group round information
Synchronisation metadata
cardio_sessions
Potential additions:
Speed
Incline
Resistance
Correct historical units and settings
body_measurements
Potential additions:
Custom measurements
Sync/version metadata
28.2 Likely new tables
Recommended additional entities include:
exercise_media
exercise_favourites
exercise_alternatives
exercise_targets
exercise_groups
exercise_group_members
progress_photos
workout_pause_intervals
sync_metadata or equivalent versioning mechanisms
The exact schema should be determined before coding, including which records are global versus user-owned.
28.3 Exercise catalogue considerations
The preloaded exercise library should not require duplicating hundreds of identical exercises for every registered user.
Consider a shared read-only exercise catalogue plus user-owned customisations and exercises.
Preserve secure user ownership over private additions and preferences.
28.4 Database security
Enable RLS on exposed tables
Enforce authenticated ownership
Protect private progress photos
Validate relationships between user-owned records
Use least-privilege database access
Keep secret credentials server-side
Security should be built into the implementation, without becoming the main focus of product design.

29. Analytics and Calculation Rules
29.1 Training volume
Calculate completed lifting volume as:
sum(weight × reps)
Use canonical units during calculations.
Display the output using a clearly labelled unit.
Handle assisted, bodyweight and non-standard resistance exercises separately where load representation differs.
29.2 Completed set counts
Count only sets explicitly marked completed.
29.3 Workout duration
Calculate active workout duration after subtracting all paused intervals, unless the user has explicitly overridden duration.
29.4 Estimated one-rep maximum
Use a consistent estimated 1RM formula.
Document the formula and limit its application to suitable set data.
29.5 Rotation position
Use completed programme sessions and explicit advancement decisions rather than inferring rotation from calendar dates alone.
29.6 Historical edits
Use the latest saved valid historical state when computing statistics.
29.7 Units
Perform canonical conversion for stored calculations and use display preferences for presentation.
Avoid mixing kilograms and pounds without explicit conversion.
29.8 Dates and timezones
Store timestamps with timezone information where relevant.
Store the intended local workout date separately.
Do not accidentally move a workout to another date because of UTC conversion.

30. Performance and Reliability
30.1 Speed
Quick initial navigation
Responsive weight and rep inputs
No blocking network request when completing a set
Optimised long exercise lists
Lazy-loaded guides and media
Efficient chart rendering
30.2 Workout data integrity
No lost completed sets
No duplicate workouts on retry
No accidentally duplicated sets after sync
No historical changes from editing a routine template
Recovery from browser refresh
Safe handling of intermittent connectivity
30.3 Error handling
Use clear messages with useful recovery actions.
Examples:
Workout saved locally; cloud sync pending
Unable to download tutorial video
Photo upload failed; retry
Another device changed this workout; review conflict
Do not show raw database errors to users unless they are in a dedicated developer diagnostic view.

31. Explicitly Excluded Features
The following features were declined or are not part of the confirmed initial scope:
Rest timers
Workout reminders
Push notification reminders
Measurement check-in notifications
Milestone alerts
Fixed Monday-to-Sunday training schedule
Forced automatic exercise substitutions
Forced progressive overload increases
Locking completed workouts from editing
Requiring advanced RIR or tempo fields during normal logging
Mandatory integration with wearable devices
Separate recurring cardio goal programmes
General-purpose body-weight goal management
User-defined custom PR milestone systems
Mandatory migration of existing localStorage workout data
Avoid adding these features automatically.

32. Implementation Strategy for Codex
Do not ask Codex to implement the entire specification in one unreviewed operation.
Use this specification as the authoritative requirements document, then implement in controlled phases.
Phase 1 — Application shell and design system
Build:
Responsive layout
Five-tab navigation
Theme support
Mobile bottom navigation
Desktop sidebar
Updated authentication presentation
Shared reusable components
Acceptance: All five sections navigate correctly on mobile and desktop.
Phase 2 — Exercise library and routine planning
Build:
Comprehensive library foundation
Exercise search and filters
Custom exercises
Exercise guides
Machine presets
PPL A/B routine builder
Exercise groups and alternatives
Acceptance: A user can create and edit a complete six-day programme.
Phase 3 — Core workout logging
Build:
Start workout
Overview and focused views
Set logging
Previous-session values
Optional RPE and notes
Pause/resume duration
Persistent active workout bar
Incomplete workout handling
Detailed completion summary
Acceptance: A user can complete a full gym session using a phone without needing to refresh or navigate to another application.
Phase 4 — Offline-first persistence and Supabase
Build:
IndexedDB persistence
Stable record IDs
Cloud sync
Retry queue
Conflict protection
Session restoration
Relevant database migrations
Acceptance: A workout started offline can be completed, saved, reopened and eventually synchronised without duplicate or lost records.
The active workout logging workflow must be designed to support offline persistence from the beginning, even if full cloud sync is delivered in this phase.
Phase 5 — History and progression
Build:
Detailed workout history
Full workout editing
Exercise history
Exercise-specific targets
Progressive overload suggestions
Personal records
Strength charts
Acceptance: Completed sessions can be reviewed, corrected and compared without producing inaccurate statistics.
Phase 6 — Cardio and body transformation
Build:
Standalone cardio tracking
Body measurements
Progress photo storage
Transformation dashboard
Interactive photo comparison
Acceptance: Cardio, measurements and progress photos can be saved and reviewed privately.
Phase 7 — Advanced analytics and final polish
Build:
Weekly training volume
Muscle-group distribution
Consistency analytics
Performance trends
Plateau indicators
Responsive layout refinements
Performance optimisation
Acceptance: Statistics reflect actual data and remain correct after editing historical records.

33. Testing and Quality Requirements
33.1 Automated tests
Cover:
Unit conversion
Workout rotation
Incomplete workout advancement
Personal record calculations
Training volume
Exercise targets
Duration and pause calculations
Historical workout edits
Offline operation queue
Conflict detection
33.2 Integration tests
Cover:
Authentication
Profile loading
Routine persistence
Workout persistence
Exercise relationships
Private photo access
RLS restrictions
33.3 User-flow tests
Verify:
New user signs up and logs in.
User creates a six-day routine.
User searches and selects exercises.
User creates machine presets.
User starts the suggested routine.
User switches between overview and focused views.
User changes weights, reps and notes.
User completes sets.
User replaces an exercise temporarily.
User pauses and resumes workout duration.
User closes and reopens the app.
User resumes the unfinished workout.
User finishes the workout.
User reviews the completion summary.
User edits an old workout.
Personal records and charts update.
User performs a standalone cardio session.
User uploads private progress photos.
User compares two transformation dates.
User switches devices and retrieves synchronised data.
33.4 Release criteria
No feature is considered complete merely because TypeScript compiles.
The relevant user interaction must actually work, and persisted data must remain correct.

34. Confirmed Decisions Checklist
Mobile at the gym, desktop for planning and analytics
Hybrid guided/manual workout experience
Smart prefilled logging with progression suggestions
No rest timer
Detailed exercise tracking
Comprehensive preloaded and custom exercise library
Rotating PPL A/B programme
Complete workout history and advanced insights
Body measurements and progress photos
Adaptive light and dark themes
Switchable overview and focused workout views
Offline-first automatic saving
Full editing of completed workouts
Balanced Home dashboard
User-built PPL A/B routines
Temporary or permanent exercise substitutions, chosen each time
Full exercise guides, videos and tutorial links
Preferred weight unit per exercise
Customisable machine settings and multiple presets
Detailed standalone cardio tracking
Complete transformation dashboard with interactive comparisons
No reminders or notifications
Smart exercise picker with exercise alternatives
Supersets, trisets and circuits
Multiple types of personal records
Exercise-specific training targets
Performance-based progressive overload suggestions
Detailed workout completion summary
Five main navigation tabs
Persistent active workout bar
Pause, resume and editable workout duration
Workout, exercise and set notes
User-controlled rotation advancement for incomplete workouts

35. Remaining Design and Implementation Decisions
These details have not been explicitly finalised. They should be resolved during UI design and technical planning, rather than assumed.
Product decisions
Exact visual design: typography, colours, spacing and card styling
Detailed layout of each screen
Initial contents of the user's six PPL routines
Exercise dataset and media provider
Exact progression thresholds and weight increments
Behaviour for deleting versus archiving custom exercises
How to handle unusual exercises such as assisted pull-ups and bodyweight movements
Photo upload size and storage limits
Whether to provide an installable PWA experience and the precise offline scope beyond workout logging
Engineering decisions
Exercise catalogue ownership model
Database migration design
Offline conflict resolution UI and revision strategy
Whether a dedicated synchronisation service or worker is appropriate
Global state management approach
Charting library
Exercise media licensing and hosting
Image processing and caching
Test framework and deployment environment
These are intentionally open. They do not invalidate the confirmed product scope.

36. Definition of Success
The gym tracker is successful when the user can walk into the gym, open the app on their phone, see the suggested PPL workout, view previous weights and machine settings, log every set with minimal effort, receive helpful progression suggestions, and finish the session without worrying about connectivity or lost data.
Later, on a desktop, the same user can review complete history, compare strength progression, manage routines, analyse training patterns and track physical transformation through measurements and private progress photos.
Final product objective: A personalised, reliable and easy-to-use gym tracker built around the user's actual training behaviour — not a generic fitness template.

