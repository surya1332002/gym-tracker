import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { catalogueRepository, requestCatalogue } from './catalogue'
import type { CatalogueRepository, CatalogueState } from './catalogue'
import PersonalExercises from './PersonalExercises'
import PersonalBrowser, { personalMatchesGroup } from './PersonalBrowser'
import CatalogueSelection from './CatalogueSelection'
import CatalogueBrowser from './CatalogueBrowser'
import ExercisePicture from './ExercisePicture'
import { listPersonalExercises } from './personal'
import type { PersonalExercise } from './personal'
import { programmeRepository } from '../workout/programmes'
import type { CatalogueMembership } from '../workout/programmes'
import './exercises.css'
import { useHistory } from '../progress/useHistory'
import { performanceSessions } from '../progress/analytics'

export function CatalogueFeedback({ state, retry }: { state: CatalogueState; retry: () => void }) {
  if (state.status === 'loading') return <div className="library-message" role="status">Loading exercises…</div>
  if (state.status === 'error') return <div className="library-message"><p role="alert">The exercise library could not be loaded. Check your connection; the catalogue migration and import may still need to be applied.</p><button className="primary-action" onClick={retry}>Try again</button></div>
  if (!state.exercises.length) return <div className="library-message" role="status">No exercises are available in this catalogue yet.</div>
  return null
}
export default function ExerciseLibrary({ userId, detail = false, mode = 'landing', repository = catalogueRepository }: { userId: string; detail?: boolean; mode?: 'landing' | 'search' | 'custom' | 'my-list'; repository?: CatalogueRepository }) {
  const personalHistory = useHistory(userId, true, mode === 'my-list' || mode === 'custom')
  const recentIds = new Set(performanceSessions(personalHistory.sessions).flatMap(session => session.exercises.filter(exercise=>exercise.sets.some(set=>set.completed)).map(exercise=>exercise.exerciseId)))
  const [state, setState] = useState<CatalogueState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { exerciseId } = useParams()
  const [personal, setPersonal] = useState<PersonalExercise[]>([])
  const [personalLoading, setPersonalLoading] = useState(true)
  const [personalError, setPersonalError] = useState('')
  const [personalAttempt, setPersonalAttempt] = useState(0)
  const [memberships, setMemberships] = useState<CatalogueMembership[]>([])
  const [membershipReady, setMembershipReady] = useState(false), [membershipError, setMembershipError] = useState('')
  const [membershipAttempt, setMembershipAttempt] = useState(0)
  useEffect(() => {
    if (!detail && mode === 'landing') return
    let active = true
    setMembershipReady(false); setMembershipError(''); setMemberships([])
    void programmeRepository.listMemberships(userId).then(rows => { if (active) { setMemberships(rows); setMembershipReady(true) } }).catch(() => {
      if (active) setMembershipError('Catalogue selections could not be loaded. Check your connection and apply the catalogue/programme migration if it is still pending. Custom exercises remain available.')
    })
    return () => { active = false }
  }, [userId, detail, mode, membershipAttempt])
  function selectionChanged() { setMembershipAttempt(value => value + 1); setPersonalAttempt(value => value + 1) }

  useEffect(() => {
    if (mode !== 'custom' && mode !== 'my-list') return
    let active = true
    setPersonalLoading(true); setPersonalError(''); setPersonal([])
    void listPersonalExercises(userId).then(rows => { if (active) setPersonal(rows) }).catch(() => {
      if (active) setPersonalError('Your personal exercises could not be loaded. Check your connection and account, then retry.')
    }).finally(() => { if (active) setPersonalLoading(false) })
    return () => { active = false }
  }, [userId, personalAttempt, mode])
  useEffect(() => { if (detail || mode === 'search') return requestCatalogue(repository, setState) }, [repository, attempt, mode, detail, userId])
  const query = params.get('q') ?? '', muscle = params.get('muscle') ?? '', equipment = params.get('equipment') ?? ''
  const exercises = state.status === 'ready' ? state.exercises : []
  const selected = exercises.find(exercise => exercise.catalogueId === exerciseId)
  const suffix = params.toString() ? `?${params}` : ''
  function saved(row: PersonalExercise) {
    setPersonal(current => [...current.filter(item => item.id !== row.id), row].sort((a, b) => a.name.localeCompare(b.name)))
    if (mode === 'custom') navigate(`/exercises/my-list${suffix}`)
  }
  if (!detail && mode === 'landing') return <><div className="page-heading"><span className="eyebrow">YOUR MOVEMENTS</span><h1>Exercises</h1></div><div className="flow-choices flow-tiles"><Link to="/exercises/search">Search from List</Link><Link to="/exercises/custom">Custom</Link><Link to="/exercises/my-list">My List</Link></div></>
  const personalPanel = <PersonalExercises key={`${userId}-${mode}`} userId={userId} rows={personal.filter(row => params.get('browse') !== 'favourites' || row.is_favourite).filter(row => params.get('browse') !== 'recent' || recentIds.has(row.id)).filter(row => personalMatchesGroup(row, muscle)).filter(row => mode !== 'custom' || !row.catalogue_id).map(row => ({ ...row, catalogue_id: membershipReady ? memberships.find(item => item.id === row.id)?.catalogue_id ?? null : row.catalogue_id }))} loading={personalLoading} error={personalError} retry={() => setPersonalAttempt(value => value + 1)} query={query} muscle="" equipment={equipment} onSaved={saved} initialCreate={mode === 'custom'} showRows={!!(query.trim() || muscle || ['all','favourites','recent'].includes(params.get('browse') ?? ''))} />
  return <>
    <Link className="flow-back" to={detail ? `/exercises/search${suffix}` : '/exercises'}>← {detail ? 'Search from List' : 'Exercises'}</Link>
    {params.get('browse') === 'recent' && personalHistory.loading && <p role="status">Loading recent exercise history?</p>}{params.get('browse') === 'recent' && personalHistory.error && <div role="alert"><p>{personalHistory.error}</p><button onClick={personalHistory.retry}>Retry recent history</button></div>}<div className="page-heading"><span className="eyebrow">EXERCISE LIBRARY</span><h1>{detail ? selected?.name ?? 'Exercise details' : mode === 'custom' ? 'Custom Exercise' : mode === 'my-list' ? 'My List' : 'Search from List'}</h1></div>
    {mode === 'custom' && !detail ? <><PersonalBrowser rows={personal.filter(row => !row.catalogue_id)} params={params} setParams={next => setParams(next, { replace: true })} />{personalPanel}</> : <>
      {mode !== 'my-list' && <CatalogueFeedback state={state} retry={() => setAttempt(value => value + 1)} />}
      {detail ? state.status === 'ready' && (selected ? <section className="exercise-guide"><span className="feature-badge">Shared catalogue</span><div className="exercise-detail-pictures">{selected.images?.length ? selected.images.map(image => <figure key={image.url}><ExercisePicture image={image} name={selected.name} /><figcaption>{image.attribution} / {image.license} <a href={image.evidenceUrl} target="_blank" rel="noopener noreferrer">Image source</a></figcaption></figure>) : <ExercisePicture name={selected.name} />}</div><h2>Guide</h2><dl><dt>Muscle group</dt><dd>{selected.primaryMuscles?.join(', ') || selected.muscleGroup}</dd><dt>Secondary muscles</dt><dd>{selected.secondaryMuscles?.join(', ') || 'None recorded'}</dd><dt>Category</dt><dd>{selected.category ?? 'Not recorded'}</dd><dt>Level</dt><dd>{selected.level ?? 'Not recorded'}</dd><dt>Equipment</dt><dd>{selected.equipment ?? 'Not recorded'}</dd></dl><h2>Instructions</h2>{selected.instructions?.length ? <ol>{selected.instructions.filter(step => step.trim()).map((step, i) => <li key={i}>{step}</li>)}</ol> : <p>Instructions are not recorded for this exercise.</p>}<CatalogueSelection key={`${userId}-${selected.catalogueId}`} userId={userId} catalogueId={selected.catalogueId} membership={memberships.find(row => row.catalogue_id === selected.catalogueId)} ready={membershipReady} onChanged={selectionChanged} />{membershipError && <div><p role="alert">{membershipError}</p><button className="reset-filters" onClick={() => setMembershipAttempt(value => value + 1)}>Retry selections</button></div>}</section> : <div className="library-message"><h2>Exercise not found</h2><p>Return to the list to choose an available exercise.</p></div>) : mode === 'search' ? <><CatalogueBrowser exercises={exercises} ready={state.status === 'ready'} params={params} setParams={next => setParams(next, { replace: true })} userId={userId} memberships={memberships} membershipReady={membershipReady} onChanged={selectionChanged} />{membershipError && <div><p role="alert">{membershipError}</p><button className="reset-filters" onClick={() => setMembershipAttempt(value => value + 1)}>Retry selections</button></div>}</> : <>
        <PersonalBrowser rows={personal} params={params} setParams={next => setParams(next, { replace: true })} />
        <><p className="boundary-notice">My List includes your custom exercises and selected catalogue exercises. Removing an exercise archives its personal identity and preserves history.</p>{membershipError && <p role="alert">{membershipError}</p>}{personalPanel}</>
      </>}
    </>}
  </>
}
