import { useEffect, useState } from 'react'
import { sessionRepository } from '../workout/sessions'
import type { WorkoutSession } from '../workout/sessions'
export function useHistory(userId: string, includeActive = false, enabled = true) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, retry] = useState(0)
  useEffect(() => { if (!enabled) { setSessions([]); setLoading(false); setError(''); return } let alive = true; setSessions([]); setLoading(true); setError(''); void Promise.all([sessionRepository.list(userId, 'completed'), includeActive ? sessionRepository.list(userId, 'in_progress') : Promise.resolve([])]).then(async ([finished, active]) => { const rows = [...finished, ...active]
    // Bound simultaneous queries without silently truncating history.
    const result: WorkoutSession[] = []; for (let i = 0; i < rows.length; i += 8) result.push(...await Promise.all(rows.slice(i, i + 8).map(row => sessionRepository.load(userId, row.id))))
    if (alive) setSessions(result)
  }).catch(e => { if (alive) setError(e.message ?? 'History could not be loaded.') }).finally(() => { if (alive) setLoading(false) }); return () => { alive = false } }, [userId, attempt, includeActive, enabled])
  return { sessions, loading, error, retry: () => retry(n => n + 1) }
}
