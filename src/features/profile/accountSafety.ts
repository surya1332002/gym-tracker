export async function signOutBlocker(userId:string,hasUnsavedProgramme:boolean,pending:(userId:string)=>Promise<number>):Promise<string|null>{
 if(hasUnsavedProgramme)return 'Save your programme changes before signing out.'
 if(await pending(userId)>0)return 'Your workout has changes saved on this device that have not synced. Open the workout and sync before signing out.'
 return null
}
