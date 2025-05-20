import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactElement, ComponentType } from 'react'

type ProtectedRouteProps = {
  Component: ComponentType
}

const ProtectedRoute = ({ Component }: ProtectedRouteProps): ReactElement => {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Component /> : <Navigate to="/login" replace />
}

export default ProtectedRoute
