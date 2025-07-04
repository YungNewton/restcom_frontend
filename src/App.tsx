import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import LandingPage from './pages/LandingPage'
import Login from './pages/authentication/Login'
import Dashboard from './pages/dashboard/Dashboard'
import EmailAssistantTool from './pages/tools/EmailAssistant'
import VoiceTool from './pages/tools/Voice'
import ProtectedRoute from './routes/ProtectedRoute'
import { useAuth } from './context/AuthContext'

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        <Route
          path="/"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />}
        />
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route path="/dashboard" element={<ProtectedRoute Component={Dashboard} />} />
        <Route path="/email-assistant" element={<ProtectedRoute Component={EmailAssistantTool} />} />
        <Route path="/voice" element={<ProtectedRoute Component={VoiceTool} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
