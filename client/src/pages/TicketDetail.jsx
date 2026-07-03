import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Sparkles, Bot, Send, Clock, User, Tag, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import Sidebar from '../components/Sidebar'
import api from '../lib/api'

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

export default function TicketDetail() {
  const { projectId, ticketKey } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [hints, setHints] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loadingHints, setLoadingHints] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [activeAI, setActiveAI] = useState(null)

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketKey],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/tickets/${ticketKey}`)
      return res.data
    }
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/members`)
      return res.data
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      await api.patch(`/projects/${projectId}/tickets/${ticketKey}`, updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket', ticketKey])
      queryClient.invalidateQueries(['tickets', projectId])
      toast.success('Updated')
    },
  })

  const commentMutation = useMutation({
    mutationFn: async (body) => {
      await api.post(`/tickets/${ticket.id}/comments`, { body })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket', ticketKey])
      setComment('')
      toast.success('Comment added')
    },
  })

  const getSummary = async () => {
    setLoadingSummary(true)
    setActiveAI('summary')
    try {
      const res = await api.post(`/ai/summarize/${ticketKey}`)
      setSummary(res.data.summary)
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI unavailable')
      setActiveAI(null)
    } finally {
      setLoadingSummary(false)
    }
  }

  const getHints = async () => {
    setLoadingHints(true)
    setActiveAI('hints')
    try {
      const res = await api.get(`/ai/hints/${ticketKey}`)
      setHints(res.data.hints)
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI unavailable')
      setActiveAI(null)
    } finally {
      setLoadingHints(false)
    }
  }

  if (isLoading) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-56 flex-1 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading ticket...</div>
      </div>
    </div>
  )

  if (!ticket) return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-56 flex-1 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Ticket not found</div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-56 flex-1 flex flex-col">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-sm text-gray-400">/</span>
          <span className="text-sm text-gray-500 font-mono">{ticket.ticket_key}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[ticket.status]}`}>
            {ticket.status?.replace('_', ' ')}
          </span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* Title */}
            <h1 className="text-xl font-semibold text-gray-900 mb-2 leading-snug">
              {ticket.title}
            </h1>

            {/* Badges */}
            <div className="flex items-center gap-2 mb-6">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[ticket.priority]}`}>
                {ticket.priority?.toUpperCase()}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                {ticket.type}
              </span>
              {ticket.has_embedding && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
                  ✓ AI ready
                </span>
              )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Description</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                {ticket.description || 'No description provided.'}
              </p>
            </div>

            {/* AI Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">AI Features</h3>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={getSummary}
                  disabled={loadingSummary}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  <Sparkles size={14} className="text-amber-500" />
                  {loadingSummary ? 'Summarizing...' : 'Summarize'}
                </button>
                <button
                  onClick={getHints}
                  disabled={loadingHints || !ticket.has_embedding}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  <Bot size={14} className="text-blue-500" />
                  {loadingHints ? 'Thinking...' : !ticket.has_embedding ? 'Embedding pending...' : 'Get AI Hints'}
                </button>
              </div>

              {/* AI Output */}
              {activeAI === 'summary' && summary && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles size={13} className="text-amber-600" />
                    <span className="text-xs font-medium text-amber-700">Summary</span>
                  </div>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{summary}</pre>
                </div>
              )}

              {activeAI === 'hints' && hints && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Bot size={13} className="text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">Resolution Hints</span>
                  </div>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{hints}</pre>
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
                Comments ({ticket.comments?.length || 0})
              </h3>

              <div className="space-y-4 mb-4">
                {ticket.comments?.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {c.author_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{c.author_name}</span>
                        {c.is_edited && <span className="text-xs text-gray-400">(edited)</span>}
                        <span className="text-xs text-gray-400">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{c.body}</p>
                    </div>
                  </div>
                ))}

                {!ticket.comments?.length && (
                  <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>
                )}
              </div>

              {/* Comment input */}
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                  V
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 transition-colors"
                    placeholder="Add a comment..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && comment.trim()) {
                        commentMutation.mutate(comment)
                      }
                    }}
                  />
                  <button
                    onClick={() => commentMutation.mutate(comment)}
                    disabled={!comment.trim() || commentMutation.isPending}
                    className="px-3 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Activity */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">Activity</h3>
              <div className="space-y-2">
                {ticket.history?.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-500 py-1 border-b border-gray-50 last:border-0">
                    <Clock size={11} className="mt-0.5 flex-shrink-0 text-gray-300" />
                    <span>
                      <span className="font-medium text-gray-700">{h.actor_name}</span>
                      {h.field_name === 'created'
                        ? ' created this ticket'
                        : ` changed ${h.field_name} to "${h.new_value}"`
                      }
                    </span>
                    <span className="ml-auto flex-shrink-0 text-gray-300">
                      {new Date(h.changed_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-60 bg-white border-l border-gray-200 p-5 overflow-y-auto flex-shrink-0">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">Details</h3>

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Status</label>
                <select
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white"
                  value={ticket.status}
                  onChange={e => updateMutation.mutate({ status: e.target.value })}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Priority</label>
                <select
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white"
                  value={ticket.priority}
                  onChange={e => updateMutation.mutate({ priority: e.target.value })}
                >
                  <option value="p0">P0 — Critical</option>
                  <option value="p1">P1 — High</option>
                  <option value="p2">P2 — Medium</option>
                  <option value="p3">P3 — Low</option>
                </select>
              </div>

              <hr className="border-gray-100" />

              {/* Type */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Tag size={12} />
                  Type
                </div>
                <span className="text-xs text-gray-700 font-medium">{ticket.type}</span>
              </div>

              {/* Reporter */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <User size={12} />
                  Reporter
                </div>
                <span className="text-xs text-gray-700 font-medium">{ticket.reporter_name}</span>
              </div>

              {/* Assignee */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Assignee</label>
                <select
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white"
                  value={ticket.assignee_id || ''}
                  onChange={e => updateMutation.mutate({ assignee_id: e.target.value || null })}
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Due date */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Due date</label>
                <input
                  type="date"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-white"
                  value={ticket.due_date ? ticket.due_date.slice(0, 10) : ''}
                  onChange={e => updateMutation.mutate({ due_date: e.target.value || null })}
                />
              </div>

              {/* Created */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Calendar size={12} />
                  Created
                </div>
                <span className="text-xs text-gray-700">
                  {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>

              <hr className="border-gray-100" />

              {/* AI Embedding */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">AI Embedding</label>
                <div className={`text-xs px-2 py-1 rounded-lg font-medium inline-block ${
                  ticket.has_embedding
                    ? 'bg-green-50 text-green-600'
                    : 'bg-yellow-50 text-yellow-600'
                }`}>
                  {ticket.has_embedding ? '✅ Ready for AI' : '⏳ Processing...'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}