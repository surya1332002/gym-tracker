import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'
const themeKey = 'gym_theme_v1'
const validTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark' || value === 'system'
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; error: string } | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try { const saved = localStorage.getItem(themeKey); return validTheme(saved) ? saved : 'system' }
    catch { return 'system' }
  })
  const [error, setError] = useState('')
  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? (system.matches ? 'dark' : 'light') : theme }
    apply()
    system.addEventListener('change', apply)
    return () => system.removeEventListener('change', apply)
  }, [theme])
  useEffect(() => {
    try { localStorage.setItem(themeKey, theme); setError('') }
    catch { setError('Your theme applies for this session, but this browser could not save the preference.') }
  }, [theme])
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === themeKey || event.key === null) setTheme(validTheme(event.newValue) ? event.newValue : 'system')
    }
    window.addEventListener('storage', update)
    return () => window.removeEventListener('storage', update)
  }, [])
  const value = useMemo(() => ({ theme, setTheme, error }), [theme, error])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('Theme controls require ThemeProvider.')
  return value
}
