import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import AppShell from '../app/AppShell'
import { supabase } from '../lib/supabase'
import './auth.css'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to connect. Please try again.'
}

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      authChanged = true
      setSession(nextSession)
      setInitializing(false)
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setSessionError(error.message)
      if (!authChanged) setSession(data.session)
      setInitializing(false)
    }).catch((error: unknown) => {
      if (!active) return
      setSessionError(errorMessage(error))
      setInitializing(false)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  async function logout() {
    setSigningOut(true)
    setSessionError('')
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      setSession(null)
    } catch (error) {
      setSessionError(errorMessage(error))
    } finally { setSigningOut(false) }
  }

  if (initializing) return <main className="gym-auth-screen"><div className="gym-auth-card" role="status">Restoring your session…</div></main>

  if (!session) return <AuthForm initialError={sessionError} />

  return <AppShell key={session.user.id} userId={session.user.id} email={session.user.email}
    logout={() => void logout()} signingOut={signingOut} sessionError={sessionError} />
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

  return <main className="gym-auth-screen">
    <section className="gym-auth-card" aria-labelledby="gym-auth-title">
      <div className="gym-auth-brand">GYM TRACKER</div>
      <h1 id="gym-auth-title">{mode === 'login' ? 'Welcome back' : 'Start your next chapter'}</h1>
      <p className="gym-auth-intro">{mode === 'login' ? 'Log in to open Gym Tracker.' : 'Create an account with your email and password.'}</p>
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
      <p className="gym-auth-footnote">Your private training space. Workout logging is coming soon.</p>
    </section>
  </main>
}
