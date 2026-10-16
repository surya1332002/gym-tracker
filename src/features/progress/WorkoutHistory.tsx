import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHistory } from './useHistory'
import { performanceSessions, exercisePoints } from './analytics'
import './progress.css'
import RecentlyDeleted from './RecentlyDeleted'
export default function WorkoutHistory({ userId }: { userId: string }) {
  const { sessions, loading, error, retry } = useHistory(userId), [search, setSearch] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [deleted, setDeleted] = useState(false)
  if (deleted) return <><button className="secondary-button" onClick={() => { setDeleted(false); retry() }}>Back to active history</button><RecentlyDeleted userId={userId} /></>
  const rows = performanceSessions(sessions).filter(s => s.completedAt).reverse().filter(s => (!from || s.date >= from) && (!to || s.date <= to) && `${s.name} ${s.exercises.map(e => e.name).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  return <section><h1>Workout history</h1><button className="secondary-button" onClick={() => setDeleted(true)}>Recently Deleted</button><div className="analytics-actions"><Link to="/progress/calendar">Activity calendar</Link><Link to="/progress/strength">Strength trends</Link></div><div className="analytics-filters"><label>Search workouts or exercises<input value={search} onChange={e => setSearch(e.target.value)} /></label><label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Through<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>{loading && <p role="status">Loading history…</p>}{error && <div role="alert"><p>{error}</p><button onClick={retry}>Retry</button></div>}{!loading && !error && !rows.length && <p>No completed workouts match these filters.</p>}<div className="analytics-grid">{rows.map(s => <Link className="workout-choice" to={`/workout/session/${s.id}`} key={s.id}><strong>{s.name}</strong><span>{s.date} · {exercisePoints([s]).reduce((n, p) => n + p.workingSets, 0)} completed sets</span><span>View saved workout</span></Link>)}</div></section>
}
