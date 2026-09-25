import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'

export interface User { id: number; username: string; name: string; firm: string; isDefaultPassword: boolean }

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<User>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'same-origin' })
      setUser(r.ok ? (await r.json()).user : null)
    } catch { setUser(null) } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = useCallback(async (username: string, password: string) => {
    const { user } = await api.post<{ user: User }>('/api/auth/login', { username, password })
    setUser(user)
    return user
  }, [])

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => undefined)
    setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}
