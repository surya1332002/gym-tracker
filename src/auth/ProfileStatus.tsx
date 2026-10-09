import { useEffect, useState } from 'react'
import { loadOrCreateProfile } from '../lib/profiles'
import type { ProfileResult } from '../lib/profiles'

function describeError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const code = 'code' in error && typeof error.code === 'string' ? ` (${error.code})` : ''
    return `${String(error.message)}${code}`
  }
  return 'Unable to load your profile. Please try again.'
}

export default function ProfileStatus({ userId }: { userId: string }) {
  const [result, setResult] = useState<ProfileResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setResult(null)
    void loadOrCreateProfile(userId).then(profile => {
      if (active) setResult(profile)
    }).catch((error: unknown) => {
      if (active) setError(describeError(error))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId, attempt])

  return <div className="gym-profile-status" aria-busy={loading}>
    {loading && <p role="status">Loading your profile…</p>}
    {error && <div className="gym-auth-error" role="alert">
      <p>Profile unavailable: {error}</p>
      <p>You can still browse the app while your profile is unavailable.</p>
      <button className="gym-auth-secondary" onClick={() => setAttempt(value => value + 1)}>Retry profile</button>
    </div>}
    {result && <details>
      <summary>{result.created ? 'Profile created and verified' : 'Profile loaded and verified'}</summary>
      <dl>
        <dt>User ID</dt><dd>{result.profile.id}</dd>
        <dt>Display name</dt><dd>{result.profile.display_name ?? 'Not set'}</dd>
        <dt>Timezone</dt><dd>{result.profile.timezone}</dd>
        <dt>Weight unit</dt><dd>{result.profile.weight_unit}</dd>
        <dt>Distance unit</dt><dd>{result.profile.distance_unit}</dd>
        <dt>Created</dt><dd>{result.profile.created_at}</dd>
        <dt>Updated</dt><dd>{result.profile.updated_at}</dd>
      </dl>
    </details>}
  </div>
}
