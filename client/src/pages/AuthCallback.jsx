import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../store/auth.store'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { fetchMe } = useAuthStore()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      localStorage.setItem('access_token', token)
      fetchMe().then(() => navigate('/'))
    } else {
      navigate('/login?error=oauth_failed')
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-lg">T</span>
        </div>
        <p className="text-sm text-gray-500">Signing you in...</p>
      </div>
    </div>
  )
}