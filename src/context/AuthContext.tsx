import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type AuthContextType = {
  isAuthenticated: boolean
  loading: boolean
  login: () => void
  logout: () => Promise<void>
  checkAuth: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  const login = () => setIsAuthenticated(true)

  const logout = useCallback(async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/logout/`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {}
    setIsAuthenticated(false)
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/me/`, {
        method: 'GET',
        credentials: 'include',
      })
      if (res.ok) {
        setIsAuthenticated(true)
        return true
      }
      await logout()
      return false
    } catch {
      await logout()
      return false
    } finally {
      setLoading(false)
    }
  }, [logout])

  // Initial app load
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Re-check when tab/window regains focus or becomes visible
  useEffect(() => {
    const onFocus = () => { checkAuth() }
    const onVisibility = () => { if (document.visibilityState === 'visible') checkAuth() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [checkAuth])

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
