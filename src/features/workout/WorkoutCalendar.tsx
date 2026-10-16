import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sessionRepository } from './sessions'

export type CalendarWorkout = { id: string; workout_date: string; routine_name_snapshot: string | null; status: string; completed_at: string | null; is_incomplete?:boolean;deleted_at?:string|null }
export function monthDays(year: number, month: number): (string | null)[] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const cells: (string | null)[] = Array(offset).fill(null)
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) cells.push(`${prefix}${String(day).padStart(2, '0')}`)
  return cells
}
export function completedByDate(rows: CalendarWorkout[]): Map<string, CalendarWorkout[]> {
  const grouped = new Map<string, CalendarWorkout[]>()
  for (const row of rows) {
    if (row.status !== 'completed' || row.is_incomplete || row.deleted_at || !row.completed_at || !/^\d{4}-\d{2}-\d{2}$/.test(row.workout_date)) continue
    const [year, month, day] = row.workout_date.split('-').map(Number)
    const actual = new Date(year, month - 1, day)
    if (actual.getFullYear() !== year || actual.getMonth() !== month - 1 || actual.getDate() !== day) continue
    const workouts = grouped.get(row.workout_date) ?? []
    if (!workouts.some(workout => workout.id === row.id)) workouts.push(row)
    grouped.set(row.workout_date, workouts)
  }
  return grouped
}

export default function WorkoutCalendar({ userId }: { userId: string }) {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1) })
  const [rows, setRows] = useState<CalendarWorkout[]>([]), [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, retry] = useState(0)
  useEffect(() => {
    let current = true; setLoading(true); setError(''); setRows([]); setSelected(null)
    void sessionRepository.list(userId, 'completed').then(data => { if (current) setRows(data) }).catch(failure => { if (current) setError(failure.message ?? 'Workout history could not be loaded.') }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [userId, attempt])
  const grouped = completedByDate(rows), label = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  function move(amount: number) { setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1)); setSelected(null) }
  return <section className="workout-screen workout-calendar">
    <div className="page-heading"><h1>Progress</h1><p>Your completed workouts.</p></div>
    <section className="planner-card" aria-label="Completed workout calendar">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="secondary-button" aria-label="Previous month" onClick={() => move(-1)}>‹</button>
        <h2 aria-live="polite" style={{ fontSize: '1rem', margin: 0 }}>{label}</h2>
        <button type="button" className="secondary-button" aria-label="Next month" onClick={() => move(1)}>›</button>
      </header>
      {loading && <p role="status">Loading workout history…</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => retry(value => value + 1)}>Retry</button></div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2, marginTop: 16 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day} aria-hidden="true" style={{ textAlign: 'center', fontSize: '.7rem', color: 'var(--muted)' }}>{day}</span>)}
        {monthDays(month.getFullYear(), month.getMonth()).map((date, index) => date ? <button key={date} type="button" aria-pressed={selected === date} aria-label={`${date}${grouped.has(date) ? `, ${grouped.get(date)!.length} completed workout${grouped.get(date)!.length === 1 ? '' : 's'}` : ', no completed workouts'}`} onClick={() => setSelected(date)} style={{ minHeight: 44, padding: '4px 0', borderRadius: 8, border: selected === date ? '1px solid #ef3340' : '1px solid transparent', background: grouped.has(date) ? '#ef334025' : 'transparent', color: 'inherit', fontWeight: grouped.has(date) ? 700 : 400 }}><span>{Number(date.slice(-2))}</span>{grouped.has(date) && <span aria-hidden="true" style={{ display: 'block', color: '#ef3340', lineHeight: '.5' }}>•</span>}</button> : <span key={`blank-${index}`} />)}
      </div>
      {!loading && !error && !rows.length && <p>No completed workouts yet.</p>}
      {selected && <section aria-label="Workouts on selected date"><h3>{selected}</h3>{(grouped.get(selected) ?? []).map(workout => <Link className="workout-choice" key={workout.id} to={`/workout/session/${workout.id}`}><strong>{workout.routine_name_snapshot || 'Workout'}</strong><span>View completed sets →</span></Link>)}{!grouped.has(selected) && <p>No completed workouts on this date.</p>}</section>}
    </section>
    <section className="placeholder-card"><span className="feature-badge">Coming soon</span><h2>More progress tools</h2><ul><li>Strength trends and personal records</li><li>Body weight and measurements</li><li>Private progress photos</li></ul></section>
  </section>
}
