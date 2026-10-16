import { useEffect, useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { listPersonalExercises } from './personal'
import type { PersonalExercise } from './personal'
import { supabase } from '../../lib/supabase'
import ExerciseSettings from './ExerciseSettings'
import ExerciseMedia from './ExerciseMediaPanel'
import { machinePresetRepository, safeTutorialUrl } from './machinePresets'
import { useHistory } from '../progress/useHistory'
import { performanceSessions } from '../progress/analytics'
import { filterExerciseSessions, exerciseHistoryPoints, exerciseHistoryPrs } from './detailHistory'
import ExerciseHistoryChart from './ExerciseHistoryChart'
import '../progress/progress.css'

export default function PersonalDetails({ userId }: { userId: string }) {
  const { exerciseId = '' } = useParams(), location = useLocation()
  const [tab, setTab] = useState<'guide' | 'settings' | 'history'>('guide'), [exercise, setExercise] = useState<PersonalExercise | null>(null), [secondary, setSecondary] = useState<string[]>([]), [guide, setGuide] = useState<string[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [tutorial, setTutorial] = useState<string | null>(null), [tutorialError, setTutorialError] = useState(''), [routine, setRoutine] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('')
  const history = useHistory(userId, true)
  useEffect(() => {
    let current = true; setLoading(true); setError(''); setExercise(null); setSecondary([]); setGuide([]); setTutorial(null); setTutorialError(''); setRoutine(''); setFrom(''); setTo('')
    void listPersonalExercises(userId).then(async rows => {
      const row = rows.find(e => e.id === exerciseId); if (!row) throw new Error('Exercise not found in your account.'); if (current) setExercise(row)
      if (row.catalogue_id) { const { data, error: failure } = await supabase.from('exercise_catalogue').select('secondary_muscles,instruction_steps').eq('id', row.catalogue_id).maybeSingle(); if (failure) throw failure; if (current && data) { setSecondary(Array.isArray(data.secondary_muscles) ? data.secondary_muscles : []); setGuide(Array.isArray(data.instruction_steps) ? data.instruction_steps : []) } }
    }).catch(e => { if (current) setError(e.message ?? 'Exercise could not be loaded.') }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [userId, exerciseId])
  useEffect(() => {
    let current = true; setTutorial(null); setTutorialError('')
    void machinePresetRepository.preferences(userId, exerciseId).then(preferences => { try { const url = safeTutorialUrl(preferences.tutorial_url ?? ''); if (current) { setTutorial(url); setExercise(value => value ? { ...value, weight_unit: preferences.weight_unit, weight_increment: preferences.weight_increment, notes: preferences.notes } : value) } } catch { if (current) setTutorialError('The stored tutorial link is invalid. Update it in My Settings.') } }).catch(() => { if (current) setTutorialError('Tutorial preferences could not be loaded. Retry after reconnecting.') })
    return () => { current = false }
  }, [userId, exerciseId, tab])
  const sessions = performanceSessions(history.sessions).filter(s => s.exercises.some(e => e.exerciseId === exerciseId)), previous = [...sessions].reverse().flatMap(s => s.exercises.filter(e => e.exerciseId === exerciseId))[0]
  const filtered = filterExerciseSessions(sessions, exerciseId, routine, from, to), points = exerciseHistoryPoints(filtered, exerciseId), prs = exerciseHistoryPrs(points), unit = exercise?.weight_unit ?? 'lb', factor = unit === 'kg' ? 1 : 1 / 0.45359237
  const routines = [...new Set(sessions.map(s => s.name))].sort(), known = (value: number | null) => value === null ? 'Unknown' : `${(value * factor).toFixed(2)} ${unit}`
  return <section>
    <Link to={`/exercises/my-list${location.search}`}>← My List</Link><h1>{exercise?.name ?? 'Exercise'}</h1>
    {loading && <p role="status">Loading exercise…</p>}{error && <p role="alert">{error}</p>}
    {exercise && <><p>{exercise.primary_muscle ?? 'Primary muscle not recorded'} · {exercise.equipment ?? 'Equipment not recorded'}</p>{exercise.is_archived && <p>This exercise is archived. Its history is retained.</p>}
      <div className="analytics-actions" role="tablist" aria-label="Exercise details">{(['guide', 'settings', 'history'] as const).map(value => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{value === 'guide' ? 'Guide' : value === 'settings' ? 'My Settings' : 'History'}</button>)}</div>
      {tab === 'guide' && <section className="analytics-card" role="tabpanel"><h2>Exercise guide</h2>{!exercise.catalogue_id && <ExerciseMedia userId={userId} exerciseId={exerciseId} readOnly />}<p>Primary muscle: {exercise.primary_muscle ?? 'Not recorded'}</p><p>Secondary muscles: {secondary.length ? secondary.join(', ') : 'Not recorded'}</p><p>Equipment: {exercise.equipment ?? 'Not recorded'}</p>{exercise.instructions ? <p style={{ whiteSpace: 'pre-wrap' }}>{exercise.instructions}</p> : guide.length ? <ol>{guide.map((step, i) => <li key={i}>{step}</li>)}</ol> : <p>No instructions recorded for this exercise.</p>}<p style={{ whiteSpace: 'pre-wrap' }}>{exercise.notes}</p>{tutorial && <p><a href={tutorial} target="_blank" rel="noopener noreferrer">Open your saved tutorial ↗</a></p>}{tutorialError && <p role="alert">{tutorialError}</p>}</section>}
      {tab === 'settings' && <ExerciseSettings userId={userId} exerciseId={exerciseId} lastUsedSettings={previous?.settings} />}
      {tab === 'history' && <section className="analytics-card" role="tabpanel"><h2>Exercise history</h2><div className="analytics-filters"><label>Routine / workout day<select value={routine} onChange={e => setRoutine(e.target.value)}><option value="">All recorded workout days</option>{routines.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Through<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>{from && to && from > to && <p role="alert">The end date must be on or after the start date.</p>}{history.loading && <p role="status">Loading history…</p>}{history.error && <div role="alert"><p>{history.error}</p><button onClick={history.retry}>Retry</button></div>}{!history.loading && !history.error && !points.length && <p>No completed sets match these filters. Undated previous-performance references are not workout history.</p>}
        {points.length > 0 && <><h3>Personal records in this selection</h3><div className="analytics-metrics"><p><strong>{known(prs.heaviestKg)}</strong><small>Heaviest known load</small></p><p><strong>{known(prs.estimated1RmKg)}</strong><small>Best estimated 1RM</small></p><p><strong>{prs.bestSessionVolumeKg === null ? 'Unknown' : `${(prs.bestSessionVolumeKg * factor).toFixed(2)} ${unit} × reps`}</strong><small>Highest known-load volume in one session</small></p><p><strong>{prs.repsAtTopLoad ?? 'Unknown'}</strong><small>Most reps at the heaviest recorded load</small></p></div><ExerciseHistoryChart points={points} unit={unit} /></>}
        {[...points].reverse().map(point => { const entry = filtered.find(s => s.id === point.sessionId); return <article className="planner-card" key={point.sessionId}><h3>{entry?.name} · {point.date}</h3><p>{entry?.completedAt ? entry.completionKind === 'incomplete' ? 'Saved incomplete' : 'Completed workout' : 'Workout in progress'} · {point.workingSets} completed working sets</p><p>Top weight: {known(point.weightKg)}</p><p>Known-load volume: {(point.volumeKg * factor).toFixed(2)} {unit} × reps</p><Link to={`/workout/session/${point.sessionId}`}>View original sets and settings</Link></article> })}
      </section>}
    </>}
  </section>
}
