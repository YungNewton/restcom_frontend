import { createContext, useContext, useEffect, useState } from 'react'

type AuthContextType = {
  isAuthenticated: boolean
  login: (options?: { token: string; remember: boolean }) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)
  
    useEffect(() => {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken')
      setIsAuthenticated(!!token)
      setLoading(false)
    }, [])
  
    const login = (options?: { token: string; remember: boolean }) => {
      if (options) {
        const { token, remember } = options
        const storage = remember ? localStorage : sessionStorage
        storage.setItem('authToken', token)
      }
      setIsAuthenticated(true)
    }
  
    const logout = () => {
      localStorage.clear()
      sessionStorage.clear()
      setIsAuthenticated(false)
    }
  
    return (
      <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
        {!loading && children}
      </AuthContext.Provider>
    )
  }  

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
