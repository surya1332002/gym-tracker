import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { filterExercises, UNKNOWN_EQUIPMENT } from './catalogue'
import type { CatalogueExercise } from './catalogue'
import { catalogueResultsVisible, matchesMuscle, muscleGroups } from './muscleGroups'
import CatalogueSelection from './CatalogueSelection'
import ExercisePicture from './ExercisePicture'
import type { CatalogueMembership } from '../workout/programmes'

export default function CatalogueBrowser({ exercises, ready, params, setParams, userId, memberships, membershipReady, onChanged }: {
  exercises: readonly CatalogueExercise[]; ready: boolean; params: URLSearchParams
  setParams: (next: URLSearchParams) => void; userId: string; memberships: CatalogueMembership[]; membershipReady: boolean; onChanged: () => void
}) {
  const query = params.get('q') ?? '', muscle = params.get('muscle') ?? '', equipment = params.get('equipment') ?? ''
  const browse = params.get('browse') ?? ''
  const visible = catalogueResultsVisible(query, muscle, browse)
  const group = muscleGroups.find(group => group.id === muscle || group.name.toLowerCase() === muscle.toLowerCase())
  const scoped = exercises.filter(exercise => matchesMuscle(exercise, muscle))
  const results = filterExercises(exercises, query, muscle, equipment)
  const [limit, setLimit] = useState(40)
  useEffect(() => { setLimit(40) }, [query, muscle, equipment, browse])
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next)
  }
  const suffix = params.toString() ? `?${params}` : ''
  return <>
    <section className="library-controls catalogue-search-controls" aria-label="Find catalogue exercises">
      <label className="exercise-search">{muscle ? `Search in ${group?.name ?? muscle}` : 'Search all exercises'}
        <input type="search" value={query} onChange={event => change('q', event.target.value)} placeholder={muscle ? 'Search within this group' : 'Search by exercise name'} />
      </label>
      {visible && <>
        <label>Muscle group<select value={muscle} onChange={event => { const next = new URLSearchParams(params); next.set('browse', 'all'); next.delete('equipment'); if (event.target.value) next.set('muscle', event.target.value); else next.delete('muscle'); setParams(next) }}>
          <option value="">All muscle groups</option>{muscleGroups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          {muscle && !muscleGroups.some(item => item.id === muscle) && <option value={muscle}>{group?.name ?? muscle}</option>}
        </select></label>
        <label>Equipment<select value={equipment} onChange={event => change('equipment', event.target.value)}>
          <option value="">All equipment</option>{[...new Set(scoped.flatMap(item => item.equipment ? [item.equipment] : []))].sort().map(item => <option key={item}>{item}</option>)}
          <option value={UNKNOWN_EQUIPMENT}>Not recorded</option>
          {equipment && equipment !== UNKNOWN_EQUIPMENT && !scoped.some(item => item.equipment === equipment) && <option value={equipment}>Unavailable equipment</option>}
        </select></label>
        <button className="reset-filters" onClick={() => setParams(new URLSearchParams())}>Back to muscle groups</button>
      </>}
    </section>
    {!visible ? <section className="muscle-browser" aria-labelledby="muscle-browser-title">
      <h2 id="muscle-browser-title">Browse by muscle group</h2><p>Choose a primary muscle group, or search across the catalogue.</p>
      <div className="muscle-category-grid">{muscleGroups.map(item => <Link key={item.id} to={`?muscle=${item.id}`}>
        <span>{item.name}</span>{ready && <small>{exercises.filter(exercise => matchesMuscle(exercise, item.id)).length} exercises</small>}
      </Link>)}</div>
      <Link className="browse-all-link" to="?browse=all">Browse All Exercises <span aria-hidden="true">→</span></Link>
    </section> : ready && <>
      <h2 className="catalogue-results-title">{group?.name ?? (muscle || 'All exercises')}</h2>
      <p className="result-count" role="status">{results.length} exercises found{results.length > limit ? ` · Showing ${limit}` : ''}</p>
      <ul className="catalogue-card-grid">{results.slice(0, limit).map(exercise => <li key={exercise.catalogueId}>
        <Link className="catalogue-card-link" to={`/exercises/${encodeURIComponent(exercise.catalogueId)}${suffix}`}>
          <ExercisePicture image={exercise.images?.[0]} name={exercise.name} />
          <div className="catalogue-card-content"><h3>{exercise.name}</h3><p>{exercise.primaryMuscles?.join(', ') || exercise.muscleGroup}</p><small>{exercise.equipment ?? 'Equipment not recorded'}</small></div>
        </Link>
        <CatalogueSelection compact exerciseName={exercise.name} userId={userId} catalogueId={exercise.catalogueId} membership={memberships.find(row => row.catalogue_id === exercise.catalogueId)} ready={membershipReady} onChanged={onChanged} />
      </li>)}</ul>
      {!results.length && <p role="status">No matching exercises. Try another search or equipment filter.</p>}
      {results.length > limit && <button className="reset-filters catalogue-load-more" onClick={() => setLimit(value => value + 40)}>Show more exercises</button>}
    </>}
  </>
}
