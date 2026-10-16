import type {WorkoutSession,LoggedSet} from './sessions'
import {elapsedSeconds} from './sessionActions'
import {exercisePoints,validDate,type ExercisePoint} from '../progress/analytics'
export type SummaryRecord={exerciseId:string;name:string;kind:'heaviest'|'reps_at_load'|'estimated_1rm'|'session_volume';current:number;previous:number;loadKg?:number}
function loadKg(set:LoggedSet):number|null{if(set.weightKg!==undefined)return set.weightKg!==null&&Number.isFinite(set.weightKg)&&set.weightKg>=0?set.weightKg:null;return set.lb.trim()!==''&&Number.isFinite(Number(set.lb))&&Number(set.lb)>=0?Number(set.lb)*0.45359237:null}
function measured(set:LoggedSet){return set.reps.trim()!==''&&Number.isInteger(Number(set.reps))&&Number(set.reps)>0&&loadKg(set)!==null}
const better=(a:number,b:number)=>a>b+Math.max(1e-9,Math.abs(b)*1e-10)
const sameLoad=(a:number,b:number)=>Math.abs(a-b)<=Math.max(1e-9,Math.max(Math.abs(a),Math.abs(b))*1e-10)
function aggregated(points:ExercisePoint[]){const groups=new Map<string,ExercisePoint>();for(const point of points){const key=`${point.sessionId}:${point.exerciseId}`,old=groups.get(key);if(!old)groups.set(key,{...point,loads:[...point.loads]});else{old.volumeKg+=point.volumeKg;old.workingSets+=point.workingSets;old.maxReps=Math.max(old.maxReps,point.maxReps);old.weightKg=old.weightKg===null?point.weightKg:point.weightKg===null?old.weightKg:Math.max(old.weightKg,point.weightKg);old.estimated1RmKg=old.estimated1RmKg===null?point.estimated1RmKg:point.estimated1RmKg===null?old.estimated1RmKg:Math.max(old.estimated1RmKg,point.estimated1RmKg);old.loads.push(...point.loads)}}return [...groups.values()]}
export function deriveWorkoutSummary(session:WorkoutSession,history:WorkoutSession[]|null){
 const completed=session.exercises.flatMap(exercise=>exercise.sets).filter(set=>set.completed),known=completed.filter(measured)
 const start=Date.parse(session.startedAt),end=session.completedAt?Date.parse(session.completedAt):NaN,paused=session.duration?.pausedAt?Date.parse(session.duration.pausedAt):null
 const timestampsKnown=Number.isFinite(start)&&Number.isFinite(end)&&end>=start&&(paused===null||(Number.isFinite(paused)&&paused>=start&&paused<=end))
 const seconds=session.completedAt&&(session.duration?.overrideSeconds!=null||timestampsKnown)?elapsedSeconds(session):null
 const durationSeconds=seconds!==null&&Number.isFinite(seconds)&&seconds>=0?seconds:null
 const volumeKg=known.reduce((sum,set)=>sum+loadKg(set)!*Number(set.reps),0),unknownSets=completed.length-known.length
 const records:SummaryRecord[]=[],baselines:{exerciseId:string;name:string}[]=[]
 const historyVerified=history!==null&&history.every(row=>row.userId===session.userId)
 if(historyVerified&&validDate(session.date)){
  const prior=history!.filter(row=>row.id!==session.id&&!row.deletedAt&&validDate(row.date)&&(row.date<session.date||(row.date===session.date&&Date.parse(row.startedAt)<Date.parse(session.startedAt))))
  const oldPoints=aggregated(exercisePoints(prior)),newPoints=aggregated(exercisePoints([session]))
  for(const current of newPoints){const previous=oldPoints.filter(point=>point.exerciseId===current.exerciseId),oldLoads=previous.flatMap(point=>point.loads)
   if(!previous.length){baselines.push({exerciseId:current.exerciseId,name:current.name});continue}
   if(current.weightKg!==null){if(!oldLoads.length){baselines.push({exerciseId:current.exerciseId,name:current.name})}else{const old=Math.max(...oldLoads.map(value=>value.kg));if(better(current.weightKg,old))records.push({exerciseId:current.exerciseId,name:current.name,kind:'heaviest',current:current.weightKg,previous:old})}}
   const estimates=previous.map(point=>point.estimated1RmKg).filter((value):value is number=>value!==null)
   if(current.estimated1RmKg!==null&&estimates.length){const old=Math.max(...estimates);if(better(current.estimated1RmKg,old))records.push({exerciseId:current.exerciseId,name:current.name,kind:'estimated_1rm',current:current.estimated1RmKg,previous:old})}
   const loads=new Map<number,number>();for(const value of current.loads){const matching=[...loads.keys()].find(kg=>sameLoad(kg,value.kg));const key=matching??value.kg;loads.set(key,Math.max(loads.get(key)??0,value.reps))}
   for(const [kg,reps]of loads){const oldAtLoad=oldLoads.filter(value=>sameLoad(value.kg,kg));if(oldAtLoad.length){const old=Math.max(...oldAtLoad.map(value=>value.reps));if(reps>old)records.push({exerciseId:current.exerciseId,name:current.name,kind:'reps_at_load',current:reps,previous:old,loadKg:kg})}}
   const currentComplete=session.exercises.filter(exercise=>exercise.exerciseId===current.exerciseId).flatMap(exercise=>exercise.sets).filter(set=>set.completed&&(!set.setType||set.setType==='working')).every(measured)
   const priorComplete=prior.flatMap(row=>row.exercises.filter(exercise=>exercise.exerciseId===current.exerciseId)).flatMap(exercise=>exercise.sets).filter(set=>set.completed&&(!set.setType||set.setType==='working')).every(measured)
   if(currentComplete&&priorComplete&&previous.length){const old=Math.max(...previous.map(point=>point.volumeKg));if(better(current.volumeKg,old))records.push({exerciseId:current.exerciseId,name:current.name,kind:'session_volume',current:current.volumeKg,previous:old})}
  }
 }
 return {durationSeconds,exerciseSlots:session.exercises.length,performedExercises:session.exercises.filter(exercise=>exercise.sets.some(set=>set.completed)).length,completedSets:completed.length,volumeKg:known.length?volumeKg:null,unknownSets,records,baselines,historyVerified}
}
