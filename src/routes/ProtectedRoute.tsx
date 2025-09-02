import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactElement, ComponentType } from 'react'
import { useEffect } from 'react'

type ProtectedRouteProps = {
  Component: ComponentType
}

const ProtectedRoute = ({ Component }: ProtectedRouteProps): ReactElement => {
  const { isAuthenticated, loading, checkAuth } = useAuth()

  // Re-validate when this protected tree mounts
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (loading) return <div>Loading...</div>

  return isAuthenticated ? <Component /> : <Navigate to="/login" replace />
}

export default ProtectedRoute
