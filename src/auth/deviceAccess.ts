export async function prepareOnlineDevice(userId:string,actions:{ensureOnline:(userId:string)=>Promise<void>;encryptLegacy:(userId:string)=>Promise<void>;lock:(userId:string)=>void}){
 try { await actions.ensureOnline(userId); await actions.encryptLegacy(userId); return userId } catch(error) { actions.lock(userId); throw error }
}
export async function prepareOfflineDevice<T>(userId:string,passphrase:string,actions:{unlock:(userId:string,passphrase:string)=>Promise<T>;encryptLegacy:(userId:string)=>Promise<void>;lock:(userId:string)=>void}){
 try { const account=await actions.unlock(userId,passphrase); await actions.encryptLegacy(userId); return account } catch(error) { actions.lock(userId); throw error }
}
