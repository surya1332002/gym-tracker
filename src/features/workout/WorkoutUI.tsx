import type { ReactNode } from 'react'
export function WorkoutIcon({ kind = 'dumbbell' }: { kind?: string }) {
 const paths: Record<string,string> = { chevron:'m9 5 7 7-7 7', dumbbell:'M6 6v12m12-12v12M3 9v6m18-6v6M6 12h12', clipboard:'M9 4h6v4H9zM9 6H5v15h14V6h-4M9 13h6m-6 4h4', play:'m10 8 6 4-6 4z', list:'m3 6 2 2 3-4m3 3h10M3 12h5m3 0h10M3 18h5m3 0h10', shuffle:'M3 6h3l12 12h3m-4-4 4 4-4 4M3 18h3L18 6h3m-4-4 4 4-4 4', arrow:'M4 12h16m-6-6 6 6-6 6', pencil:'m4 16 12-12 4 4L8 20H4z', more:'M5 12h.1M12 12h.1M19 12h.1' }
 return <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{kind==='play'&&<circle cx="12" cy="12" r="10"/>}<path d={paths[kind]??paths.dumbbell}/></svg>
}
export function WorkoutRow({ title, subtitle, icon = 'dumbbell', children }: { title: string; subtitle?: string; icon?: string; children?: ReactNode }) { return <><span className="workout-row-icon"><WorkoutIcon kind={icon}/></span><span className="workout-row-copy"><strong>{title}</strong>{subtitle&&<small>{subtitle}</small>}{children}</span><WorkoutIcon kind="chevron"/></> }
