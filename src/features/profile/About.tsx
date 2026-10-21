import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { isNativeAndroid, nativeRelease, subscribeUpdates, updateSnapshot } from '../../native/runtime'

export default function About() {
  const state = useSyncExternalStore(subscribeUpdates, updateSnapshot, updateSnapshot)
  return <div className="profile-screen"><Link to="/profile">‹ Profile</Link><h1>About ARC FIT</h1>
    <section className="settings-card"><h2>Application</h2><p>{isNativeAndroid() ? 'Android' : 'Web / PWA'}</p>
      <p>App version: {state.appVersion}{state.build ? ` (${state.build})` : ''}</p>
      <p style={{ overflowWrap: 'anywhere' }}>Web bundle: {state.bundleVersion}</p>
      {isNativeAndroid() && <><p>Channel: {nativeRelease.channel}</p><p role="status">{state.status}</p><p>{state.detail}</p><p>Updates apply only on a safe subsequent launch. Your workout stays open.</p></>}
    </section></div>
}
