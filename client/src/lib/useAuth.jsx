import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { user: current } = await api.get('/api/auth/me')
      setUser(current)
      return current
    } catch {
      // A 401 here is the normal signed-out case, not an error worth surfacing.
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const signIn = useCallback(async (credentials) => {
    const { user: current } = await api.post('/api/auth/login', credentials)
    setUser(current)
    return current
  }, [])

  const signUp = useCallback(async (details) => {
    const { user: current } = await api.post('/api/auth/signup', details)
    setUser(current)
    return current
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } finally {
      // Clear locally even if the request failed — the user asked to leave.
      setUser(null)
    }
  }, [])

  const updateUser = useCallback((next) => setUser(next), [])

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, refresh, updateUser }),
    [user, loading, signIn, signUp, signOut, refresh, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
