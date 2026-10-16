import { useEffect, useRef, useState } from 'react'
import { programmeRepository } from '../workout/programmes'
import type { CatalogueMembership } from '../workout/programmes'
import { archivePersonalExercise } from './personal'

export const catalogueSelectionBlocker = 'Catalogue selection requires the catalogue/programme SQL migration and import. No selection is saved until Supabase confirms it.'
export default function CatalogueSelection({ userId, catalogueId, membership, ready = false, added = false, onChanged, compact = false, exerciseName }: {
  userId?: string; catalogueId?: string; membership?: CatalogueMembership; ready?: boolean; added?: boolean
  onChanged?: () => void
  compact?: boolean; exerciseName?: string
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const selected = membership ? !membership.is_archived : added
  async function change() {
    if (!userId || !catalogueId || !ready || busy) return
    if (selected && !window.confirm('Remove this exercise from My List? Its personal record and history will be preserved.')) return
    setBusy(true); setError('')
    try {
      if (selected && membership) await archivePersonalExercise(userId, membership.id)
      else await programmeRepository.selectCatalogue(userId, catalogueId)
      if (alive.current) onChanged?.()
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : 'Selection failed. Nothing has been confirmed; retry when connected.')
    } finally { if (alive.current) setBusy(false) }
  }
  return <div className={`catalogue-selection${compact ? ' catalogue-selection-compact' : ''}`}>
    {selected && <p className="feature-badge">Added</p>}
    <button className="primary-action" aria-label={exerciseName ? `${selected ? 'Remove from My List' : 'Add to My List'}: ${exerciseName}` : undefined} disabled={!ready || !userId || !catalogueId || busy} onClick={() => void change()}>{busy ? 'Saving…' : selected ? 'Remove from My List' : 'Add to My List'}</button>
    {!ready && !compact && <p className="boundary-notice">{catalogueSelectionBlocker}</p>}
    {error && <p role="alert">{error}</p>}
  </div>
}
