import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Login.module.css'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const LoginForm = () => {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: 'POST',
        credentials: 'include', // ✅ send cookies
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.identifier,
          password: form.password,
          remember_me: rememberMe,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        login() // ✅ no need to pass token
        toast.success('Login successful!')
        navigate('/')
      } else {
        toast.error(data.error || 'Login failed. Try again.')
      }
    } catch (err) {
      toast.error('Network error. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2 className={styles.title}>Login</h2>

      <input
        type="text"
        name="identifier"
        placeholder="Email or Username"
        value={form.identifier}
        onChange={handleChange}
        required
        className={styles.input}
      />

      <div className={styles.passwordField}>
        <input
          type={showPassword ? 'text' : 'password'}
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
          className={styles.input}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className={styles.eyeToggle}
          aria-label="Toggle password visibility"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <div className={styles.rememberRow}>
        <label className={styles.rememberLabel}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className={styles.checkbox}
          />
          Remember Me
        </label>
      </div>

      <button type="submit" className={styles.button}>Login</button>
    </form>
  )
}

export default LoginForm
