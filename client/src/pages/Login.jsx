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

  const googleUrl = import.meta.env.VITE_API_URL + '/auth/google'

  return (
    <div className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
      <div className='w-full max-w-sm'>
        <div className='text-center mb-8'>
          <div className='w-10 h-10 bg-black rounded-xl flex items-center justify-center mx-auto mb-4'>
            <span className='text-white font-bold text-lg'>T</span>
          </div>
          <h1 className='text-2xl font-semibold text-gray-900'>Welcome back</h1>
          <p className='text-sm text-gray-500 mt-1'>Sign in to your Trackly account</p>
        </div>
        <div className='bg-white rounded-2xl border border-gray-200 shadow-sm p-8'>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div>
              <label className='text-sm font-medium text-gray-700 block mb-1.5'>Email</label>
              <input type='email' className='w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none' placeholder='you@example.com' value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className='text-sm font-medium text-gray-700 block mb-1.5'>Password</label>
              <input type='password' className='w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none' placeholder='••••••••' value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type='submit' disabled={loading} className='w-full bg-black text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50'>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <div className='relative my-4'>
            <div className='absolute inset-0 flex items-center'><div className='w-full border-t border-gray-200'></div></div>
            <div className='relative flex justify-center text-xs'><span className='px-2 bg-white text-gray-400'>or</span></div>
          </div>
          <a href={googleUrl} className='w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50'>
            <svg width='18' height='18' viewBox='0 0 18 18'><path fill='#4285F4' d='M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z'/><path fill='#34A853' d='M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z'/><path fill='#FBBC05' d='M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z'/><path fill='#EA4335' d='M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.31z'/></svg>
            Continue with Google
          </a>
        </div>
        <p className='text-center text-sm text-gray-500 mt-6'>Don't have an account? <Link to='/register' className='text-gray-900 font-medium hover:underline'>Sign up</Link></p>
      </div>
    </div>
  )
}