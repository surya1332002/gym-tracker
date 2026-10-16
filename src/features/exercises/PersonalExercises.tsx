import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { archivePersonalExercise, filterPersonalExercises, savePersonalExercise } from './personal'
import type { ExerciseInput, PersonalExercise } from './personal'
import {Link, useLocation} from 'react-router-dom'

const blank: ExerciseInput = { name: '', primary_muscle: '', equipment: '', instructions: '', notes: '', weight_unit: 'kg', weight_increment: '', tutorial_url: '' }
export default function PersonalExercises({ userId, rows, loading, error, retry, onSaved, query, muscle, equipment, initialCreate = false, showRows = true }: {
  userId: string; rows: PersonalExercise[]; loading: boolean; error: string; retry: () => void
  onSaved: (row: PersonalExercise) => void; query: string; muscle: string; equipment: string; initialCreate?: boolean; showRows?: boolean
}) {
  const {search: filterContext} = useLocation()
  const [form, setForm] = useState<ExerciseInput | null>(initialCreate ? { ...blank } : null)
  const [editing, setEditing] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<PersonalExercise | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  function edit(row?: PersonalExercise) {
    setEditing(row?.id); setMessage('')
    setForm(row ? { name: row.name, primary_muscle: row.primary_muscle ?? '', equipment: row.equipment ?? '', instructions: row.instructions ?? '', notes: row.notes ?? '', weight_unit: row.weight_unit ?? 'kg', weight_increment: row.weight_increment?.toString() ?? '', tutorial_url: row.tutorial_url ?? '' } : { ...blank })
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form || busy) return
    setBusy(true); setMessage('')
    try {
      const row = await savePersonalExercise(userId, form, editing)
      if (alive.current) { onSaved(row); setForm(null); setMessage('Exercise saved to your account.') }
    } catch (failure) { if (alive.current) setMessage(failure instanceof Error ? failure.message : 'Could not save. Your form has been kept; try again.') }
    finally { if (alive.current) setBusy(false) }
  }
  async function archive() {
    if (!archiveTarget || busy) return
    setBusy(true); setMessage('')
    try {
      const row = await archivePersonalExercise(userId, archiveTarget.id)
      if (alive.current) { onSaved(row); setArchiveTarget(null); setMessage('Exercise archived. Its record and existing history are preserved.') }
    } catch (failure) { if (alive.current) setMessage(failure instanceof Error ? failure.message : 'Could not archive. Try again.') }
    finally { if (alive.current) setBusy(false) }
  }
  const visible = filterPersonalExercises(rows, query, muscle, equipment, showArchived)
  return <section className="personal-exercises" aria-labelledby="personal-title">
    <div className="personal-heading"><h2 id="personal-title">Your personal exercises</h2><button className="primary-action" disabled={loading || busy || !!form || !!error} onClick={() => edit()}>Add Custom Exercise</button></div>
    <p className="personal-caption">Private to your signed-in account. Saved online to Supabase; no offline saving yet.</p>
    {loading && <p role="status">Loading your exercises…</p>}
    {error && <div role="alert"><p>{error}</p><button className="reset-filters" onClick={retry}>Retry personal exercises</button></div>}
    {message && <p role="status">{message}</p>}
    {form && <form className="personal-form" onSubmit={save} aria-label={editing ? 'Edit personal exercise' : 'Add custom exercise'}>
      <h3>{editing ? 'Edit exercise' : 'New personal exercise'}</h3>
      <fieldset disabled={busy}>
        {(['name', 'primary_muscle', 'equipment'] as const).map((field, index) => <label key={field}>{['Name', 'Primary muscle', 'Equipment'][index]}<input required value={form[field]} onChange={event => setForm({ ...form, [field]: event.target.value })} /></label>)}
        {(['instructions', 'notes'] as const).map(field => <label key={field}>{field === 'instructions' ? 'Instructions (optional)' : 'Notes (optional)'}<textarea rows={3} value={form[field]} onChange={event => setForm({ ...form, [field]: event.target.value })} /></label>)}
        <label>Tutorial URL (optional)<input type="url" value={form.tutorial_url ?? ''} onChange={event => setForm({ ...form, tutorial_url: event.target.value })} placeholder="https://?" /></label>
        <label>Preferred weight unit<select value={form.weight_unit} onChange={event => setForm({ ...form, weight_unit: event.target.value as 'kg' | 'lb' })}><option value="kg">kg</option><option value="lb">lb</option></select></label>
        <label>Weight increment (optional, in {form.weight_unit})<input type="number" step="any" value={form.weight_increment} onChange={event => setForm({ ...form, weight_increment: event.target.value })} /></label>
        <p>These preferences apply to this exercise. Historical recorded loads are unchanged.</p>
        <div className="personal-actions"><button className="primary-action" type="submit">{busy ? 'Saving…' : 'Save exercise'}</button><button className="reset-filters" type="button" onClick={() => setForm(null)}>Cancel</button></div>
      </fieldset>
    </form>}
    {archiveTarget && <div className="library-message" role="group" aria-label="Confirm archive"><p>Archive {archiveTarget.name}? It will be hidden from the active list. Its record will be preserved.</p><button className="primary-action" disabled={busy} onClick={() => void archive()}>Confirm archive</button> <button className="reset-filters" disabled={busy} onClick={() => setArchiveTarget(null)}>Cancel archive</button></div>}
    <label className="archived-toggle"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} /> Show archived exercises</label>
    {showRows && !loading && !error && (visible.length ? <ul className="exercise-list">{visible.map(row => <li key={row.id} className="personal-row"><details><summary>{row.name}<small>{row.primary_muscle ?? 'Muscle not recorded'} · {row.equipment ?? 'Equipment not recorded'}</small></summary><small>{row.catalogue_id ? 'From shared catalogue - Personal settings' : row.catalogue_id === null ? 'Custom - Personal' : 'Personal'}{row.is_archived ? ' · Archived' : ''} · {row.primary_muscle ?? 'Muscle not recorded'} · {row.equipment ?? 'Equipment not recorded'}</small><small>{row.weight_unit ?? 'Unit not chosen'}{row.weight_increment !== null ? ` · Increment ${row.weight_increment}` : ''}</small>{row.instructions && <p className="exercise-text">{row.instructions}</p>}{row.notes && <p className="exercise-text">Notes: {row.notes}</p>}</details><div className="personal-actions"><Link className="reset-filters" to={`/exercises/personal/${row.id}${filterContext}`}>Guide & settings</Link><button className="reset-filters" disabled={busy || !!form} onClick={() => edit(row)}>Edit</button>{!row.is_archived && <button className="reset-filters" disabled={busy || !!form} onClick={() => setArchiveTarget(row)}>{row.catalogue_id ? 'Remove from My List' : 'Archive'}</button>}</div></li>)}</ul> : <p role="status">{rows.length ? 'No personal exercises match these filters.' : 'No personal exercises yet. Add your first movement.'}</p>)}
  </section>
}
