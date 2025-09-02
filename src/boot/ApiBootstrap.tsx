// src/boot/ApiBootstrap.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { setupAuthInterceptors } from '../lib/setupAuthInterceptors'
import { useAuth } from '../context/AuthContext'

export default function ApiBootstrap() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const eject = setupAuthInterceptors(api, {
      onUnauthorized: async () => {
        try { await logout() } finally { navigate('/login', { replace: true }) }
      },
    })
    return () => eject()
  }, [logout, navigate])

  return null
}
