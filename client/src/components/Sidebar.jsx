import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/auth.store'
import api from '../lib/api'
import {
  LayoutDashboard, Bell, FolderKanban, CheckSquare,
  Users, Calendar, HelpCircle, Settings, LogOut
} from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', path: '/' },
  { icon: Bell, label: 'Notifications', path: '/notifications', badge: true },
  { icon: FolderKanban, label: 'Projects', path: '/' },
  { icon: CheckSquare, label: 'Tickets', path: '/tickets' },
  { icon: Users, label: 'Team Members', path: '/team' },
  { icon: Calendar, label: 'Calendar', path: '/calendar' },
]

const bottomItems = [
  { icon: HelpCircle, label: 'Help & Support', path: '/help' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count')
      return res.data.count
    },
    refetchInterval: 30000,
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col fixed left-0 top-0 bottom-0">
      {/* Logo */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">T</span>
          </div>
          <span className="font-semibold text-gray-900 text-lg">Trackly</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-0.5">
          {navItems.map(({ icon: Icon, label, path, badge }) => {
            const active = location.pathname === path
            return (
              <li key={label}>
                <button
                  onClick={() => navigate(path)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    active
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="relative">
                    <Icon size={16} />
                    {badge && unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </span>
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-gray-100">
        <ul className="space-y-0.5 mb-3">
          {bottomItems.map(({ icon: Icon, label, path }) => (
            <li key={label}>
              <button
                onClick={() => navigate(path)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
              >
                <Icon size={16} />
                {label}
              </button>
            </li>
          ))}
        </ul>

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</div>
            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}