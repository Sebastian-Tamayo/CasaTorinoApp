import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loginLocal } from './lib/api'
import type { StaffUser } from './types'

const SESSION_KEY = 'casa-torino-online-staff'

interface AuthContextValue {
  user: StaffUser | null
  loading: boolean
  login: (staffId: string, pin: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): StaffUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as StaffUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(readSession())
    setLoading(false)
  }, [])

  const login = useCallback(async (staffId: string, pin: string) => {
    const staff = await loginLocal(staffId, pin)
    localStorage.setItem(SESSION_KEY, JSON.stringify(staff))
    setUser(staff)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
