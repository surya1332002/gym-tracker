import { muscleGroups } from './muscleGroups'
import type { PersonalExercise } from './personal'

export function personalMatchesGroup(row: PersonalExercise, group: string) {
  if (!group) return true
  const category = muscleGroups.find(item => item.id === group)
  const muscle = row.primary_muscle?.toLowerCase() ?? ''
  return category ? (category.muscles as readonly string[]).includes(muscle) : muscle === group.toLowerCase()
}
export default function PersonalBrowser({ rows, params, setParams }: { rows: PersonalExercise[]; params: URLSearchParams; setParams: (params: URLSearchParams) => void }) {
  const group = params.get('muscle') ?? '', query = params.get('q') ?? '', equipment = params.get('equipment') ?? ''
  function change(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next) }
  return <><div className="personal-actions"><button onClick={()=>change('browse','favourites')}>Favourites</button><button onClick={()=>change('browse','recent')}>Recently used</button></div><section className="library-controls" aria-label="Find personal exercises"><label>Search exercises<input type="search" value={query} onChange={event => change('q', event.target.value)} placeholder={group ? 'Search this muscle group' : 'Search all personal exercises'} /></label><label>Equipment<select value={equipment} onChange={event => change('equipment', event.target.value)}><option value="">All equipment</option>{[...new Set(rows.filter(row => personalMatchesGroup(row, group)).map(row => row.equipment ?? '__not_recorded__'))].sort().map(item => <option key={item} value={item}>{item === '__not_recorded__' ? 'Not recorded' : item}</option>)}</select></label><button className="reset-filters" onClick={() => setParams(new URLSearchParams())}>Reset filters</button></section>
    {!group && !query && !['all','favourites','recent'].includes(params.get('browse') ?? '') ? <div className="muscle-category-grid">{muscleGroups.map(item => <button className="muscle-category" key={item.id} onClick={() => change('muscle', item.id)}><strong>{item.name}</strong><small>{rows.filter(row => !row.is_archived && personalMatchesGroup(row, item.id)).length} exercises</small></button>)}<button className="muscle-category" onClick={() => change('browse', 'all')}>Browse All Exercises</button></div> : <div className="personal-heading"><h2>{muscleGroups.find(item => item.id === group)?.name ?? (params.get('browse') === 'favourites' ? 'Favourite exercises' : params.get('browse') === 'recent' ? 'Recently used exercises' : 'All personal exercises')}</h2><button className="reset-filters" onClick={() => { const next = new URLSearchParams(params); next.delete('muscle'); next.delete('browse'); next.delete('q'); next.delete('equipment'); setParams(next) }}>← Muscle groups</button></div>}
  </>
}
