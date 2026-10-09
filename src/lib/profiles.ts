import { supabase } from './supabase'

export interface Profile {
  id: string
  display_name: string | null
  timezone: string
  weight_unit: 'kg' | 'lb'
  distance_unit: 'km' | 'mi'
  created_at: string
  updated_at: string
}

export interface ProfileResult {
  profile: Profile
  created: boolean
}

function validateProfile(value: unknown, userId: string): Profile {
  const row = value as Partial<Profile> | null
  if (!row || row.id !== userId
    || !(row.display_name === null || typeof row.display_name === 'string')
    || typeof row.timezone !== 'string'
    || !['kg', 'lb'].includes(row.weight_unit ?? '')
    || !['km', 'mi'].includes(row.distance_unit ?? '')
    || typeof row.created_at !== 'string' || typeof row.updated_at !== 'string') {
    throw new Error('The profile response is missing or does not match the signed-in user and expected fields.')
  }
  return row as Profile
}

// Deduplicate StrictMode mounts and simultaneous requests without caching preferences.
const pendingProfiles = new Map<string, Promise<ProfileResult>>()

export function loadOrCreateProfile(userId: string): Promise<ProfileResult> {
  const pending = pendingProfiles.get(userId)
  if (pending) return pending
  const request = fetchProfile(userId).finally(() => { pendingProfiles.delete(userId) })
  pendingProfiles.set(userId, request)
  return request
}

async function fetchProfile(userId: string): Promise<ProfileResult> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!session || session.user.id !== userId) {
    throw new Error('A matching authenticated session is required to load your profile.')
  }

  const read = () => supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  const existing = await read()
  if (existing.error) throw existing.error
  if (existing.data) return { profile: validateProfile(existing.data, userId), created: false }

  // Only insert the UUID; database defaults supply preferences and timestamps.
  // A competing tab or auth trigger can create the same row between SELECT and INSERT.
  const inserted = await supabase.from('profiles').insert({ id: userId })
  if (inserted.error && inserted.error.code !== '23505') throw inserted.error

  const retrieved = await read()
  if (retrieved.error) throw retrieved.error
  if (!retrieved.data) {
    throw new Error('Your profile could not be read after creation. Check authenticated SELECT permissions and RLS policies.')
  }
  return { profile: validateProfile(retrieved.data, userId), created: !inserted.error }
}
