export type Candidate={user_id:string;purge_after:string}
export type PurgeClaim=Candidate&{purge_claim_id:string}
export type StorageEntry={name:string;id:string|null}
export type PurgeBackend={
 prerequisites:()=>Promise<boolean>
 due:(limit:number)=>Promise<Candidate[]>
 claim:(userId:string,claimId:string)=>Promise<PurgeClaim|null>
 verify:(userId:string,claimId:string)=>Promise<boolean>
 list:(prefix:string,offset:number)=>Promise<StorageEntry[]>
 remove:(paths:string[])=>Promise<void>
 deleteUser:(userId:string)=>Promise<void>
 purgeTrash:()=>Promise<number>
}
export async function scheduledSecretMatches(supplied:string|null,expected:string|undefined){
 if(!expected||expected.length<32||!supplied||supplied.length>1024)return false
 const encoder=new TextEncoder(),[a,b]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(supplied)),crypto.subtle.digest('SHA-256',encoder.encode(expected))]);const left=new Uint8Array(a),right=new Uint8Array(b);let difference=0;for(let index=0;index<left.length;index++)difference|=left[index]^right[index];return difference===0
}
export async function runPurge(backend:PurgeBackend,options:{uuid:()=>string;now?:()=>number;limit?:number;maxObjects?:number;maxDurationMs?:number}){
 const now=options.now??Date.now,start=now(),limit=Math.max(1,Math.min(10,options.limit??5)),maxObjects=options.maxObjects??10000,maxDuration=options.maxDurationMs??90000
 const stats={accounts_deleted:0,accounts_skipped:0,accounts_failed:0,workouts_purged:0,trash_failed:false}
 if(!await backend.prerequisites())throw new Error('Owner cascade prerequisites are not satisfied.')
 const candidates=await backend.due(limit),seen=new Set<string>(),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 for(const candidate of candidates.slice(0,limit)){
  if(now()-start>maxDuration)break
  if(!uuid.test(candidate.user_id)||seen.has(candidate.user_id)){stats.accounts_skipped++;continue};seen.add(candidate.user_id)
  try{
   const claimId=options.uuid(),claim=await backend.claim(candidate.user_id,claimId)
   if(!claim){stats.accounts_skipped++;continue}
   if(claim.user_id!==candidate.user_id||claim.purge_claim_id!==claimId||!Number.isFinite(Date.parse(claim.purge_after))||Date.parse(claim.purge_after)>now())throw new Error('Invalid expired account claim.')
   async function verified(){if(now()-start>maxDuration||!await backend.verify(candidate.user_id,claimId))throw new Error('Account deletion claim is no longer valid.')}
   async function paths(){const folders=[candidate.user_id],objects=new Set<string>();for(let folderIndex=0;folderIndex<folders.length;folderIndex++){
    if(folders.length>maxObjects)throw new Error('Private storage traversal exceeds the safe batch size.')
    for(let offset=0;;offset+=100){await verified();const entries=await backend.list(folders[folderIndex],offset);for(const entry of entries){if(!entry.name||entry.name.includes('/')||entry.name.includes('..'))throw new Error('Unsafe private storage name.');const path=`${folders[folderIndex]}/${entry.name}`;if(!path.startsWith(`${candidate.user_id}/`))throw new Error('Storage belongs to another account.');if(entry.id===null)folders.push(path);else objects.add(path);if(objects.size>maxObjects)throw new Error('Private storage exceeds the safe batch size.')}if(entries.length<100)break}
   }return [...objects]}
   const originals=await paths()
   for(let offset=0;offset<originals.length;offset+=100){await verified();await backend.remove(originals.slice(offset,offset+100))}
   // Claimed accounts cannot upload under migration 08. An unexpected remaining
   // object still blocks auth deletion; retry instead of leaving orphaned data.
   if((await paths()).length)throw new Error('Private originals remain. Retry cleanup before deleting the account.')
   await verified();await backend.deleteUser(candidate.user_id);stats.accounts_deleted++
  }catch{stats.accounts_failed++}
 }
 try{stats.workouts_purged=await backend.purgeTrash()}catch{stats.trash_failed=true}
 return stats
}
export async function handlePurgeRequest(request:Request,secret:string|undefined,backend:()=>PurgeBackend){
 if(request.method!=='POST')return new Response('POST required',{status:405,headers:{Allow:'POST'}})
 if(!secret||secret.length<32)return new Response('Scheduled worker is not configured',{status:503})
 if(!await scheduledSecretMatches(request.headers.get('x-arc-fit-purge-secret'),secret))return new Response('Unauthorized',{status:401})
 try{const result=await runPurge(backend(),{uuid:()=>crypto.randomUUID()});return Response.json(result,{status:result.accounts_failed||result.trash_failed?503:200})}catch{return Response.json({error:'Deletion prerequisites or backend operation failed; no success was reported.'},{status:503})}
}
