import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { WorkoutSession } from '../features/workout/sessions'
import {createUuid} from '../lib/uuid'
import {seal,open,registerEncryptedDataProbe} from './vault'
type LocalWorkout={key:string;userId:string;id:string;session:WorkoutSession;revision:number;updatedAt:number;conflict?:WorkoutSession}
type Pending={operationId:string;key:string;userId:string;revision:number;session:WorkoutSession;action:'save'|'edit';conflict?:boolean}
export class WorkoutDatabase extends Dexie{
 workouts!:Table<LocalWorkout,string>;outbox!:Table<Pending,string>;editors!:Table<{key:string;userId:string;token:string;expires:number},string>
 constructor(name='arc-fit-workouts-v2'){super(name);this.version(1).stores({workouts:'key,userId,id',outbox:'operationId,key,userId'});this.version(2).stores({editors:'key,userId'})}
}
export const workoutDb=new WorkoutDatabase()
const key=(userId:string,id:string)=>`${userId}:${id}`
type Codec={seal:(userId:string,value:unknown,key:string)=>unknown;open:<T>(userId:string,value:unknown,key:string)=>T}
const fixtureCodec:Codec={seal:(_u,v)=>v,open:<T>(_u:string,v:unknown)=>v as T}
export function createWorkoutStore(db:WorkoutDatabase=workoutDb,codec:Codec=fixtureCodec){
 const decode=(r:any):LocalWorkout|undefined=>r?({...r,session:codec.open<WorkoutSession>(r.userId,r.session,r.key+':session'),conflict:r.conflict?codec.open<WorkoutSession>(r.userId,r.conflict,r.key+':conflict'):undefined}):undefined
 const encode=(r:LocalWorkout):any=>({...r,session:codec.seal(r.userId,r.session,r.key+':session'),conflict:r.conflict?codec.seal(r.userId,r.conflict,r.key+':conflict'):undefined})
 const decodePending=(r:any):Pending=>({...r,session:codec.open<WorkoutSession>(r.userId,r.session,r.operationId)})
 const encodePending=(r:Pending):any=>({...r,session:codec.seal(r.userId,r.session,r.operationId)})
 const localGet=async(k:string)=>decode(await db.workouts.get(k))
 const localPut=async(r:LocalWorkout)=>db.workouts.put(encode(r))
 const pendingAdd=async(r:Pending)=>db.outbox.add(encodePending(r))
 return {
  async get(userId:string,id:string){const row=await localGet(key(userId,id));return row?.userId===userId?row:null},
  async list(userId:string){return (await db.workouts.where('userId').equals(userId).toArray()).map(r=>decode(r)!)},
  async claim(userId:string,id:string,token:string,now=Date.now()){
   const k=key(userId,id);return db.transaction('rw',db.editors,async()=>{const old=await db.editors.get(k);if(old&&old.token!==token&&old.expires>now)return false;await db.editors.put({key:k,userId,token,expires:now+15000});return true})
  },
  async release(userId:string,id:string,token:string){const k=key(userId,id);await db.transaction('rw',db.editors,async()=>{if((await db.editors.get(k))?.token===token)await db.editors.delete(k)})},
  async record(session:WorkoutSession,action:'save'|'edit'='save',token?:string){
   const k=key(session.userId,session.id)
   await db.transaction('rw',db.workouts,db.outbox,db.editors,async()=>{
    if(token){const lease=await db.editors.get(k);if(lease?.token!==token||lease.expires<=Date.now())throw new Error('This workout is being edited in another tab. Reopen it to take over safely.')}
    const old=await localGet(k)
    await localPut({key:k,id:session.id,userId:session.userId,session:structuredClone(session),revision:old?.revision??session.revision??0,updatedAt:Date.now(),conflict:old?.conflict})
    // One frozen in-flight operation; newer edits stay in the aggregate until receipt.
    if(!(await db.outbox.where('key').equals(k).count()))await pendingAdd({operationId:createUuid(),key:k,userId:session.userId,revision:old?.revision??session.revision??0,session:structuredClone(session),action})
   })
  },
  async cache(session:WorkoutSession){const k=key(session.userId,session.id);if(!await localGet(k))await localPut({key:k,id:session.id,userId:session.userId,session:structuredClone(session),revision:session.revision??0,updatedAt:Date.now()})},
  async refresh(session:WorkoutSession){const k=key(session.userId,session.id);await db.transaction('rw',db.workouts,db.outbox,async()=>{if(!await db.outbox.where('key').equals(k).count())await localPut({key:k,id:session.id,userId:session.userId,session:structuredClone(session),revision:session.revision??0,updatedAt:Date.now()})})},
  async pendingWorkout(userId:string,id:string){return db.outbox.where('key').equals(key(userId,id)).count()},
  async flush(userId:string,write:(s:WorkoutSession,id:string,revision:number,action:'save'|'edit')=>Promise<{revision:number}>,load:(userId:string,id:string)=>Promise<WorkoutSession>){
   for(let cycle=0;cycle<50;cycle++){
   const operations=(await db.outbox.where('userId').equals(userId).toArray()).map(decodePending);if(!operations.length)return
   for(const pending of operations){
    if(pending.conflict)throw Object.assign(new Error('Review the saved conflict before synchronizing.'),{code:'40001'})
    try{
     const receipt=await write(pending.session,pending.operationId,pending.revision,pending.action)
     await db.transaction('rw',db.workouts,db.outbox,async()=>{
      if(!await db.outbox.get(pending.operationId))return
      const local=await localGet(pending.key);if(!local||local.userId!==userId)throw new Error('Local account changed')
      await db.outbox.delete(pending.operationId)
      const newer=JSON.stringify(local.session)!==JSON.stringify(pending.session)
      const session={...local.session,revision:receipt.revision}
      await localPut({...local,session,revision:receipt.revision})
      if(newer)await pendingAdd({operationId:createUuid(),key:pending.key,userId,revision:receipt.revision,session,action:pending.action})
     })
    }catch(error){if((error as {code?:string}).code==='40001'){
     const server=await load(userId,pending.session.id)
     await db.transaction('rw',db.workouts,db.outbox,async()=>{await db.outbox.update(pending.operationId,{conflict:true});const row=await localGet(pending.key);if(row){if(server.userId!==userId)throw new Error('Foreign conflict response');await localPut({...row,conflict:server})}})
    }throw error}
   }
   }
   throw new Error('New edits are still saved locally. Continue syncing when logging pauses.')
  },
  async start(session:WorkoutSession){return db.transaction('rw',db.workouts,db.outbox,db.editors,async()=>{
   const rows=(await db.workouts.where('userId').equals(session.userId).toArray()).map(r=>decode(r)!)
   if(rows.some(r=>r.id!==session.id&&!r.session.completedAt&&!r.session.deletedAt))throw new Error('Resume your unfinished workout before starting another.')
   const existing=rows.find(r=>r.id===session.id);if(existing)return existing.session
   await this.record(session);return session
  })},
  async encryptLegacy(userId:string){await db.transaction('rw',db.workouts,db.outbox,async()=>{for(const r of await db.workouts.where('userId').equals(userId).toArray()){if((r.session as any)?.userId===userId)await localPut(r)}for(const r of await db.outbox.where('userId').equals(userId).toArray()){if((r.session as any)?.userId===userId)await db.outbox.put(encodePending(r))}})},
  async pending(userId:string){return db.outbox.where('userId').equals(userId).count()},
  async resolve(userId:string,id:string,choice:'server'|'local',token?:string){
   const k=key(userId,id);await db.transaction('rw',db.workouts,db.outbox,db.editors,async()=>{
    if(token){const lease=await db.editors.get(k);if(lease?.token!==token||lease.expires<=Date.now())throw new Error('Another tab owns this workout editor.')}
    const row=await localGet(k);if(!row?.conflict||row.userId!==userId)throw new Error('Conflict unavailable')
    const s=choice==='server'?row.conflict:{...row.session,revision:row.conflict.revision??0}
    await db.outbox.where('key').equals(k).delete();await localPut({...row,session:s,revision:row.conflict.revision??0,conflict:undefined})
    if(choice==='local')await pendingAdd({operationId:createUuid(),key:k,userId,revision:row.conflict.revision??0,session:s,action:row.conflict.completedAt?'edit':'save'})
   })
  },
 }
}
registerEncryptedDataProbe(async(userId:string)=>{const rows=await workoutDb.workouts.where('userId').equals(userId).toArray();const queue=await workoutDb.outbox.where('userId').equals(userId).toArray();return [...rows,...queue].some(r=>(r.session as any)?.version===1)})
export const workoutStore=createWorkoutStore(workoutDb,{seal,open:<T>(u:string,v:unknown,k:string)=>{if((v as any)?.userId===u)return v as T;return open<T>(u,v as Parameters<typeof open>[1],k)}})
