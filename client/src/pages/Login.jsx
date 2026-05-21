import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../store/auth.store'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>Trackly</h1>
        <p style={styles.sub}>Sign in to your account</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p style={styles.link}>
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#0d0f12',
  },
  card: {
    background: '#13161b', border: '1px solid #252a33',
    borderRadius: '12px', padding: '40px', width: '100%', maxWidth: '400px',
  },
  logo: {
    fontFamily: 'sans-serif', fontSize: '28px', fontWeight: '700',
    color: '#e2e4e9', margin: '0 0 6px', textAlign: 'center',
  },
  sub: { color: '#8b90a0', fontSize: '14px', textAlign: 'center', marginBottom: '28px' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  input: {
    background: '#1a1e25', border: '1px solid #252a33', borderRadius: '8px',
    padding: '12px 14px', color: '#e2e4e9', fontSize: '14px', outline: 'none',
  },
  btn: {
    background: '#3b8de0', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    marginTop: '4px',
  },
  link: { color: '#8b90a0', fontSize: '13px', textAlign: 'center', marginTop: '16px' },
}
