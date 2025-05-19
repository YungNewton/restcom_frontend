// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom'

const ProtectedRoute = () => {
  const isAuthenticated = !!localStorage.getItem('authToken') // or your auth logic

  return isAuthenticated ? <Outlet /> : <Navigate to="/" />
}

export default ProtectedRoute