import { useState } from 'react'
import styles from './Login.module.css'
import { Eye, EyeOff } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const LoginForm = () => {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.identifier,
          password: form.password,
          remember_me: rememberMe,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        const storage = rememberMe ? localStorage : sessionStorage
        storage.setItem('authToken', data.access)
        storage.setItem('refreshToken', data.refresh)
        storage.setItem('userEmail', data.user.email)
        storage.setItem('username', data.user.username)
        console.log('Login success:', data)
        // redirect or update UI
      } else {
        console.error('Login failed:', data.error || 'Unknown error')
      }
    } catch (err) {
      console.error('Network error:', err)
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
