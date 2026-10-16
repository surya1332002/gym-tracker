import { WorkoutRow } from './WorkoutUI'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { PersonalExercise } from '../exercises/personal'
import { useWorkoutDraft } from './WorkoutDraft'
import { programmePayload } from './programmes'
import type { ProgrammeDay, SavedProgramme } from './programmes'
import type { WorkoutDraft } from './planner'
import { sessionRepository } from './sessions'
import type { WorkoutSession } from './sessions'
import { loadStartLibrary, loadStartProgramme, makeCachedSession, availableActiveWorkouts } from '../../data/startCache'
import type { StartLibrary, CachedProgramme } from '../../data/startCache'
import { workoutStore } from '../../data/workoutStore'
import { syncWorkouts } from '../../data/workoutSync'

export default function SavedWorkouts({ userId }: { userId: string }) {
  const [programmes, setProgrammes] = useState<SavedProgramme[]>([]), [selected, setSelected] = useState<SavedProgramme | null>(null), [preview, setPreview] = useState<WorkoutDraft | null>(null), [days, setDays] = useState<ProgrammeDay[]>([]), [dayIndex, setDayIndex] = useState<number | null>(null)
  const [personal, setPersonal] = useState<PersonalExercise[]>([]), [active, setActive] = useState<any[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [attempt, retry] = useState(0)
  const pending = useRef<WorkoutSession | null>(null), alive = useRef(true), navigate = useNavigate()
  const [library, setLibrary] = useState<StartLibrary | null>(null), [bundle, setBundle] = useState<CachedProgramme | null>(null), [offline, setOffline] = useState(false)
  const { draft, setDraft, setConfiguration, setSaveState } = useWorkoutDraft()
  useEffect(() => {
    alive.current = true; setLoading(true); setError('')
    setActive([]); setLibrary(null)
    void availableActiveWorkouts(userId).then(local => { if (alive.current) setActive(local.map(row => ({ id: row.id, routine_name_snapshot: row.session.name, routine_day_id: row.session.dayId }))) }).catch(failure => { if (alive.current) setError(failure.message) })
    void loadStartLibrary(userId).then(async result => { const local = (await workoutStore.list(userId)).filter(row => !row.session.completedAt && !row.session.deletedAt); if (alive.current) { setLibrary(result.library); setOffline(result.offline); setProgrammes(result.library.programmes); setPersonal(result.library.personal); setActive(local.map(row => ({ id: row.id, routine_name_snapshot: row.session.name, routine_day_id: row.session.dayId }))) } }).catch(failure => { if (alive.current) setError(failure.message ?? 'Workouts could not be loaded.') }).finally(() => { if (alive.current) setLoading(false) })
    return () => { alive.current = false }
  }, [userId, attempt])
  useEffect(() => {
    let current = true; setPreview(null); setBundle(null); setDays([]); setDayIndex(null)
    if (selected) { setLoading(true); setError(''); void loadStartProgramme(userId, selected).then(({ bundle: cached, offline: fromCache }) => { if (current) { setBundle(cached); setPreview(cached.draft); setDays(cached.days); setOffline(fromCache) } }).catch(failure => { if (current) setError(failure.message) }).finally(() => { if (current) setLoading(false) }) }
    return () => { current = false }
  }, [userId, selected])
  function edit() {
    if (!selected || !preview || (draft && !window.confirm('Replace the current editor draft with this saved programme?'))) return
    setDraft(structuredClone(preview)); setConfiguration({ name: preview.name ?? '', split: preview.split, count: preview.days.length, muscles: [...(preview.muscles ?? []), '', '', ''].slice(0, 3) }); setSaveState({ id: selected.id, revision: bundle?.programme.revision ?? selected.revision, savedPayload: JSON.stringify(programmePayload(preview)), pending: null }); navigate(`/workout/build/${selected.id}`)
  }
  async function start() {
    if (!preview || dayIndex === null || !days[dayIndex] || busy) return
    setBusy(true); setError('')
    try {
      if (!library || !bundle) throw new Error('Reload the programme before starting.')
      if (navigator.onLine) { let cloud: any[] = []; try { cloud = await sessionRepository.list(userId, 'in_progress') } catch (failure) { if (/matching signed-in|another account|account changed|Authentication required/i.test((failure as Error).message ?? '')) throw failure } if (cloud.some(row => row.id !== pending.current?.id)) throw new Error('Resume your unfinished workout before starting another session.') }
      if (!pending.current) pending.current = makeCachedSession(library, bundle, dayIndex)
      const value = await workoutStore.start(pending.current)
      if (navigator.onLine) void syncWorkouts(userId).catch(() => {})
      navigate(`/workout/session/${value.id}`)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not start. Retry keeps the same session identity.') }
    finally { setBusy(false) }
  }
  const day = preview && dayIndex !== null ? preview.days[dayIndex] : null

  const resumable = dayIndex === null ? null : active.find(row => row.routine_day_id === days[dayIndex]?.id)
  return <><Link className="flow-back" to="/workout/start">&#8592; Start Workout</Link><h1>{day?.name ?? selected?.name ?? 'Choose Workout'}</h1>
    {loading && <p role="status">Loading workouts...</p>}{error && <div role="alert"><p>{error}</p><button className="reset-filters" onClick={() => retry(value => value + 1)}>Retry loading</button></div>}
    {offline && <p role="status">Using your encrypted offline cache. Only previously opened programmes are available.</p>}
    {!selected ? <>{active.length > 0 && <section><h2>Resume unfinished workout</h2><div className="compact-rows">{active.map(row => <Link className="compact-row" key={row.id} to={`/workout/session/${row.id}`}><WorkoutRow title={row.routine_name_snapshot} subtitle="Resume unfinished workout"/></Link>)}</div></section>}<h2>Saved programmes</h2><div className="compact-rows">{programmes.map(row => <button className="compact-row" key={row.id} onClick={() => { pending.current = null; setSelected(row) }}><WorkoutRow title={row.name} subtitle={row.split}/></button>)}</div>{!loading && !programmes.length && <p>No saved programmes. <Link to="/workout/build">Build Workout</Link>.</p>}</> : preview && <>
    {day ? <><button className="reset-filters" disabled={busy} onClick={() => { setDayIndex(null); pending.current = null }}>&#8592; Workout days</button><p>{day.exercises.length} exercises</p><div className="compact-rows">{day.exercises.map((entry,index) => {const row = personal.find(item => item.id === entry.exerciseId); return <details className="exercise-accordion" key={index}><summary><strong>{entry.name}</strong><small>{row?.primary_muscle ?? 'Muscle not recorded'} - {entry.sets === null ? 'Optional targets' : entry.sets+' sets'}{entry.min === null ? '' : ' - '+entry.min+'-'+entry.max+' reps'}</small></summary><div className="accordion-body"><p>{row?.equipment}</p>{row?.notes && <p className="exercise-text">{row.notes}</p>}</div></details>})}</div>{!resumable && active.length > 0 && <p>Resume your unfinished workout first. <Link to={`/workout/session/${active[0].id}`}>Resume {active[0].routine_name_snapshot}</Link></p>}<div className="workout-save-bar"><button className="primary-action full-action" disabled={busy || !day.exercises.length || !resumable && active.length > 0} onClick={() => {if(resumable)navigate(`/workout/session/${resumable.id}`);else void start()}}>{resumable?'Resume Workout':busy?'Starting...':pending.current?'Retry Start Workout':'Start this workout'}</button></div></> : <><button className="reset-filters" disabled={busy} onClick={() => {setSelected(null);pending.current=null}}>&#8592; Programmes</button><p>{preview.days.length} workout days</p><div className="compact-rows">{preview.days.map((item,index) => <button className="compact-row" key={index} onClick={() => {setDayIndex(index);pending.current=null}}><WorkoutRow title={item.name} subtitle={item.exercises.length+' exercises'}/></button>)}</div></>}
    <button className="reset-filters" disabled={busy} onClick={edit}>Edit programme</button></>}
  </>
}
