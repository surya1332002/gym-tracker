import {workoutStore} from './workoutStore'
import {sessionRepository} from '../features/workout/sessions'
const running=new Map<string,Promise<void>>()
export function syncWorkouts(userId:string){
 if(running.has(userId))return running.get(userId)!
 const task=workoutStore.flush(userId,(s,id,revision,action)=>sessionRepository.writeAttempt(s,id,revision,action),sessionRepository.load).finally(()=>running.delete(userId))
 running.set(userId,task);return task
}
