import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, MessageSquare, UserPlus, RefreshCw, AtSign, Clock, Bell } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import api from '../lib/api'

const TYPE_ICON = {
  assigned: UserPlus,
  mentioned: AtSign,
  commented: MessageSquare,
  status_changed: RefreshCw,
  due_soon: Clock,
}

const describe = (n) => {
  const actor = n.actor_name || 'Someone'
  switch (n.type) {
    case 'assigned': return `${actor} assigned you to ${n.ticket_key}`
    case 'mentioned': return `${actor} mentioned you in ${n.ticket_key}`
    case 'commented': return `${actor} commented on ${n.ticket_key}`
    case 'status_changed': return `${actor} changed status of ${n.ticket_key} to "${n.payload?.new_value?.replace('_', ' ')}"`
    case 'due_soon': return `${n.ticket_key} is due soon`
    default: return `Update on ${n.ticket_key || 'a ticket'}`
  }
}

const timeAgo = (iso) => {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Notifications() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications?limit=50')
      return res.data
    }
  })

  const notifications = data?.notifications || []

  const markReadMutation = useMutation({
    mutationFn: async (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications'])
      queryClient.invalidateQueries(['notifications-unread-count'])
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications'])
      queryClient.invalidateQueries(['notifications-unread-count'])
    },
  })

  const handleClick = (n) => {
    if (!n.is_read) markReadMutation.mutate(n.id)
    if (n.project_id && n.ticket_key) {
      navigate(`/projects/${n.project_id}/tickets/${n.ticket_key}`)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-56 flex-1 p-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500 mt-1">
              {unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <CheckCheck size={14} />
              Mark all as read
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Loading...</div>
          )}

          {!isLoading && !notifications.length && (
            <div className="px-5 py-12 text-center">
              <Bell size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No notifications yet</p>
            </div>
          )}

          {notifications.map((n, i) => {
            const Icon = TYPE_ICON[n.type] || Bell
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 ${
                  i !== 0 ? 'border-t border-gray-100' : ''
                } ${!n.is_read ? 'bg-blue-50/40' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  !n.is_read ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.is_read ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                    {describe(n)}
                  </p>
                  <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                </div>
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
