import { Component } from 'react'
import type { ReactNode } from 'react'

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="gym-auth-screen">
      <section className="gym-auth-card" role="alert" aria-labelledby="app-error-title">
        <h1 id="app-error-title">ARC FIT couldn’t open this page</h1>
        <p>An unexpected error occurred. Reload the app to try again. Unsaved workout changes may be lost.</p>
        <button type="button" className="gym-auth-primary" onClick={() => window.location.reload()}>Reload app</button>
      </section>
    </main>
    return this.props.children
  }
}
