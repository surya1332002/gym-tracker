import { useEffect, useState, type ReactNode } from 'react'
import { activateStagedAtStartup, initializeNativeRuntime, isNativeAndroid, launchActivation, markNativeReady } from './runtime'
import { verifyUpdateSafety } from './updateSafety'

export function NativeRuntime({ children }: { children: ReactNode }) {
  useEffect(() => {
    void initializeNativeRuntime()
  }, [])
  return children
}
export function NativeReady({ children }: { children: ReactNode }) {
  useEffect(() => { void markNativeReady() }, [])
  return children
}
export default function NativeLaunchGate({ userId, children }: { userId: string; children: ReactNode }) {
  const [ready, setReady] = useState(!isNativeAndroid())
  useEffect(() => {
    let mounted = true
    void activateStagedAtStartup(() => verifyUpdateSafety(userId)).then(activated => {
      launchActivation.close()
      if (mounted && !activated) setReady(true)
    })
    return () => { mounted = false }
  }, [userId])
  return ready ? <NativeReady>{children}</NativeReady> : <main className="gym-auth-screen"><section className="gym-auth-card" role="status">Opening your training space…</section></main>
}
