// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
const API_BASE = ""; // your backend origin or empty for same-origin

// --- Helpers ---------------------------------------------------------------
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const load = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// --- Storage Keys ----------------------------------------------------------
const SK = {
  EXERCISES: "wt_exercises_v1",
  WORKOUTS: "wt_workouts_v1",
  PREFS: "wt_prefs_v1",
  FITBIT_DAILY: "wt_fitbit_daily_v1",
};

// --- Default Data ----------------------------------------------------------
const DEFAULT_EXERCISES = [
  { id: uid(), name: "Barbell Squat", category: "Legs", image: "" },
  { id: uid(), name: "Bench Press", category: "Chest", image: "" },
  { id: uid(), name: "Deadlift", category: "Back", image: "" },
  { id: uid(), name: "Overhead Press", category: "Shoulders", image: "" },
  { id: uid(), name: "Pull-up", category: "Back", image: "" },
];

// --- UI Bits ---------------------------------------------------------------
function Pill({ children, className = "" }) {
  return (
    <span className={"inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-gray-100 " + className}>
      {children}
    </span>
  );
}

function Section({ title, right, children }) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div>{right}</div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">{children}</div>
    </section>
  );
}

function TextInput({ label, value, onChange, placeholder = "", type = "text" }) {
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <input
        className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
      />
    </label>
  );
}

function NumberInput({ label, value, onChange, placeholder = "" }) {
  return (
    <TextInput
      label={label}
      value={value}
      onChange={(v) => onChange(Number(v))}
      placeholder={placeholder}
      type="number"
    />
  );
}

function Button({ children, onClick, variant = "primary", disabled = false, type = "button" }) {
  const base = "px-3 py-2 rounded-xl text-sm font-medium transition shadow-sm";
  const styles = {
    primary: "bg-black text-white hover:bg-black/90 disabled:bg-gray-300",
    ghost: "bg-white text-gray-800 hover:bg-gray-50 border border-gray-200",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]}`}>
      {children}
    </button>
  );
}

// --- Main Component --------------------------------------------------------
export default function WorkoutTrackerApp() {
  
  const [viewer, setViewer] = useState({ open: false, src: "", alt: "" });
  const [exercises, setExercises] = useState(() => load(SK.EXERCISES, DEFAULT_EXERCISES));
  const [workouts, setWorkouts] = useState(() => load(SK.WORKOUTS, []));
  const [tab, setTab] = useState(() => load(SK.PREFS, { tab: "today" }).tab);
  const [fitbitLinked, setFitbitLinked] = useState(false);
  const [fitbitDaily, setFitbitDaily] = useState(() => load(SK.FITBIT_DAILY, {}));

  useEffect(() => save(SK.EXERCISES, exercises), [exercises]);
  useEffect(() => save(SK.WORKOUTS, workouts), [workouts]);
  useEffect(() => save(SK.PREFS, { tab }), [tab]);
  useEffect(() => save(SK.FITBIT_DAILY, fitbitDaily), [fitbitDaily]);

  // Check Fitbit link status (backend should set an httpOnly cookie after OAuth)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/fitbit/status`, { credentials: 'include' });
        if (res.ok) {
          const j = await res.json();
          setFitbitLinked(!!j.linked);
        }
      } catch (_) {}
    })();
  }, []);

  const active = workouts.find((w) => w.inProgress);

  const recent = useMemo(() => {
    const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
    return workouts.filter((w) => !w.inProgress && new Date(w.date).getTime() >= cutoff);
  }, [workouts]);

  const totalVolume30 = useMemo(
    () =>
      recent.reduce(
        (acc, w) =>
          acc +
          w.items.reduce((a, it) => a + it.sets.reduce((s, st) => s + st.weight * st.reps, 0), 0),
        0
      ),
    [recent]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-xl font-bold tracking-tight">Gym Tracker</div>
          <nav className="flex gap-1">
            {[
              { id: "today", label: "Today" },
              { id: "exercises", label: "Exercises" },
              { id: "history", label: "History" },
              { id: "stats", label: "Stats" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  tab === t.id ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {tab === "today" && (
          <TodayTab
            exercises={exercises}
            active={active}
            onStart={() => startWorkout(setWorkouts)}
            onEnd={(notes) => endWorkout(setWorkouts, notes)}
            onAddSet={(payload) => addSetToWorkout(setWorkouts, payload)}
            onAddExerciseToSession={(exerciseId) => addExerciseToSession(setWorkouts, exerciseId)}
            onRemoveItem={(itemId) => removeExerciseFromSession(setWorkouts, itemId)}
            setViewer={setViewer}
          />
        )}
        {tab === "exercises" && (
          <ExercisesTab
            exercises={exercises}
            setExercises={setExercises}
            setTab={setTab}
            setViewer={setViewer}
          />
        )}
        {tab === "history" && <HistoryTab workouts={workouts} fitbitDaily={fitbitDaily} fitbitLinked={fitbitLinked} onSyncFitbit={async (date)=>{
          try {
            const res = await fetch(`${API_BASE}/api/fitbit/daily?date=${date}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Fitbit fetch failed');
            const j = await res.json();
            setFitbitDaily((prev)=>({ ...prev, [date]: j }));
            return { ok: true };
          } catch (e) {
            console.warn(e);
            return { ok: false, error: String(e) };
          }
        }} />}
        {tab === "stats" && <StatsTab workouts={workouts} totalVolume30={totalVolume30} />}
      </main>

      <ImageViewer viewer={viewer} onClose={() => setViewer({ open: false, src: "", alt: "" })} />
    </div>
  );
}

// --- Tab: Today ------------------------------------------------------------
function TodayTab({ exercises, active, onStart, onEnd, onAddSet, onAddExerciseToSession, onRemoveItem, setViewer }) {
  const [notes, setNotes] = useState("");
  const [exerciseToAdd, setExerciseToAdd] = useState(exercises[0]?.id || "");

  return (
    <div>
      <Section
        title={`Workout — ${todayISO()}`}
        right={!active ? <Button onClick={onStart}>Start</Button> : <Button variant="danger" onClick={() => onEnd(notes)}>Complete</Button>}
      >
        {!active ? (
          <p className="text-gray-600">
            Tap <strong>Start</strong> to begin a session. Add any exercise you want — it's fully
            customizable.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 items-end">
              <label className="flex-1">
                <div className="text-sm text-gray-600 mb-1">Add exercise</div>
                <select
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  value={exerciseToAdd}
                  onChange={(e) => setExerciseToAdd(e.target.value)}
                >
                  {exercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="ghost" onClick={() => onAddExerciseToSession(exerciseToAdd)}>
                Add
              </Button>
            </div>

            {active.items.length === 0 && (
              <p className="text-gray-600">No exercises in this session yet. Add your first one above.</p>
            )}

            <div className="space-y-4">
              {active.items.map((item) => (
                <ExerciseCard key={item.id} item={item} onAddSet={onAddSet} setViewer={setViewer} onRemoveItem={() => onRemoveItem(item.id)} />
              ))}
            </div>

            <TextInput label="Notes" value={notes} onChange={setNotes} placeholder="How did it feel?" />
          </div>
        )}
      </Section>

      {active && (
        <Section title="Quick Tips">
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>Use whatever rep/weight scheme you want — pyramid, EMOM, drop sets, etc.</li>
            <li>Long-press (or click-hold) the reps/weight fields to select-all and speed up edits.</li>
          </ul>
        </Section>
      )}
    </div>
  );
}

function ExerciseCard({ item, onAddSet, setViewer, onRemoveItem }) {
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(50);
  const [rpe, setRpe] = useState(8);

  return (
    <div className="rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium flex items-center gap-2">
          {item.image && (
            <img
              src={item.image}
              alt={item.name}
              className="w-20 h-20 object-contain rounded-xl bg-gray-100 cursor-pointer"
              onClick={() => setViewer({ open: true, src: item.image, alt: item.name })}
            />
          )}
          {item.name}
        </div>
        <div className="flex items-center gap-2">
          <Pill>{item.sets.length} sets</Pill>
          <Button variant="ghost" onClick={onRemoveItem}>Remove</Button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <NumberInput label="Reps" value={reps} onChange={setReps} />
        <NumberInput label="Weight" value={weight} onChange={setWeight} />
        <NumberInput label="RPE" value={rpe} onChange={setRpe} />
        <div className="flex items-end">
          <Button onClick={() => onAddSet({ itemId: item.id, reps, weight, rpe })}>Add Set</Button>
        </div>
      </div>
      {item.sets.length > 0 && (
        <div className="mt-3 text-sm">
          <div className="text-gray-500 mb-1">Logged Sets</div>
          <div className="space-y-1">
            {item.sets.map((s, idx) => (
              <div key={idx} className="flex justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div>Set {idx + 1}</div>
                <div className="text-gray-700">
                  {s.reps} × {s.weight} kg • RPE {s.rpe}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Tab: Exercises --------------------------------------------------------
function ExercisesTab({ exercises, setExercises, setTab, setViewer }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState("");

  const addExercise = () => {
    if (!name.trim()) return;
    setExercises((prev) => [
      { id: uid(), name: name.trim(), category: category.trim() || "Other", image: image.trim() },
      ...prev,
    ]);
    setName("");
    setCategory("");
    setImage("");
  };

  const removeExercise = (id) => setExercises((prev) => prev.filter((e) => e.id !== id));

  return (
    <div>
      <Section
        title="Add Exercise"
        right={
          <Button variant="ghost" onClick={() => setTab("today")}>
            Go to Today
          </Button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <TextInput label="Name" value={name} onChange={setName} placeholder="e.g., Bulgarian Split Squat" />
          <TextInput label="Category" value={category} onChange={setCategory} placeholder="e.g., Legs" />
          <TextInput label="Image URL" value={image} onChange={setImage} placeholder="http://..." />
          <div className="flex items-end">
            <Button onClick={addExercise}>Add</Button>
          </div>
        </div>
      </Section>

      <Section title="Your Library">
        <ul className="divide-y divide-gray-100">
          {exercises.map((e) => (
            <li key={e.id} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {e.image && (
                  <img
                    src={e.image}
                    alt={e.name}
                    className="w-20 h-20 object-contain rounded-xl bg-gray-100 cursor-pointer"
                    onClick={() => setViewer({ open: true, src: e.image, alt: e.name })}
                  />
                )}
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-sm text-gray-500">{e.category}</div>
                </div>
              </div>
              <Button variant="ghost" onClick={() => removeExercise(e.id)}>
                Remove
              </Button>
            </li>
          ))}
          {exercises.length === 0 && <p className="text-gray-600">No exercises yet. Add your first above.</p>}
        </ul>
      </Section>
    </div>
  );
}

// --- Tab: History ----------------------------------------------------------
function HistoryTab({ workouts, fitbitDaily = {}, fitbitLinked = false, onSyncFitbit }) {
  const finished = useMemo(() => workouts.filter((w) => !w.inProgress), [workouts]);
  const byDate = useMemo(() => {
    const map = new Map();
    finished.forEach((w) => map.set(w.date, w));
    return map; // date(YYYY-MM-DD) -> workout
  }, [finished]);

  // Month state
  const [month, setMonth] = useState(() => {
    const base = finished.length ? new Date(finished[finished.length - 1].date) : new Date();
    base.setDate(1);
    return base;
  });

  // Selected date state
  const [selectedDate, setSelectedDate] = useState(() => (finished.length ? finished[finished.length - 1].date : todayISO()));

  const workoutForSelected = byDate.get(selectedDate);
  const fitbitForSelected = fitbitDaily[selectedDate];

  const changeMonth = (delta) => {
    const d = new Date(month);
    d.setMonth(d.getMonth() + delta);
    setMonth(d);
  };

  const monthMeta = getMonthGridMeta(month);

  return (
    <Section title="Workout Calendar" right={
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => changeMonth(-1)}>{"<"}</Button>
        <div className="text-sm text-gray-600 w-28 text-center">{formatMonthYear(month)}</div>
        <Button variant="ghost" onClick={() => changeMonth(1)}>{">"}</Button>
      </div>
    }>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {monthMeta.cells.map((cell) => {
          const iso = cell.iso;
          const has = byDate.has(iso);
          const isOther = cell.otherMonth;
          const isSelected = iso === selectedDate;
          return (
            <button
              key={iso}
              onClick={() => setSelectedDate(iso)}
              className={`relative aspect-square rounded-xl border text-sm flex items-center justify-center transition
                ${isSelected ? 'border-black ring-2 ring-black/10' : 'border-gray-200'}
                ${isOther ? 'text-gray-400 bg-gray-50' : 'bg-white'}`}
            >
              {cell.day}
              {has && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500" />}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {!workoutForSelected ? (
          <p className="text-gray-600 text-sm">No workout logged on <span className="font-medium">{selectedDate}</span>.</p>
        ) : (
          <div className="rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="font-medium">{selectedDate}</div>
              <Pill>{workoutForSelected.items.reduce((acc, it) => acc + it.sets.length, 0)} sets</Pill>
            </div>
            <ul className="text-sm text-gray-700 list-disc list-inside">
              {workoutForSelected.items.map((it) => (
                <li key={it.id}>
                  <span className="font-medium">{it.name}:</span>{" "}
                  {it.sets.map((s) => `${s.reps}x${s.weight}kg`).join(", ")}
                </li>
              ))}
            </ul>
            {workoutForSelected.notes && <p className="text-sm text-gray-600 mt-2">📝 {workoutForSelected.notes}</p>}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-md font-semibold">Fitbit</h3>
          {!fitbitLinked ? (
            <Button variant="ghost" onClick={() => {
              // redirect to backend OAuth start
              const redirect = encodeURIComponent(window.location.href);
              window.location.href = `${API_BASE}/api/fitbit/auth?redirect=${redirect}`;
            }}>Connect</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onSyncFitbit(selectedDate)}>Sync {selectedDate}</Button>
              <Button variant="ghost" onClick={() => window.open('https://www.fitbit.com/settings/applications','_blank')}>Manage</Button>
            </div>
          )}
        </div>
        {!fitbitForSelected ? (
          <p className="text-gray-600 text-sm">No Fitbit data for <span className="font-medium">{selectedDate}</span>. {fitbitLinked ? 'Tap Sync to fetch it.' : 'Connect Fitbit to sync.'}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Steps" value={fitbitForSelected.steps ?? '—'} />
            <StatCard label="Calories" value={fitbitForSelected.caloriesOut ?? '—'} />
            <StatCard label="HR Avg" value={fitbitForSelected.hrAvg ?? '—'} suffix={fitbitForSelected.hrAvg ? 'bpm' : ''} />
            <StatCard label="Sleep" value={fitbitForSelected.sleepMinutes ?? '—'} suffix={fitbitForSelected.sleepMinutes ? 'min' : ''} />
          </div>
        )}
      </div>
    </Section>
  );
}

// --- Calendar helpers ------------------------------------------------------
function daysInMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return d.getDate();
}
function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
}
function formatMonthYear(date) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}
function getMonthGridMeta(date) {
  const total = daysInMonth(date);
  const firstIdx = firstDayOfMonth(date); // 0..6
  const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const prevDays = daysInMonth(prevMonth);

  const cells = [];
  // leading from previous month
  for (let i = firstIdx - 1; i >= 0; i--) {
    const day = prevDays - i;
    const iso = toISO(prevMonth.getFullYear(), prevMonth.getMonth(), day);
    cells.push({ day, iso, otherMonth: true });
  }
  // current month
  for (let d = 1; d <= total; d++) {
    const iso = toISO(date.getFullYear(), date.getMonth(), d);
    cells.push({ day: d, iso, otherMonth: false });
  }
  // trailing to complete 6 rows (42 cells)
  let trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    const iso = toISO(nextMonth.getFullYear(), nextMonth.getMonth(), d);
    cells.push({ day: d, iso, otherMonth: true });
  }
  return { cells };
}
function toISO(y, m0, d) {
  const mm = String(m0 + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

// --- Tab: Stats ------------------------------------------------------------
function StatsTab({ workouts, totalVolume30 }) {
  const sessions = workouts.filter((w) => !w.inProgress).length;
  const prMap = new Map();
  workouts.forEach((w) =>
    w.items.forEach((it) =>
      it.sets.forEach((s) => {
        const key = it.name;
        prMap.set(key, Math.max(prMap.get(key) || 0, s.weight));
      })
    )
  );

  const prs = Array.from(prMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <Section title="Overview">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Sessions" value={sessions} />
          <StatCard label="30d Volume" value={formatNumber(totalVolume30)} suffix="kg" />
          <StatCard label="Exercises" value={uniqueExerciseCount(workouts)} />
          <StatCard label="Best Streak" value={bestStreak(workouts)} suffix="d" />
        </div>
      </Section>

      <Section title="Top PRs">
        {prs.length === 0 ? (
          <p className="text-gray-600">Log some sets to see PRs.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {prs.map(([name, w]) => (
              <li key={name} className="rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                <div className="font-medium">{name}</div>
                <div className="text-xl">
                  {w}
                  <span className="text-sm text-gray-500"> kg</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function StatCard({ label, value, suffix }) {
  return (
    <div className="rounded-2xl border border-gray-100 p-4 bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">
        {value}
        {suffix ? <span className="text-sm text-gray-400"> {suffix}</span> : null}
      </div>
    </div>
  );
}

function formatNumber(n) {
  try {
    return new Intl.NumberFormat().format(n);
  } catch {
    return String(n);
  }
}

function uniqueExerciseCount(workouts) {
  const set = new Set();
  workouts.forEach((w) => w.items.forEach((it) => set.add(it.name)));
  return set.size;
}

function bestStreak(workouts) {
  const dates = Array.from(new Set(workouts.filter((w) => !w.inProgress).map((w) => w.date))).sort();
  if (!dates.length) return 0;
  let best = 1,
    cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const d0 = new Date(dates[i - 1]);
    const d1 = new Date(dates[i]);
    const diff = (d1 - d0) / (1000 * 60 * 60 * 24);
    if (diff <= 1.1) cur++;
    else {
      best = Math.max(best, cur);
      cur = 1;
    }
  }
  return Math.max(best, cur);
}

function removeExerciseFromSession(setWorkouts, itemId) {
  setWorkouts((prev) =>
    prev.map((w) => {
      if (!w.inProgress) return w;
      return { ...w, items: w.items.filter((it) => it.id !== itemId) };
    })
  );
}

// --- Merge helper to ensure single workout per date -----------------------
function consolidateWorkoutsByDate(workouts) {
  const map = new Map();
  const order = [];
  for (const w of workouts) {
    const key = w.date;
    if (!map.has(key)) {
      map.set(key, { ...w, items: [...w.items] });
      order.push(key);
    } else {
      const tgt = map.get(key);
      tgt.items = [...tgt.items, ...w.items];
      if (w.notes) tgt.notes = tgt.notes ? `${tgt.notes} | ${w.notes}` : w.notes;
      tgt.inProgress = tgt.inProgress || w.inProgress;
    }
  }
  return order.map((k) => map.get(k));
}

// --- Actions (mutating helpers) -------------------------------------------
function startWorkout(setWorkouts) {
  setWorkouts((prev) => {
    const hasActive = prev.some((w) => w.inProgress);
    if (hasActive) return prev; // keep single active session
    const today = todayISO();
    const idx = prev.findIndex((w) => !w.inProgress && w.date === today);
    if (idx !== -1) {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], inProgress: true };
      return copy;
    }
    const w = { id: uid(), date: today, inProgress: true, notes: "", items: [] };
    return [...prev, w];
  });
}

function endWorkout(setWorkouts, notes) {
  setWorkouts((prev) => {
    const ended = prev.map((w) => (w.inProgress ? { ...w, inProgress: false, notes: notes || w.notes } : w));
    return consolidateWorkoutsByDate(ended);
  });
}

function addExerciseToSession(setWorkouts, exerciseId) {
  // Uses the current exercise library from storage to keep name/image in history
  setWorkouts((prev) =>
    prev.map((w) => {
      if (!w.inProgress) return w;
      const library = load(SK.EXERCISES, DEFAULT_EXERCISES);
      const e = library.find((x) => x.id === exerciseId);
      if (!e) return w; // unknown id
      const exists = w.items.some((it) => it.exerciseId === exerciseId);
      if (exists) return w; // avoid duplicates in a single session
      const item = { id: uid(), exerciseId, name: e.name, image: e.image || "", sets: [] };
      return { ...w, items: [...w.items, item] };
    })
  );
}

function addSetToWorkout(setWorkouts, { itemId, reps, weight, rpe }) {
  setWorkouts((prev) =>
    prev.map((w) => {
      if (!w.inProgress) return w;
      return {
        ...w,
        items: w.items.map((it) => (it.id === itemId ? { ...it, sets: [...it.sets, { reps, weight, rpe }] } : it)),
      };
    })
  );
}

// --- Image Viewer (Lightbox) ----------------------------------------------
function ImageViewer({ viewer, onClose }) {
  if (!viewer.open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-5xl w-full">
        <img
          src={viewer.src}
          alt={viewer.alt}
          className="mx-auto max-h-[85vh] w-auto object-contain rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <button className="absolute -top-3 -right-3 bg-white rounded-full px-3 py-1 text-sm shadow" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

// --- Lightweight Self-Tests (run once in browser) -------------------------
(function runSelfTests() {
  if (typeof window === "undefined") return;
  try {
    console.assert(typeof addExerciseToSession === "function", "addExerciseToSession should be a function");
    console.assert(formatNumber(12345) === new Intl.NumberFormat().format(12345), "formatNumber should format numbers");

    const ws = [
      { id: "1", date: "2025-01-01", inProgress: false, items: [] },
      { id: "2", date: "2025-01-02", inProgress: false, items: [] },
      { id: "3", date: "2025-01-04", inProgress: false, items: [] },
    ];
    console.assert(bestStreak(ws) === 2, "bestStreak example should be 2");

    const ws2 = [
      { id: "1", date: "2025-01-01", inProgress: false, items: [{ id: "a", name: "Squat", sets: [] }] },
      { id: "2", date: "2025-01-03", inProgress: false, items: [{ id: "b", name: "Bench Press", sets: [] }] },
    ];
    console.assert(uniqueExerciseCount(ws2) === 2, "uniqueExerciseCount should count unique names");
  } catch (e) {
    console.warn("Self-tests encountered an error:", e);
  }
})();
