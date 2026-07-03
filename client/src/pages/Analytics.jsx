import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import Sidebar from '../components/Sidebar'
import api from '../lib/api'

const PIE_COLORS = ['#6B7280', '#9CA3AF', '#3B82F6', '#F59E0B', '#EF4444']

export default function Analytics() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/analytics`)
      return res.data
    },
  })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-56 flex-1 flex flex-col">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {isLoading ? (
            <div className="text-gray-400 text-sm">Loading analytics...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Opened vs Closed */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
                  Opened vs Closed (per week)
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data?.opened_vs_closed || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="opened" stroke="#3B82F6" strokeWidth={2} />
                    <Line type="monotone" dataKey="closed" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Priority Breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
                  Priority Breakdown
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={data?.priority_breakdown || []}
                      dataKey="count"
                      nameKey="priority"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {(data?.priority_breakdown || []).map((entry, i) => (
                        <Cell key={entry.priority} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Avg Resolution by Priority */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
                  Avg Resolution Time by Priority (hours)
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data?.avg_resolution_by_priority || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="priority" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="avg_hours" fill="#6B7280" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top Assignees */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
                  Top Assignees by Closed Tickets
                </h3>
                {data?.top_assignees?.length ? (
                  <div className="space-y-3">
                    {data.top_assignees.map((a) => (
                      <div key={a.assignee_name} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{a.assignee_name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 font-medium">
                          {a.closed_count} closed
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No closed tickets yet.</p>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
