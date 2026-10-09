import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { catalogueRepository, filterExercises, requestCatalogue, UNKNOWN_EQUIPMENT } from './catalogue'
import type { CatalogueRepository, CatalogueState } from './catalogue'
import './exercises.css'

export function CatalogueFeedback({ state, retry }: { state: CatalogueState; retry: () => void }) {
  if (state.status === 'loading') return <div className="library-message" role="status">Loading exercises…</div>
  if (state.status === 'error') return <div className="library-message"><p role="alert">The exercise library could not be loaded. Please try again.</p><button className="primary-action" onClick={retry}>Try again</button></div>
  if (!state.exercises.length) return <div className="library-message" role="status">No exercises are available in this catalogue yet.</div>
  return null
}

export default function ExerciseLibrary({ detail = false, repository = catalogueRepository }: { detail?: boolean; repository?: CatalogueRepository }) {
  const [state, setState] = useState<CatalogueState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [params, setParams] = useSearchParams()
  const { exerciseId } = useParams()
  useEffect(() => requestCatalogue(repository, setState), [repository, attempt])
  const query = params.get('q') ?? ''
  const muscle = params.get('muscle') ?? ''
  const equipment = params.get('equipment') ?? ''
  const exercises = state.status === 'ready' ? state.exercises : []
  const results = filterExercises(exercises, query, muscle, equipment)
  const selected = exercises.find(exercise => exercise.catalogueId === exerciseId)
  const suffix = params.size ? `?${params}` : ''
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
  }
  return <>
    <div className="page-heading"><span className="eyebrow">EXERCISE LIBRARY</span><h1>{detail ? selected?.name ?? 'Exercise details' : 'Exercises'}</h1><p>{detail ? 'A closer look at this movement.' : 'Find a movement. Build your knowledge.'}</p></div>
    <p className="catalogue-notice"><strong>Starter library · five existing project entries.</strong> Names and muscle-group labels come from the original app. Equipment, instructions and media were not recorded. This is a foundation, not the complete verified catalogue.</p>
    {detail && <Link className="library-back" to={`/exercises${suffix}`}>← Back to exercises</Link>}
    <CatalogueFeedback state={state} retry={() => setAttempt(value => value + 1)} />
    {state.status === 'ready' && exercises.length > 0 && (detail ? selected ? <section className="exercise-guide" aria-labelledby="guide-heading">
      <span className="feature-badge">Guide</span><h2 id="guide-heading">Movement information</h2>
      <dl><dt>Muscle group</dt><dd>{selected.muscleGroup} <small>(legacy group label)</small></dd><dt>Equipment</dt><dd>{selected.equipment ?? 'Not recorded'}</dd></dl>
      <h2>Instructions</h2>{selected.instructions?.length ? <ol>{selected.instructions.map((step, index) => <li key={index}>{step}</li>)}</ol> : <p>Instructions are not available in the existing project data. A verified guide and permitted demonstration media are still needed.</p>}
      <p className="future-settings">My Settings and History are not available yet. Personal exercise identities, machine presets and performance data will be integrated separately.</p>
    </section> : <div className="library-message"><h2>Exercise not found</h2><p>This catalogue does not contain that exercise. Return to the library to choose an available movement.</p></div> : <>
      <section className="library-controls" aria-label="Find exercises">
        <label className="exercise-search">Search exercises<input type="search" value={query} onChange={event => change('q', event.target.value)} placeholder="Search by name" /></label>
        <label>Muscle group<select value={muscle} onChange={event => change('muscle', event.target.value)}><option value="">All muscle groups</option>{[...new Set(exercises.map(item => item.muscleGroup))].sort().map(group => <option key={group}>{group}</option>)}{muscle && !exercises.some(item => item.muscleGroup === muscle) && <option value={muscle}>Unavailable group</option>}</select></label>
        <label>Equipment<select value={equipment} onChange={event => change('equipment', event.target.value)}><option value="">All equipment</option>{[...new Set(exercises.flatMap(item => item.equipment ? [item.equipment] : []))].sort().map(item => <option key={item}>{item}</option>)}<option value={UNKNOWN_EQUIPMENT}>Not recorded</option>{equipment && equipment !== UNKNOWN_EQUIPMENT && !exercises.some(item => item.equipment === equipment) && <option value={equipment}>Unavailable equipment</option>}</select></label>
        <button className="reset-filters" onClick={() => setParams({}, { replace: true })}>Reset filters</button>
      </section>
      <p className="result-count" role="status">{results.length} {results.length === 1 ? 'exercise' : 'exercises'} found</p>
      {results.length ? <ul className="exercise-list">{results.map(exercise => <li key={exercise.catalogueId}><Link to={`/exercises/${encodeURIComponent(exercise.catalogueId)}${suffix}`}><span><strong>{exercise.name}</strong><small>{exercise.muscleGroup} · {exercise.equipment ?? 'Equipment not recorded'}</small></span><span aria-hidden="true">→</span></Link></li>)}</ul> : <div className="library-message"><h2>No matching exercises</h2><p>Try another name or reset your filters. The starter library contains only five exercises.</p></div>}
    </>)}
  </>
}
