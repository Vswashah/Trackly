import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban, Plus, TrendingUp, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import api from '../lib/api'

const PROJECT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function Dashboard() {
  const navigate = useNavigate()

  const { data: tickets } = useQuery({
    queryKey: ['tickets', PROJECT_ID],
    queryFn: async () => {
      const res = await api.get(`/projects/${PROJECT_ID}/tickets?limit=100`)
      return res.data.tickets
    }
  })

  const stats = {
    total: tickets?.length || 0,
    open: tickets?.filter(t => t.status === 'open').length || 0,
    inProgress: tickets?.filter(t => t.status === 'in_progress').length || 0,
    done: tickets?.filter(t => t.status === 'done').length || 0,
    critical: tickets?.filter(t => t.priority === 'p0').length || 0,
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-56 flex-1 p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
            <p className="text-sm text-gray-500 mt-1">Welcome back — here's what's happening</p>
          </div>
          <button
            onClick={() => navigate(`/projects/${PROJECT_ID}`)}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus size={16} />
            New Ticket
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Tickets', value: stats.total, icon: FolderKanban, color: 'bg-blue-50 text-blue-600' },
            { label: 'Open', value: stats.open, icon: Clock, color: 'bg-orange-50 text-orange-600' },
            { label: 'In Progress', value: stats.inProgress, icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
            { label: 'Done', value: stats.done, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">{label}</span>
                <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
                  <Icon size={15} />
                </div>
              </div>
              <div className="text-3xl font-semibold text-gray-900">{value}</div>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Projects</h2>
          <div className="grid grid-cols-3 gap-4">
            <div
              className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all"
              onClick={() => navigate(`/projects/${PROJECT_ID}`)}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  T
                </div>
                <div>
                  <div className="font-medium text-gray-900 text-sm">Trackly App</div>
                  <div className="text-xs text-gray-500">trackly-app</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{stats.total} tickets</span>
                <span>{stats.open} open</span>
                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
              </div>
            </div>

            {/* Add project placeholder */}
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-5 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors group">
              <div className="text-center">
                <div className="w-9 h-9 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center mx-auto mb-2 group-hover:border-gray-400">
                  <Plus size={16} className="text-gray-400" />
                </div>
                <span className="text-sm text-gray-400 group-hover:text-gray-500">New Project</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent tickets */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Tickets</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {tickets?.slice(0, 5).map((ticket, i) => (
              <div
                key={ticket.id}
                className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors ${i !== 0 ? 'border-t border-gray-100' : ''}`}
                onClick={() => navigate(`/projects/${PROJECT_ID}/tickets/${ticket.ticket_key}`)}
              >
                <span className="text-xs text-gray-400 font-mono w-20 flex-shrink-0">{ticket.ticket_key}</span>
                <span className="text-sm text-gray-900 flex-1 truncate">{ticket.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  ticket.priority === 'p0' ? 'bg-red-50 text-red-600' :
                  ticket.priority === 'p1' ? 'bg-orange-50 text-orange-600' :
                  ticket.priority === 'p2' ? 'bg-blue-50 text-blue-600' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {ticket.priority?.toUpperCase()}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  ticket.status === 'open' ? 'bg-gray-100 text-gray-600' :
                  ticket.status === 'in_progress' ? 'bg-blue-50 text-blue-600' :
                  ticket.status === 'done' ? 'bg-green-50 text-green-600' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {ticket.status?.replace('_', ' ')}
                </span>
              </div>
            ))}
            {!tickets?.length && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No tickets yet — create your first one
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}