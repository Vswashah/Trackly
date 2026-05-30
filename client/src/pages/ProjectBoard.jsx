import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { Search, Filter, Plus, X, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import Sidebar from '../components/Sidebar'
import KanbanColumn from '../components/KanbanColumn'
import TicketCard from '../components/TicketCard'
import api from '../lib/api'
import MembersModal from '../components/MembersModal'

const STATUSES = [
  { code: 'open', label: 'Todo', color: '#6B7280', bg: 'bg-gray-100' },
  { code: 'in_progress', label: 'In Progress', color: '#3B82F6', bg: 'bg-blue-100' },
  { code: 'in_review', label: 'In Review', color: '#F59E0B', bg: 'bg-yellow-100' },
  { code: 'done', label: 'Done', color: '#10B981', bg: 'bg-green-100' },
]

export default function ProjectBoard() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterType, setFilterType] = useState('') 
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('p2')
  const [type, setType] = useState('task')
  const [similar, setSimilar] = useState([])
  const [checkingDupe, setCheckingDupe] = useState(false)
  const [activeTicket, setActiveTicket] = useState(null)
  const [showMembers, setShowMembers] = useState(false)

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/tickets?limit=100`)
      return res.data.tickets
    }
  })

  const createMutation = useMutation({
    mutationFn: async (ticket) => {
      const res = await api.post(`/projects/${projectId}/tickets`, ticket)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tickets', projectId])
      toast.success('Ticket created!')
      setShowNewTicket(false)
      setTitle('')
      setDescription('')
      setSimilar([])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketKey, status }) => {
      await api.patch(`/projects/${projectId}/tickets/${ticketKey}`, { status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tickets', projectId])
    },
    onError: () => toast.error('Failed to update status'),
  })

  const checkSimilar = async (text) => {
    if (text.length < 10) { setSimilar([]); return }
    setCheckingDupe(true)
    try {
      const res = await api.post('/ai/similar', { text, project_id: projectId })
      setSimilar(res.data.similar || [])
    } catch { setSimilar([]) }
    finally { setCheckingDupe(false) }
  }

  const handleDragStart = (event) => {
    setActiveTicket(event.active.data.current.ticket)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveTicket(null)

    if (!over) return

    const ticket = active.data.current.ticket
    const newStatus = over.id

    if (ticket.status === newStatus) return

    // Optimistic update
    queryClient.setQueryData(['tickets', projectId], (old) => {
      if (!old) return old
      return old.map(t =>
        t.id === ticket.id ? { ...t, status: newStatus } : t
      )
    })

    updateStatusMutation.mutate({
      ticketKey: ticket.ticket_key,
      status: newStatus,
    })
  }

  const filteredTickets = tickets.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase())
    const matchPriority = !filterPriority || t.priority === filterPriority
    const matchType = !filterType || t.type === filterType
    return matchSearch && matchPriority && matchType
  })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-56 flex-1 flex flex-col">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Tickets</h1>
            <button
              onClick={() => setShowNewTicket(true)}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus size={15} />
              New
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {['List', 'Board', 'Timeline', 'Calendar'].map((tab) => (
                <button key={tab} className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  tab === 'Board'
                    ? 'text-gray-900 font-medium border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 w-48"
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                  showFilter ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Filter size={14} />
                Filters
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Board */}
          <div className="flex-1 p-6 overflow-x-auto">
            <DndContext
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 min-w-max">
                {STATUSES.map(status => (
                  <KanbanColumn
                    key={status.code}
                    status={status}
                    tickets={filteredTickets.filter(t => t.status === status.code)}
                    onNewTicket={() => setShowNewTicket(true)}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeTicket ? (
                  <div className="rotate-2 opacity-90">
                    <TicketCard ticket={activeTicket} index={0} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* Filter Panel */}
          {showFilter && (
            <div className="w-64 bg-white border-l border-gray-200 p-5 overflow-y-auto flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-gray-900 text-sm">Filter By</span>
                <button onClick={() => setShowFilter(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>

              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</span>
                  {filterPriority && (
                    <button onClick={() => setFilterPriority('')} className="text-xs text-blue-600">Clear</button>
                  )}
                </div>
                {[
                  { value: 'p0', label: 'Critical' },
                  { value: 'p1', label: 'High' },
                  { value: 'p2', label: 'Medium' },
                  { value: 'p3', label: 'Low' },
                ].map(p => (
                  <label
                    key={p.value}
                    className="flex items-center gap-2 py-1.5 cursor-pointer group"
                    onClick={() => setFilterPriority(p.value)}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                      filterPriority === p.value
                        ? 'border-gray-900 bg-gray-900'
                        : 'border-gray-300 group-hover:border-gray-400'
                    }`}>
                      {filterPriority === p.value && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                      )}
                    </div>
                    <span className="text-sm text-gray-700">{p.label}</span>
                  </label>
                ))}
              </div>

              <div className="mb-5">
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type</span>
    {filterType && (
      <button onClick={() => setFilterType('')} className="text-xs text-blue-600">Clear</button>
    )}
  </div>
  {['Bug', 'Feature', 'Task', 'Chore'].map(t => (
    <label
      key={t}
      className="flex items-center gap-2 py-1.5 cursor-pointer group"
      onClick={() => setFilterType(t.toLowerCase())}
    >
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
        filterType === t.toLowerCase()
          ? 'border-gray-900 bg-gray-900'
          : 'border-gray-300 group-hover:border-gray-400'
      }`}>
        {filterType === t.toLowerCase() && (
          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
        )}
      </div>
      <span className="text-sm text-gray-700">{t}</span>
    </label>
  ))}
</div>
            </div>
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">New Ticket</h2>
              <div className="flex items-center gap-2">
  <button
    onClick={() => setShowMembers(true)}
    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
  >
    <Users size={15} />
    Members
  </button>
  <button
    onClick={() => setShowNewTicket(true)}
    className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
  >
    <Plus size={15} />
    New
  </button>
</div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
                <input
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-colors"
                  placeholder="What needs to be done?"
                  value={title}
                  autoFocus
                  onChange={e => {
                    setTitle(e.target.value)
                    clearTimeout(window._dupeTimer)
                    window._dupeTimer = setTimeout(() => checkSimilar(e.target.value), 500)
                  }}
                />
              </div>

              {checkingDupe && <p className="text-xs text-gray-400">Checking for duplicates...</p>}
              {similar.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-700 mb-2">⚠️ Similar tickets found</p>
                  {similar.map(t => (
                    <div key={t.ticket_key} className="flex items-center gap-2 text-xs text-amber-600 mb-1">
                      <span className="font-mono font-medium">{t.ticket_key}</span>
                      <span className="flex-1 truncate">{t.title}</span>
                      <span className="font-medium">{Math.round(t.similarity * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
                <textarea
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 resize-none transition-colors"
                  placeholder="Add more details..."
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Priority</label>
                  <select
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white"
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                  >
                    <option value="p0">P0 — Critical</option>
                    <option value="p1">P1 — High</option>
                    <option value="p2">P2 — Medium</option>
                    <option value="p3">P3 — Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Type</label>
                  <select
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white"
                    value={type}
                    onChange={e => setType(e.target.value)}
                  >
                    <option value="bug">Bug</option>
                    <option value="feature">Feature</option>
                    <option value="task">Task</option>
                    <option value="chore">Chore</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => { setShowNewTicket(false); setSimilar([]); setTitle('') }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate({ title, description, priority, type })}
                disabled={!title.trim() || createMutation.isPending}
                className="px-4 py-2 text-sm bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </div>
        
      )}
      {showMembers && (
  <MembersModal
    projectId={projectId}
    onClose={() => setShowMembers(false)}
  />
)}
    </div>
  )
}