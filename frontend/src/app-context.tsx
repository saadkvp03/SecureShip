import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'
export type Theme = 'light' | 'dark'

export interface AppContextValue {
  notify: (kind: ToastKind, message: string) => void
  // Incremented after every change so pages reload their data.
  version: number
  bump: () => void
  openCreate: () => void
  theme: Theme
  toggleTheme: () => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside <App>')
  return value
}
