import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { Search, Filter, Plus, X, Users, Tag, Rocket, FileText, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import Sidebar from '../components/Sidebar'
import KanbanColumn from '../components/KanbanColumn'
import TicketCard from '../components/TicketCard'
import api from '../lib/api'
import MembersModal from '../components/MembersModal'
import LabelsModal from '../components/LabelsModal'
import SprintsModal from '../components/SprintsModal'
import ChatPanel from '../components/ChatPanel'

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
  const [showLabels, setShowLabels] = useState(false)
  const [showSprints, setShowSprints] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [selectedLabelIds, setSelectedLabelIds] = useState([])
  const [activeView, setActiveView] = useState('Board')

  const { data: projectLabels = [] } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/labels`)
      return res.data
    }
  })

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
      setSelectedLabelIds([])
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/projects/${projectId}/docs`)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <FileText size={15} />
                Docs
              </button>
              <button
                onClick={() => setShowChat(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <MessageSquare size={15} />
                AI Chat
              </button>
              <button
                onClick={() => setShowSprints(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Rocket size={15} />
                Sprints
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {['List', 'Board', 'Timeline', 'Calendar'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveView(tab)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    tab === activeView
                      ? 'text-gray-900 font-medium border-b-2 border-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
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
          <div className="flex-1 p-6 overflow-x-auto overflow-y-auto">
            {activeView === 'List' && (
              <TicketListView tickets={filteredTickets} projectId={projectId} navigate={navigate} />
            )}

            {activeView === 'Calendar' && (
              <TicketCalendarView tickets={filteredTickets} projectId={projectId} navigate={navigate} />
            )}

            {activeView === 'Timeline' && (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                Timeline view is coming soon
              </div>
            )}

            {activeView === 'Board' && (
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
            )}
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
    onClick={() => setShowLabels(true)}
    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
  >
    <Tag size={15} />
    Labels
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

              {projectLabels.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Labels</label>
                  <div className="flex flex-wrap gap-1.5">
                    {projectLabels.map(label => {
                      const selected = selectedLabelIds.includes(label.id)
                      return (
                        <button
                          key={label.id}
                          type="button"
                          onClick={() => setSelectedLabelIds(prev =>
                            selected ? prev.filter(id => id !== label.id) : [...prev, label.id]
                          )}
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            selected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: label.color_hex }} />
                          {label.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => { setShowNewTicket(false); setSimilar([]); setTitle(''); setSelectedLabelIds([]) }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate({ title, description, priority, type, label_ids: selectedLabelIds })}
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
      {showLabels && (
  <LabelsModal
    projectId={projectId}
    onClose={() => setShowLabels(false)}
  />
)}
      {showSprints && (
  <SprintsModal
    projectId={projectId}
    onClose={() => setShowSprints(false)}
  />
)}
      {showChat && (
  <ChatPanel
    projectId={projectId}
    onClose={() => setShowChat(false)}
  />
)}
    </div>
  )
}

const PRIORITY_STYLES = {
  p0: 'bg-red-50 text-red-600 border border-red-200',
  p1: 'bg-orange-50 text-orange-600 border border-orange-200',
  p2: 'bg-blue-50 text-blue-600 border border-blue-200',
  p3: 'bg-gray-100 text-gray-500 border border-gray-200',
}

const STATUS_STYLES = {
  open: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-50 text-blue-600',
  in_review: 'bg-yellow-50 text-yellow-600',
  done: 'bg-green-50 text-green-600',
  cancelled: 'bg-red-50 text-red-600',
}

function TicketListView({ tickets, projectId, navigate }) {
  if (!tickets.length) {
    return <div className="text-center text-sm text-gray-400 py-12">No tickets match your filters</div>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {tickets.map((t, i) => (
        <div
          key={t.id}
          onClick={() => navigate(`/projects/${projectId}/tickets/${t.ticket_key}`)}
          className={`flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${i !== 0 ? 'border-t border-gray-100' : ''}`}
        >
          <span className="text-xs text-gray-400 font-mono w-16 flex-shrink-0">{t.ticket_key}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLES[t.status]}`}>
            {t.status?.replace('_', ' ')}
          </span>
          <span className="text-sm text-gray-900 flex-1 truncate">{t.title}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">{t.type}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PRIORITY_STYLES[t.priority]}`}>
            {t.priority?.toUpperCase()}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0 w-20 text-right">
            {t.assignee_name || 'Unassigned'}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0 w-16 text-right">
            {t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

function TicketCalendarView({ tickets, projectId, navigate }) {
  const [cursor, setCursor] = useState(() => new Date())

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const byDay = {}
  tickets.forEach(t => {
    if (!t.due_date) return
    const d = new Date(t.due_date)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      byDay[day] = byDay[day] || []
      byDay[day].push(t)
    }
  })

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)

  const undated = tickets.filter(t => !t.due_date)
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const today = new Date()
  const isToday = (day) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="px-2 py-1 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
          >
            ←
          </button>
          <span className="text-sm font-medium text-gray-900 w-36 text-center">{monthLabel}</span>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="px-2 py-1 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
          >
            →
          </button>
        </div>
        <button
          onClick={() => setCursor(new Date())}
          className="text-xs text-gray-500 hover:text-gray-800"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-xl overflow-hidden mb-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="bg-gray-50 text-center text-xs font-medium text-gray-400 py-2">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className="bg-white min-h-[90px] p-1.5 align-top">
            {day && (
              <>
                <div className={`text-xs mb-1 inline-flex items-center justify-center w-5 h-5 rounded-full ${
                  isToday(day) ? 'bg-black text-white font-medium' : 'text-gray-400'
                }`}>
                  {day}
                </div>
                <div className="space-y-1">
                  {(byDay[day] || []).slice(0, 3).map(t => (
                    <div
                      key={t.id}
                      onClick={() => navigate(`/projects/${projectId}/tickets/${t.ticket_key}`)}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer ${PRIORITY_STYLES[t.priority]}`}
                      title={t.title}
                    >
                      {t.ticket_key} {t.title}
                    </div>
                  ))}
                  {(byDay[day] || []).length > 3 && (
                    <div className="text-[10px] text-gray-400">+{byDay[day].length - 3} more</div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {undated.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">No due date</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {undated.map((t, i) => (
              <div
                key={t.id}
                onClick={() => navigate(`/projects/${projectId}/tickets/${t.ticket_key}`)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${i !== 0 ? 'border-t border-gray-100' : ''}`}
              >
                <span className="text-xs text-gray-400 font-mono w-16 flex-shrink-0">{t.ticket_key}</span>
                <span className="text-sm text-gray-700 flex-1 truncate">{t.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[t.priority]}`}>
                  {t.priority?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}