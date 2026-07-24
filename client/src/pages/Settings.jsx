import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { User, Bell, Lock, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import Sidebar from '../components/Sidebar'
import api from '../lib/api'
import useAuthStore from '../store/auth.store'

export default function Settings() {
  const { user, fetchMe } = useAuthStore()

  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [timezone, setTimezone] = useState('UTC')

  const [emailNotifications, setEmailNotifications] = useState(true)
  const [inAppNotifications, setInAppNotifications] = useState(true)
  const [defaultView, setDefaultView] = useState('kanban')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '')
      setAvatarUrl(user.avatar_url || '')
      setTimezone(user.timezone || 'UTC')
      setEmailNotifications(user.preferences?.email_notifications ?? true)
      setInAppNotifications(user.preferences?.in_app_notifications ?? true)
      setDefaultView(user.preferences?.default_project_view || 'kanban')
    }
  }, [user])

  const profileMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/auth/me', { full_name: fullName, avatar_url: avatarUrl, timezone })
    },
    onSuccess: () => { toast.success('Profile updated'); fetchMe() },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update profile'),
  })

  const preferencesMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/auth/preferences', {
        email_notifications: emailNotifications,
        in_app_notifications: inAppNotifications,
        default_project_view: defaultView,
      })
    },
    onSuccess: () => { toast.success('Preferences saved'); fetchMe() },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save preferences'),
  })

  const passwordMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
    },
    onSuccess: () => {
      toast.success('Password updated')
      setCurrentPassword('')
      setNewPassword('')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update password'),
  })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-56 flex-1 p-8 max-w-3xl">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500 mb-8">Manage your profile, notifications, and security</p>

        {/* Profile */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <User size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Profile</h2>
          </div>

          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg font-semibold flex-shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                fullName?.charAt(0).toUpperCase() || '?'
              )}
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Avatar URL</label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400"
                placeholder="https://..."
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Full name</label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
                value={user?.email || ''}
                disabled
              />
            </div>
          </div>

          <div className="mb-5">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Timezone</label>
            <input
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400"
              placeholder="UTC"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
            />
          </div>

          <button
            onClick={() => profileMutation.mutate()}
            disabled={!fullName.trim() || profileMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <Save size={14} />
            {profileMutation.isPending ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <Bell size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Notifications</h2>
          </div>

          <div className="space-y-4 mb-5">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-sm text-gray-900">Email notifications</div>
                <div className="text-xs text-gray-400">Get emailed when something needs your attention</div>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-black"
                checked={emailNotifications}
                onChange={e => setEmailNotifications(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-sm text-gray-900">In-app notifications</div>
                <div className="text-xs text-gray-400">Show notifications in the bell icon</div>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-black"
                checked={inAppNotifications}
                onChange={e => setInAppNotifications(e.target.checked)}
              />
            </label>
          </div>

          <div className="mb-5">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Default project view</label>
            <select
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white"
              value={defaultView}
              onChange={e => setDefaultView(e.target.value)}
            >
              <option value="kanban">Kanban</option>
              <option value="list">List</option>
            </select>
          </div>

          <button
            onClick={() => preferencesMutation.mutate()}
            disabled={preferencesMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <Save size={14} />
            {preferencesMutation.isPending ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>

        {/* Security */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Lock size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Security</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Current password</label>
              <input
                type="password"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">New password</label>
              <input
                type="password"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={() => passwordMutation.mutate()}
            disabled={!currentPassword || newPassword.length < 8 || passwordMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <Save size={14} />
            {passwordMutation.isPending ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
