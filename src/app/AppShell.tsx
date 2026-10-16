import WorkoutCalendar from '../features/workout/WorkoutCalendar'
import { useEffect, useRef } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import HomeDashboard from '../features/home/HomeDashboard'
import ProgressOverview from '../features/progress/ProgressOverview'
import Strength from '../features/progress/Strength'
import WorkoutHistory from '../features/progress/WorkoutHistory'
import BodyProgress from '../features/body/BodyProgress'
import CardioLogger from '../features/cardio/CardioLogger'
import ProgressPhotos from '../features/photos/ProgressPhotos'
import PersonalDetails from '../features/exercises/PersonalDetails'
import ActiveWorkoutBar from '../features/workout/ActiveWorkoutBar'
import {ProfileHome,PersonalInformation,TrainingPreferences,AppearanceSettings,DataPrivacy,AccountSettings} from '../features/profile/ProfileScreens'
import {AppearanceSync} from '../features/profile/AccountAppearance'
import './shell.css'
import ExerciseLibrary from '../features/exercises/ExerciseLibrary'
import WorkoutHub from '../features/workout/WorkoutHub'
import { WorkoutDraftProvider } from '../features/workout/WorkoutDraft'

const destinations = [
  { path: '/', title: 'Home', symbol: '⌂' },
  { path: '/exercises', title: 'Exercises', symbol: '≡' },
  { path: '/workout', title: 'Workout', symbol: '↗' },
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

export default function AppShell({ userId, email, logout, signingOut, sessionError }: {
  userId: string; email?: string; logout: () => void; signingOut: boolean; sessionError: string
}) {
  const location = useLocation()
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    document.title = `${destinations.find(item => item.path === location.pathname || (item.path !== '/' && location.pathname.startsWith(`${item.path}/`)))?.title ?? 'Page not found'} · Gym Tracker`
    main.current?.focus({ preventScroll: true })
    main.current?.scrollTo(0, 0)
  }, [location.pathname])
  useEffect(() => {
    const viewport = window.visualViewport
    const resize = () => document.documentElement.style.setProperty('--app-height', `${viewport?.height ?? window.innerHeight}px`)
    resize(); viewport?.addEventListener('resize', resize); window.addEventListener('resize', resize)
    return () => { viewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize); document.documentElement.style.removeProperty('--app-height') }
  }, [])
  return <WorkoutDraftProvider userId={userId}><div className="app-shell">
    <AppearanceSync userId={userId}/><a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="shell-sidebar"><Link className="brand" to="/" aria-label="ARC FIT home"><span className="brand-mark" aria-hidden="true">GT</span><span>ARC FIT<small>Make room for progress.</small></span></Link>
      <Navigation />
    </aside>
    <div className="shell-body">
      <header className="shell-header">
        <button type="button" className="future-menu" disabled aria-label="Menu — coming soon" title="Menu coming soon"><span aria-hidden="true"><i /><i /><i /></span></button>
        <Link className="arc-brand" to="/" aria-label="ARC FIT home"><span>ARC</span> <span>FIT</span></Link>
      </header>
      <main id="main-content" className="shell-main" ref={main} tabIndex={-1}>
        {sessionError && <p className="shell-error" role="alert">{sessionError}</p>}
        <Routes>
          <Route path="/" element={<HomeDashboard userId={userId}/>} />
          <Route path="/workout/history" element={<WorkoutHistory userId={userId}/>} />
          <Route path="/workout/cardio/*" element={<CardioLogger userId={userId}/>} />
          <Route path="/workout/*" element={<WorkoutHub key={userId} userId={userId} />} />
          <Route path="/exercises" element={<ExerciseLibrary key={userId} userId={userId} />} />
          <Route path="/exercises/search" element={<ExerciseLibrary key={userId} userId={userId} mode="search" />} />
          <Route path="/exercises/custom" element={<ExerciseLibrary key={userId} userId={userId} mode="custom" />} />
          <Route path="/exercises/my-list" element={<ExerciseLibrary key={userId} userId={userId} mode="my-list" />} />
          <Route path="/exercises/personal/:exerciseId" element={<PersonalDetails userId={userId}/>} />
          <Route path="/exercises/:exerciseId" element={<ExerciseLibrary key={userId} userId={userId} detail />} />
          <Route path="/progress" element={<ProgressOverview/>}/>
          <Route path="/progress/strength" element={<Strength userId={userId}/>}/>
          <Route path="/progress/calendar" element={<WorkoutCalendar userId={userId}/>}/>
          <Route path="/progress/body/*" element={<BodyProgress userId={userId}/>}/>
          <Route path="/progress/photos" element={<ProgressPhotos userId={userId}/>}/>
          <Route path="/profile" element={<ProfileHome/>}/>
          <Route path="/profile/personal" element={<PersonalInformation userId={userId}/>}/>
          <Route path="/profile/training" element={<TrainingPreferences userId={userId}/>}/>
          <Route path="/profile/appearance" element={<AppearanceSettings userId={userId}/>}/>
          <Route path="/profile/privacy" element={<DataPrivacy userId={userId}/>}/>
          <Route path="/profile/account" element={<AccountSettings userId={userId} email={email} logout={logout} signingOut={signingOut}/>}/>
          <Route path="*" element={<section className="placeholder-card"><h1>Page not found</h1><p>Choose a section from the navigation or return home.</p><Link to="/">Go to Home →</Link></section>} />
        </Routes>
      </main>
    </div>
    <ActiveWorkoutBar key={userId} userId={userId}/><div className="mobile-dock"><Navigation /></div>
  </div></WorkoutDraftProvider>
}
