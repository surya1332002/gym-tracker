import { Link, Route, Routes, useParams } from 'react-router-dom'
import CompactBuilder from './CompactBuilder'
import SavedWorkouts from './SavedWorkouts'
import ActiveWorkout from './ActiveWorkout'
import RandomWorkout from './RandomWorkout'
import { WorkoutIcon, WorkoutRow } from './WorkoutUI'
import './workout.css'
function SessionScreen({userId}:{userId:string}){const {sessionId}=useParams();return <div className="compact-workout"><ActiveWorkout key={`${userId}:${sessionId}`} userId={userId}/></div>}
export default function WorkoutHub({ userId }: { userId: string }) {
 return <Routes><Route index element={<div className="compact-workout"><header className="compact-heading"><h1>Workout</h1><WorkoutIcon/></header><div className="workout-home-grid"><Link to="/workout/build"><WorkoutIcon kind="clipboard"/><strong>Build Workout</strong><small>Create and manage routines</small><WorkoutIcon kind="arrow"/></Link><Link to="/workout/start"><WorkoutIcon kind="play"/><strong>Start Workout</strong><small>Train and log your sets</small><WorkoutIcon kind="arrow"/></Link></div></div>}/><Route path="build" element={<CompactBuilder userId={userId}/>}/><Route path="build/:programmeId" element={<CompactBuilder userId={userId}/>}/><Route path="build/:programmeId/day/:dayIndex" element={<CompactBuilder userId={userId}/>}/><Route path="start" element={<div className="compact-workout"><Link className="flow-back" to="/workout">Back to Workout</Link><h1>Start Workout</h1><div className="compact-rows"><Link className="compact-row" to="/workout/start/choose"><WorkoutRow title="Choose Workout" subtitle="Use your saved routines" icon="list"/></Link><Link className="compact-row" to="/workout/start/random"><WorkoutRow title="Random Workout" subtitle="Start without a saved routine" icon="shuffle"/></Link></div></div>}/><Route path="start/choose" element={<div className="compact-workout"><SavedWorkouts userId={userId}/></div>}/><Route path="start/random" element={<RandomWorkout userId={userId}/>}/><Route path="session/:sessionId" element={<SessionScreen userId={userId}/>}/><Route path="*" element={<Link to="/workout">Back to Workout</Link>}/></Routes>
}
