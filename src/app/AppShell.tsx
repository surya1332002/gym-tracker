import { useEffect, useRef } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import ProfileStatus from '../auth/ProfileStatus'
import { useTheme } from './ThemeProvider'
import './shell.css'
import ExerciseLibrary from '../features/exercises/ExerciseLibrary'

const destinations = [
  { path: '/', title: 'Home', symbol: '⌂' },
  { path: '/workout', title: 'Workout', symbol: '↗' },
  { path: '/exercises', title: 'Exercises', symbol: '≡' },
  { path: '/progress', title: 'Progress', symbol: '◷' },
  { path: '/profile', title: 'Profile', symbol: '○' },
]

function Navigation() {
  return <nav aria-label="Main navigation" className="shell-nav">
    {destinations.map(({ path, title, symbol }) => <NavLink key={path} to={path} end={path === '/'}>
      <span className="nav-symbol" aria-hidden="true">{symbol}</span><span>{title}</span>
    </NavLink>)}
  </nav>
}

function WorkoutAccess() {
  return <aside className="workout-access" aria-label="Workout access">
    <div><strong>Your workout, within reach</strong><p>Workout logging is coming next.</p></div>
    <Link to="/workout">Open Workout <span aria-hidden="true">→</span></Link>
  </aside>
}

function Placeholder({ title, description, items }: { title: string; description: string; items: string[] }) {
  return <>
    <div className="page-heading"><span className="eyebrow">YOUR TRAINING SPACE</span><h1>{title}</h1><p>{description}</p></div>
    <section className="placeholder-card" aria-labelledby="coming-title">
      <span className="feature-badge">Coming soon</span><h2 id="coming-title">A foundation for your training</h2>
      <p>This section is ready to navigate. These features are not available yet:</p>
      <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>
    </section>
  </>
}

function ThemeControl() {
  const { theme, setTheme, error } = useTheme()
  return <section className="settings-card" aria-labelledby="appearance-title">
    <h2 id="appearance-title">Appearance</h2><p>Choose a theme, or follow your device. Saved in this browser.</p>
    <fieldset className="theme-options"><legend>Theme preference</legend>
      {(['light', 'dark', 'system'] as const).map(option => <label key={option}>
        <input type="radio" name="theme" value={option} checked={theme === option} onChange={() => setTheme(option)} />
        <span>{option[0].toUpperCase() + option.slice(1)}</span>
      </label>)}
    </fieldset>{error && <p role="status">{error}</p>}
  </section>
}

export default function AppShell({ userId, email, logout, signingOut, sessionError }: {
  userId: string; email?: string; logout: () => void; signingOut: boolean; sessionError: string
}) {
  const location = useLocation()
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    document.title = `${destinations.find(item => item.path === location.pathname || (item.path !== '/' && location.pathname.startsWith(`${item.path}/`)))?.title ?? 'Page not found'} · Gym Tracker`
    main.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [location.pathname])
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="shell-sidebar"><Link className="brand" to="/" aria-label="Gym Tracker home"><span className="brand-mark" aria-hidden="true">GT</span><span>Gym Tracker<small>Make room for progress.</small></span></Link>
      <Navigation /><div className="sidebar-workout"><WorkoutAccess /></div>
    </aside>
    <div className="shell-body">
      <header className="shell-header"><Link className="mobile-brand" to="/">Gym Tracker</Link>
        <div className="account-actions"><Link to="/profile" className="account-link">{email ?? 'Your account'}</Link>
          <button type="button" className="logout-button" onClick={logout} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </header>
      {sessionError && <p className="shell-error" role="alert">{sessionError}</p>}
      <main id="main-content" className="shell-main" ref={main} tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Placeholder title="Home" description="Your training, one session at a time." items={['Suggested next workout', 'Weekly activity and recent workouts', 'Weight trends and personal records']} />} />
          <Route path="/workout" element={<Placeholder title="Workout" description="A space for your routines, gym sessions and history." items={['Your six-session Push / Pull / Legs rotation', 'Workout logging and active-session access', 'Workout history and standalone cardio']} />} />
          <Route path="/exercises" element={<ExerciseLibrary />} />
          <Route path="/exercises/:exerciseId" element={<ExerciseLibrary detail />} />
          <Route path="/progress" element={<Placeholder title="Progress" description="Understand your progress through the data you record." items={['Strength trends and personal records', 'Body weight and measurements', 'Private progress photos']} />} />
          <Route path="/profile" element={<>
            <div className="page-heading"><span className="eyebrow">YOUR ACCOUNT</span><h1>Profile</h1><p>Your preferences and account, in one place.</p></div>
            <div className="settings-grid"><ThemeControl /><section className="settings-card"><h2>Account profile</h2><ProfileStatus key={userId} userId={userId} /></section></div>
            <section className="settings-card"><span className="feature-badge">Coming soon</span><h2>More ways to make it yours</h2><p>Personal information editing, training preferences, exports and account recovery will arrive in later milestones.</p></section>
          </>} />
          <Route path="*" element={<section className="placeholder-card"><h1>Page not found</h1><p>Choose a section from the navigation or return home.</p><Link to="/">Go to Home →</Link></section>} />
        </Routes>
      </main>
    </div>
    <div className="mobile-dock"><WorkoutAccess /><Navigation /></div>
  </div>
}
