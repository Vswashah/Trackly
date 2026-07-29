import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Play, CheckCircle2, ChevronDown, ChevronRight, Rocket } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

const STATUS_BADGE = {
  planned: 'bg-gray-100 text-gray-500',
  active: 'bg-blue-50 text-blue-600',
  completed: 'bg-green-50 text-green-600',
}

export default function SprintsModal({ projectId, onClose }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const queryClient = useQueryClient()

  const { data: sprints, isLoading } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/sprints`)).data,
  })

  const { data: allTickets = [] } = useQuery({
    queryKey: ['tickets', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/tickets?limit=100`)).data.tickets,
  })

  const { data: sprintTickets } = useQuery({
    queryKey: ['sprint-tickets', expandedId],
    queryFn: async () => (await api.get(`/projects/${projectId}/sprints/${expandedId}/tickets`)).data,
    enabled: !!expandedId,
  })

  const createMutation = useMutation({
    mutationFn: async () => (await api.post(`/projects/${projectId}/sprints`, {
      name, goal, start_date: startDate || null, end_date: endDate || null,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries(['sprints', projectId])
      setShowForm(false)
      setName(''); setGoal(''); setStartDate(''); setEndDate('')
      toast.success('Sprint created')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create sprint'),
  })

  const startMutation = useMutation({
    mutationFn: async (sprintId) => api.patch(`/projects/${projectId}/sprints/${sprintId}/start`),
    onSuccess: () => { queryClient.invalidateQueries(['sprints', projectId]); toast.success('Sprint started') },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to start sprint'),
  })

  const completeMutation = useMutation({
    mutationFn: async (sprintId) => api.patch(`/projects/${projectId}/sprints/${sprintId}/complete`),
    onSuccess: () => { queryClient.invalidateQueries(['sprints', projectId]); toast.success('Sprint completed') },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to complete sprint'),
  })

  const addTicketMutation = useMutation({
    mutationFn: async ({ sprintId, ticketId }) => api.post(`/projects/${projectId}/sprints/${sprintId}/tickets`, { ticket_id: ticketId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['sprint-tickets', expandedId])
      queryClient.invalidateQueries(['sprints', projectId])
    },
    onError: () => toast.error('Failed to add ticket'),
  })

  const removeTicketMutation = useMutation({
    mutationFn: async ({ sprintId, ticketId }) => api.delete(`/projects/${projectId}/sprints/${sprintId}/tickets/${ticketId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['sprint-tickets', expandedId])
      queryClient.invalidateQueries(['sprints', projectId])
    },
    onError: () => toast.error('Failed to remove ticket'),
  })

  const sprintTicketIds = new Set((sprintTickets || []).map(t => t.id))

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">Sprints</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              <Plus size={14} />
              New
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto">
          {showForm && (
            <div className="mb-5 p-4 bg-gray-50 rounded-xl space-y-3">
              <input
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400"
                placeholder="Sprint name (e.g. Sprint 1)"
                value={name}
                autoFocus
                onChange={e => setName(e.target.value)}
              />
              <input
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400"
                placeholder="Goal (optional)"
                value={goal}
                onChange={e => setGoal(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
                <input
                  type="date"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!name.trim() || createMutation.isPending}
                className="w-full px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Sprint'}
              </button>
            </div>
          )}

          {isLoading && <p className="text-sm text-gray-400">Loading...</p>}

          {!isLoading && !sprints?.length && (
            <p className="text-sm text-gray-400 text-center py-8 flex flex-col items-center gap-2">
              <Rocket size={20} className="text-gray-300" />
              No sprints yet
            </p>
          )}

          <div className="space-y-2">
            {sprints?.map(sprint => {
              const expanded = expandedId === sprint.id
              return (
                <div key={sprint.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expanded ? null : sprint.id)}
                    className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 text-left"
                  >
                    {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                    <span className="text-sm font-medium text-gray-900 flex-1">{sprint.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[sprint.status]}`}>
                      {sprint.status}
                    </span>
                    <span className="text-xs text-gray-400">{sprint.ticket_count} tickets</span>
                  </button>

                  {expanded && (
                    <div className="p-3 border-t border-gray-100 bg-gray-50">
                      {sprint.goal && <p className="text-xs text-gray-500 mb-3">{sprint.goal}</p>}

                      <div className="flex items-center gap-2 mb-3">
                        {sprint.status === 'planned' && (
                          <button
                            onClick={() => startMutation.mutate(sprint.id)}
                            disabled={startMutation.isPending}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Play size={11} />
                            Start Sprint
                          </button>
                        )}
                        {sprint.status === 'active' && (
                          <button
                            onClick={() => completeMutation.mutate(sprint.id)}
                            disabled={completeMutation.isPending}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle2 size={11} />
                            Complete Sprint
                          </button>
                        )}
                      </div>

                      <div className="space-y-1 mb-3">
                        {sprintTickets?.map(t => (
                          <div key={t.id} className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg text-xs">
                            <span className="font-mono text-gray-400">{t.ticket_key}</span>
                            <span className="flex-1 truncate text-gray-700">{t.title}</span>
                            <button
                              onClick={() => removeTicketMutation.mutate({ sprintId: sprint.id, ticketId: t.id })}
                              className="text-gray-300 hover:text-red-500"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                        {sprintTickets && !sprintTickets.length && (
                          <p className="text-xs text-gray-400">No tickets in this sprint yet</p>
                        )}
                      </div>

                      <select
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none bg-white"
                        value=""
                        onChange={e => {
                          if (e.target.value) addTicketMutation.mutate({ sprintId: sprint.id, ticketId: e.target.value })
                        }}
                      >
                        <option value="">+ Add ticket to sprint...</option>
                        {allTickets
                          .filter(t => !sprintTicketIds.has(t.id))
                          .map(t => (
                            <option key={t.id} value={t.id}>{t.ticket_key} — {t.title}</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
