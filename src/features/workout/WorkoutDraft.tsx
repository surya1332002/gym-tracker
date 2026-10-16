import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode, Dispatch, SetStateAction } from 'react'
import type { Split, WorkoutDraft } from './planner'
import { programmePayload } from './programmes'
import { createUuid } from '../../lib/uuid'
import {seal,open,isUnlocked,registerEncryptedDataProbe} from '../../data/vault'
export type ProgrammeSaveState = { id: string; revision: number; savedPayload: string | null; pending: { saveId: string; draft: WorkoutDraft } | null }
export const newProgrammeSaveState = (): ProgrammeSaveState => ({ id: createUuid(), revision: 0, savedPayload: null, pending: null })
export type PlannerConfiguration = { name: string; split: Split; count: number; muscles: string[] }
const initial: PlannerConfiguration = { name: 'My programme', split: 'PPL', count: 6, muscles: ['', '', ''] }
export function workoutDraftDirty(draft: WorkoutDraft | null, configuration: PlannerConfiguration, saveState: ProgrammeSaveState): boolean {
  if (saveState.pending) return true
  if (!draft) return JSON.stringify(configuration) !== JSON.stringify(initial)
  try {
    if (JSON.stringify(programmePayload(draft)) !== saveState.savedPayload) return true
    const muscles = configuration.split === 'Single muscle' ? 1 : configuration.split === 'Two muscles' ? 2 : configuration.split === 'Three muscles' ? 3 : 0
    return configuration.name !== (draft.name ?? '') || configuration.split !== draft.split || configuration.count !== draft.days.length || JSON.stringify(configuration.muscles.slice(0, muscles)) !== JSON.stringify(draft.muscles ?? [])
  } catch { return true }
}
const Context = createContext<{ draft: WorkoutDraft | null; setDraft: Dispatch<SetStateAction<WorkoutDraft | null>>; configuration: PlannerConfiguration; setConfiguration: Dispatch<SetStateAction<PlannerConfiguration>>; hasUnsavedChanges: boolean; saveState: ProgrammeSaveState; setSaveState: Dispatch<SetStateAction<ProgrammeSaveState>> } | null>(null)
export function WorkoutDraftProvider({ children,userId }: { children: ReactNode;userId?:string }) {
 const storageKey='arc-fit-programme-draft:'+userId
 const [restored]=useState(()=>{if(!userId||!isUnlocked(userId))return null;try{const value=localStorage.getItem(storageKey);return value?{data:open<{draft:WorkoutDraft|null;configuration:PlannerConfiguration;saveState:ProgrammeSaveState}>(userId,JSON.parse(value),storageKey),error:false}:null}catch{return {data:null,error:true}}})
 const [deviceError,setDeviceError]=useState(restored?.error?'Your previous device draft could not be decrypted. It has been preserved; connect and unlock the original trusted account before editing.':'')
  const [saveState, setSaveState] = useState<ProgrammeSaveState>(()=>restored?.data?.saveState??newProgrammeSaveState())
  const [draft, setDraft] = useState<WorkoutDraft | null>(restored?.data?.draft??null)
  const [configuration, setConfiguration] = useState<PlannerConfiguration>(restored?.data?.configuration??initial)
  const hasUnsavedChanges = workoutDraftDirty(draft, configuration, saveState)
  useEffect(() => {
    if (!userId || !isUnlocked(userId) || restored?.error) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(seal(userId, {draft, configuration, saveState}, storageKey)))
      setDeviceError('')
    } catch {
      setDeviceError('Programme device draft could not be saved. Keep this page open and save to your account.')
    }
  }, [userId, draft, configuration, saveState, storageKey])
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasUnsavedChanges])
  return <Context.Provider value={{ draft, setDraft, configuration, setConfiguration, hasUnsavedChanges, saveState, setSaveState }}>{deviceError&&<p role="alert">{deviceError}</p>}{children}</Context.Provider>
}
export function useWorkoutDraft() { const state = useContext(Context); if (!state) throw new Error('Workout draft provider is required.'); return state }

registerEncryptedDataProbe(async(userId:string)=>{try{return !!localStorage.getItem('arc-fit-programme-draft:'+userId)}catch{return false}})
