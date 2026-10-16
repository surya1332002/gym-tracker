import {useEffect,useState} from 'react'
import {Link,useLocation} from 'react-router-dom'
import {availableActiveWorkouts} from '../../data/startCache'
import {workoutStore} from '../../data/workoutStore'
import {syncWorkouts} from '../../data/workoutSync'
export default function ActiveWorkoutBar({userId}:{userId:string}){
 const [active,setActive]=useState<{id:string;name:string}|null>(null),[status,setStatus]=useState(''),location=useLocation()
 useEffect(()=>{let alive=true;async function update(){try{
  const local=await workoutStore.list(userId),pending=await workoutStore.pending(userId)
  const cached=local.find(r=>!r.session.completedAt&&!r.session.deletedAt)
  if(cached&&alive)setActive({id:cached.id,name:cached.session.name})
  if(navigator.onLine){const rows=await availableActiveWorkouts(userId);if(alive)setActive(rows[0]?{id:rows[0].id,name:rows[0].session.name}:null);if(pending){await syncWorkouts(userId);if(alive)setStatus('Synced')}}
  else if(alive)setStatus(pending?'Saved locally · offline':'Offline')
 }catch{if(alive)setStatus('Device copy kept · sync needs attention')}}void update();const timer=setInterval(()=>void update(),10000);window.addEventListener('online',update);return()=>{alive=false;clearInterval(timer);window.removeEventListener('online',update)}},[userId,location.pathname])
 return active?<aside className="active-workout-bar" aria-label="Active workout"><div><strong>{active.name}</strong><small>{status||'Unfinished workout'}</small></div><Link to={`/workout/session/${active.id}`}>Continue</Link></aside>:null
}
