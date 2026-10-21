export type ReleaseContract = {
  contractId: string; nativeBaselineHash: string; webVersion: string;
  channel: 'development' | 'production'; otaEnabled: boolean;
}
export type StagedBundle = { id: string; version: string; checksum: string; baseline: string }
export function compatibleVersion(version: string, release: ReleaseContract, nativeVersion: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)\+([a-f0-9]{64})$/.exec(version)
  const native = /^(\d+)\.(\d+)\.\d+$/.exec(nativeVersion)
  return Boolean(match && native && release.contractId === 'arc-fit-storage-1' &&
    match[1] === native[1] && match[2] === native[2] && match[4] === release.nativeBaselineHash)
}
export function newerVersion(candidate: string, current: string): boolean {
  const parse = (value: string) => /^(\d+)\.(\d+)\.(\d+)(?:\+[a-f0-9]{64})?$/.exec(value)?.slice(1).map(Number)
  const a = parse(candidate), b = parse(current)
  if (!a || !b || [...a, ...b].some(n => !Number.isSafeInteger(n))) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}
export type UpdateSafety = { pending: number; foreignData: boolean; activeWorkout: boolean; dirtyDraft: boolean; conflict: boolean; onlineVerified: boolean; activeEditor: boolean }
export function safeToActivate(safety: UpdateSafety): boolean {
  return safety.onlineVerified && safety.pending === 0 && !safety.foreignData &&
    !safety.activeWorkout && !safety.dirtyDraft && !safety.conflict && !safety.activeEditor
}

// Capture the previously staged bundle before any downloads start. One attempt per
// JS launch, shared by React StrictMode and subsequent auth/account transitions.
export function createLaunchActivation(staged: StagedBundle | null) {
  let consumed = false
  let attempt: Promise<boolean> | undefined
  return {
    close() { consumed = true },
    run(check: () => Promise<boolean>, activate: (bundle: StagedBundle) => Promise<void>, timeoutMs = 5000) {
      if (attempt) return attempt
      if (consumed || !staged) return Promise.resolve(false)
      consumed = true
      let expired = false
      attempt = new Promise<boolean>(resolve => {
        const timer = setTimeout(() => { expired = true; resolve(false) }, timeoutMs)
        void (async () => {
          try {
            if (await check() && !expired) {
              // Eligibility timeout must never release an editor while a native
              // reload is already in flight. set() is a terminal operation.
              clearTimeout(timer)
              await activate(staged)
              resolve(true)
            }
            else resolve(false)
          } catch { resolve(false) }
          finally { clearTimeout(timer) }
        })()
      })
      return attempt
    },
  }
}
