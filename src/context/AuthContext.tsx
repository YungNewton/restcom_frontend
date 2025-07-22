import { createContext, useContext, useEffect, useState } from 'react'

type AuthContextType = {
  isAuthenticated: boolean
  loading: boolean
  login: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  const login = () => {
    setIsAuthenticated(true)
  }

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/logout/`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (e) {
      console.error('Logout failed')
    }
    setIsAuthenticated(false)
  }

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/me/`, {
      method: 'GET',
      credentials: 'include',
    })
      .then(res => {
        if (res.ok) setIsAuthenticated(true)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
