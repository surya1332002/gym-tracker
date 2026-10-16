import type { WorkoutSession,SessionExercise,DurationState } from './sessions'
import { makeSession } from './sessions'
import { createUuid } from '../../lib/uuid'
import type { PersonalExercise } from '../exercises/personal'
export function elapsedSeconds(session:WorkoutSession,now=Date.now()){
 const state=session.duration
 if(state?.overrideSeconds!=null)return state.overrideSeconds
 const end=state?.pausedAt??session.completedAt
 return Math.max(0,Math.floor(((end?Date.parse(end):now)-Date.parse(session.startedAt))/1000)-(state?.pausedSeconds??0))
}
export function togglePause(session:WorkoutSession,now=new Date()):WorkoutSession{
 const state:DurationState=session.duration??{pausedAt:null,pausedSeconds:0,overrideSeconds:null}
 return {...session,duration:state.pausedAt?{...state,pausedAt:null,pausedSeconds:state.pausedSeconds+Math.max(0,(now.getTime()-Date.parse(state.pausedAt))/1000)}:{...state,pausedAt:now.toISOString()}}
}
export function addSessionExercise(session:WorkoutSession,row:PersonalExercise):WorkoutSession{
 const fresh=makeSession(session.userId,null,{name:session.name,exercises:[{exerciseId:row.id,name:row.name,sets:null,min:null,max:null}]},[row])
 return {...session,exercises:[...session.exercises,fresh.exercises[0]]}
}
export function replaceSessionExercise(session:WorkoutSession,index:number,row:PersonalExercise):WorkoutSession{
 const old=session.exercises[index];if(!old)throw new Error('Exercise unavailable')
 const fresh=makeSession(session.userId,null,{name:session.name,exercises:[{exerciseId:row.id,name:row.name,sets:null,min:old.min,max:old.max}]},[row]).exercises[0]
 const remaining=old.sets.filter(s=>!s.completed)
 fresh.sets=remaining.map(s=>({...s,id:createUuid(),lb:'',weightKg:null,rpe:'',reps:'',completed:false,completedAt:null,notes:''}));fresh.nextNumber=Math.max(1,...fresh.sets.map(s=>s.number+1))
 const completed=old.sets.filter(s=>s.completed)
 return {...session,exercises:session.exercises.flatMap((e,i)=>i!==index?[e]:completed.length?[{...old,sets:completed},fresh]:[fresh])}
}
export function groupExercises(exercises:SessionExercise[],indices:number[],type:'superset'|'triset'|'circuit'){
 if(new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=exercises.length))throw new Error('Select distinct existing exercises for a group.')
 const n=type==='superset'?2:3;if(indices.length<n||(type!=='circuit'&&indices.length!==n))throw new Error(`Select ${type==='circuit'?'at least ':''}${n} exercises for this group.`)
 const group={id:createUuid(),type,name:type[0].toUpperCase()+type.slice(1)}
 return exercises.map((e,i)=>indices.includes(i)?{...e,group}:e)
}
export function progressionHint(previous:{weight_lb:number|null;reps:number|null}[],max:number|null,increment:number|null){
 if(!previous.length||max==null)return 'Log actual sets to build a performance baseline.'
 if(previous.every(s=>s.reps!=null&&s.reps>=max)&&increment!=null)return `All recorded sets reached ${max} reps. Consider your ${increment} unit increment; adjust only if it feels appropriate.`
 return `Build toward ${max} reps across your working sets before considering a weight increase.`
}
export function moveSessionSet(exercise:SessionExercise,index:number,direction:-1|1):SessionExercise{
 const target=index+direction
 if(!Number.isInteger(index)||index<0||index>=exercise.sets.length||target<0||target>=exercise.sets.length)return exercise
 const sets=[...exercise.sets];[sets[index],sets[target]]=[sets[target],sets[index]]
 return {...exercise,sets,setOrder:sets.map(set=>set.id)}
}
