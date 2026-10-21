import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import AppShell from '../app/AppShell'
import NativeLaunchGate, { NativeReady } from '../native/NativeLaunchGate'
import { supabase } from '../lib/supabase'
import './auth.css'
import OfflineAccess from './OfflineAccess'
import {prepareOnlineDevice} from './deviceAccess'
import { ensureOnline, isUnlocked, lock, trustedAccounts, type TrustedAccount } from '../data/vault'
import { workoutStore } from '../data/workoutStore'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to connect. Please try again.'
}

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [vaultReady, setVaultReady] = useState<string | null>(null)
  const [vaultError, setVaultError] = useState('')
  const [offlineUser, setOfflineUser] = useState<TrustedAccount | null>(null)
  const [offlinePrompt, setOfflinePrompt] = useState(false)
  const [forceLogin, setForceLogin] = useState(false)
  const [retryVault, setRetryVault] = useState(0)
  const currentAuthUser = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    let authChanged = false
    const callbackParams = new URLSearchParams(window.location.hash.slice(1))
    const callbackError = callbackParams.get('error_description')
      ?? new URLSearchParams(window.location.search).get('error_description')
    if (callbackError) {
      setSessionError(callbackError)
      window.history.replaceState(null, '', window.location.pathname)
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      authChanged = true
      if (event === 'SIGNED_OUT' || (nextSession && currentAuthUser.current && currentAuthUser.current !== nextSession.user.id)) { lock(); setVaultReady(null); setOfflineUser(null) }
      currentAuthUser.current = nextSession?.user.id ?? null
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') { setForceLogin(false); setOfflinePrompt(false); setOfflineUser(null) }
      setSession(nextSession)
      setInitializing(false)
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setSessionError(error.message)
      if (!authChanged) { currentAuthUser.current = data.session?.user.id ?? null; setSession(data.session) }
      setInitializing(false)
    }).catch((error: unknown) => {
      if (!active) return
      setSessionError(errorMessage(error))
      setInitializing(false)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId || forceLogin) return
    let active = true
    setVaultReady(null); setVaultError('')
    if (!navigator.onLine) { setVaultError('You are offline. Unlock a trusted device account to continue.'); return }
    void prepareOnlineDevice(userId, {ensureOnline, encryptLegacy: id => workoutStore.encryptLegacy(id), lock}).then(() => { if (active) { setVaultReady(userId); setOfflineUser(null) } }).catch(error => { if (active) setVaultError(errorMessage(error)) })
    return () => { active = false }
  }, [session?.user.id, forceLogin, retryVault])
  useEffect(() => {
    const retry = () => setRetryVault(value => value + 1)
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])
  useEffect(() => {
    if (!offlineUser) return
    let timer: number
    const expire = () => { const remaining = offlineUser.expiresAt - Date.now(); if (remaining > 0) { timer = window.setTimeout(expire, Math.min(2147483647, remaining)); return } lock(offlineUser.userId); setOfflineUser(null); setOfflinePrompt(true); setVaultError('Trusted offline access expired. Reconnect and sign in.') }
    expire()
    return () => window.clearTimeout(timer)
  }, [offlineUser])
  function requestLogin() { lock(); setVaultReady(null); setOfflineUser(null); setOfflinePrompt(false); setForceLogin(true) }

  async function logout() {
    setSigningOut(true)
    setSessionError('')
    try {
      const userId = offlineUser?.userId ?? session?.user.id
      if (userId && await workoutStore.pending(userId)) throw new Error('Sync your device workout changes before signing out. Your encrypted device data is preserved.')
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      lock(); setVaultReady(null); setOfflineUser(null); setSession(null); setForceLogin(false)
    } catch (error) {
      setSessionError(errorMessage(error))
    } finally { setSigningOut(false) }
  }

  if (initializing) return <NativeReady><main className="gym-auth-screen"><div className="gym-auth-card" role="status">Restoring your session…</div></main></NativeReady>

  const trusted = (() => { try { return trustedAccounts() } catch { return [] } })()
  if (offlineUser && isUnlocked(offlineUser.userId)) return <NativeLaunchGate userId={offlineUser.userId}><button className="offline-login-button" onClick={requestLogin}>Sign in to sync</button><AppShell key={offlineUser.userId} userId={offlineUser.userId} email={offlineUser.email} logout={() => void logout()} signingOut={signingOut} sessionError={sessionError || 'Trusted offline access. Sign in again before syncing cloud data.'} /></NativeLaunchGate>
  if (forceLogin || (!session && !offlinePrompt && (navigator.onLine || !trusted.length))) return <><AuthForm initialError={sessionError} />{trusted.length > 0 && <button className="offline-login-button" onClick={() => { setForceLogin(false); setOfflinePrompt(true) }}>Use trusted offline access</button>}</>
  if (!session || vaultReady !== session.user.id || !isUnlocked(session.user.id)) {
    if (session && navigator.onLine && !vaultError && !offlinePrompt) return <NativeReady><main className="gym-auth-screen"><section className="gym-auth-card" role="status">Verifying private device access?</section></main></NativeReady>
    return <NativeReady><OfflineAccess expectedUserId={session?.user.id} error={vaultError} onUnlock={account => { setOfflineUser(account); setForceLogin(false) }} onRetry={() => { setOfflinePrompt(false); setRetryVault(value => value + 1) }} onLogin={requestLogin} /></NativeReady>
  }
  return <NativeLaunchGate userId={session.user.id}><AppShell key={session.user.id} userId={session.user.id} email={session.user.email} logout={() => void logout()} signingOut={signingOut} sessionError={sessionError} /></NativeLaunchGate>
}

function AuthForm({ initialError }: { initialError: string }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  const [message, setMessage] = useState('')
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  useEffect(() => { setError(initialError) }, [initialError])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    setNeedsConfirmation(false)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin + window.location.pathname },
        })
        if (error) throw error
        if (!data.session) {
          setMessage('Check your email for a confirmation link. Confirm your email, then return here to log in. If you already have an account, log in instead.')
          setNeedsConfirmation(true)
          setMode('login')
        }
        setPassword('')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) {
          if (error.code === 'email_not_confirmed') setNeedsConfirmation(true)
          throw error
        }
        setPassword('')
      }
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }

  async function resend() {
    if (busy || !email.trim()) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      } })
      if (error) throw error
      setMessage('Confirmation email requested. Check your inbox and spam folder before trying again.')
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }

  return <NativeReady><main className="gym-auth-screen">
    <section className="gym-auth-card" aria-labelledby="gym-auth-title">
      <div className="gym-auth-brand"><img src="/icons/arc-fit.svg" width="40" height="40" alt="" /> ARC FIT</div>
      <h1 id="gym-auth-title">{mode === 'login' ? 'Welcome back' : 'Start your next chapter'}</h1>
      <p className="gym-auth-intro">{mode === 'login' ? 'Log in to open ARC FIT.' : 'Create an account with your email and password.'}</p>
      <div className="gym-auth-modes" aria-label="Account access">
        {(['login', 'signup'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} disabled={busy} onClick={() => {
          setMode(value); setError(''); setMessage(''); setPassword(''); setNeedsConfirmation(false)
        }}>{value === 'login' ? 'Log in' : 'Sign up'}</button>)}
      </div>
      <form onSubmit={event => void submit(event)} aria-busy={busy}>
        <label htmlFor="gym-auth-email">Email address</label>
        <input id="gym-auth-email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" />
        <label htmlFor="gym-auth-password">Password</label>
        <input id="gym-auth-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : undefined} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} aria-describedby={mode === 'signup' ? 'gym-password-hint' : undefined} />
        {mode === 'signup' && <p id="gym-password-hint" className="gym-auth-hint">Use at least 8 characters. Your project's password requirements also apply.</p>}
        {error && <p className="gym-auth-error" role="alert">{error}</p>}
        {message && <p className="gym-auth-message" role="status">{message}</p>}
        <button className="gym-auth-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
      </form>
      {needsConfirmation && <button className="gym-auth-resend" type="button" disabled={busy || !email.trim()} onClick={() => void resend()}>Resend confirmation email</button>}
      <p className="gym-auth-footnote">Your private training space. Build, log and review your workouts.</p>
    </section>
  </main></NativeReady>
}
