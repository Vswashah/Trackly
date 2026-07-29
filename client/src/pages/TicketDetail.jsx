import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Sparkles, Bot, Send, Clock, User, Tag, Calendar, Wand2, ThumbsUp, ThumbsDown, X, Plus, Paperclip, Download, Trash2, RotateCcw } from 'lucide-react'
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

const REVERTIBLE_FIELDS = ['title', 'description', 'status', 'priority', 'assignee_id', 'due_date', 'estimate_points', 'position', 'acceptance_criteria']

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
  const [summaryInteractionId, setSummaryInteractionId] = useState(null)
  const [hintsInteractionId, setHintsInteractionId] = useState(null)
  const [feedbackGiven, setFeedbackGiven] = useState({})
  const [suggestedPriority, setSuggestedPriority] = useState(null)
  const [loadingSuggest, setLoadingSuggest] = useState(false)
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(null)

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketKey],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/tickets/${ticketKey}`)
      return res.data
    }
  })

  useEffect(() => {
    if (ticket) setAcceptanceCriteria(ticket.acceptance_criteria || '')
  }, [ticket?.id])

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

  const { data: projectLabels = [] } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/labels`)
      return res.data
    }
  })

  const addLabelMutation = useMutation({
    mutationFn: async (labelId) => api.post(`/projects/${projectId}/tickets/${ticketKey}/labels`, { label_id: labelId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket', ticketKey])
      setShowLabelPicker(false)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add label'),
  })

  const removeLabelMutation = useMutation({
    mutationFn: async (labelId) => api.delete(`/projects/${projectId}/tickets/${ticketKey}/labels/${labelId}`),
    onSuccess: () => queryClient.invalidateQueries(['ticket', ticketKey]),
    onError: () => toast.error('Failed to remove label'),
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

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/tickets/${ticket.id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket', ticketKey])
      toast.success('File uploaded')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Upload failed'),
  })

  const revertMutation = useMutation({
    mutationFn: async (historyId) => api.patch(`/projects/${projectId}/tickets/${ticketKey}/history/${historyId}/revert`),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket', ticketKey])
      queryClient.invalidateQueries(['tickets', projectId])
      toast.success('Change reverted')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Could not revert this change'),
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId) => api.delete(`/tickets/${ticket.id}/attachments/${attachmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket', ticketKey])
      toast.success('Attachment removed')
    },
    onError: () => toast.error('Failed to remove attachment'),
  })

  const getSummary = async () => {
    setLoadingSummary(true)
    setActiveAI('summary')
    try {
      const res = await api.post(`/ai/summarize/${ticketKey}`)
      setSummary(res.data.summary)
      setSummaryInteractionId(res.data.interaction_id)
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
      setHintsInteractionId(res.data.interaction_id)
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI unavailable')
      setActiveAI(null)
    } finally {
      setLoadingHints(false)
    }
  }

  const getSuggestedPriority = async () => {
    if (!ticket) return
    setLoadingSuggest(true)
    try {
      const res = await api.post('/ai/suggest-priority', {
        title: ticket.title,
        description: ticket.description,
      })
      setSuggestedPriority(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI unavailable')
    } finally {
      setLoadingSuggest(false)
    }
  }

  const applySuggestedPriority = () => {
    if (!suggestedPriority) return
    updateMutation.mutate({ priority: suggestedPriority.priority })
    setSuggestedPriority(null)
  }

  const sendFeedback = async (interactionId, wasHelpful) => {
    if (!interactionId || feedbackGiven[interactionId]) return
    try {
      await api.post(`/ai/feedback/${interactionId}`, { was_helpful: wasHelpful })
      setFeedbackGiven(prev => ({ ...prev, [interactionId]: wasHelpful ? 'up' : 'down' }))
    } catch {
      toast.error('Failed to record feedback')
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

            {/* Acceptance Criteria (BDD / Gherkin) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Acceptance Criteria</h3>
                {acceptanceCriteria !== (ticket.acceptance_criteria || '') && (
                  <button
                    onClick={() => updateMutation.mutate({ acceptance_criteria: acceptanceCriteria })}
                    disabled={updateMutation.isPending}
                    className="text-xs px-2.5 py-1 bg-black text-white rounded-md font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    Save
                  </button>
                )}
              </div>
              <textarea
                className="w-full px-3 py-2.5 text-sm font-mono border border-gray-200 rounded-lg outline-none focus:border-gray-400 resize-y leading-relaxed"
                rows={5}
                placeholder={'Given <precondition>\nWhen <action>\nThen <expected outcome>'}
                value={acceptanceCriteria ?? ''}
                onChange={e => setAcceptanceCriteria(e.target.value)}
              />
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-amber-600" />
                      <span className="text-xs font-medium text-amber-700">Summary</span>
                    </div>
                    <FeedbackButtons
                      interactionId={summaryInteractionId}
                      given={feedbackGiven[summaryInteractionId]}
                      onFeedback={sendFeedback}
                    />
                  </div>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{summary}</pre>
                </div>
              )}

              {activeAI === 'hints' && hints && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Bot size={13} className="text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">Resolution Hints</span>
                    </div>
                    <FeedbackButtons
                      interactionId={hintsInteractionId}
                      given={feedbackGiven[hintsInteractionId]}
                      onFeedback={sendFeedback}
                    />
                  </div>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{hints}</pre>
                </div>
              )}
            </div>

            {/* Attachments */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Attachments ({ticket.attachments?.length || 0})
                </h3>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 cursor-pointer">
                  <Paperclip size={12} />
                  {uploadMutation.isPending ? 'Uploading...' : 'Add file'}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadMutation.isPending}
                    onChange={e => {
                      if (e.target.files[0]) uploadMutation.mutate(e.target.files[0])
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>

              <div className="space-y-2">
                {ticket.attachments?.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100">
                    <Paperclip size={14} className="text-gray-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 truncate">{a.file_name}</div>
                      <div className="text-xs text-gray-400">
                        {formatFileSize(a.file_size_bytes)} · {a.uploaded_by_name}
                      </div>
                    </div>
                    <a
                      href={a.storage_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-700"
                    >
                      <Download size={14} />
                    </a>
                    <button
                      onClick={() => deleteAttachmentMutation.mutate(a.id)}
                      className="text-gray-300 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {!ticket.attachments?.length && (
                  <p className="text-sm text-gray-400 text-center py-4">No files attached</p>
                )}
              </div>
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
              <div className="space-y-2.5">
                {ticket.history?.map(h => {
                  const revertible = REVERTIBLE_FIELDS.includes(h.field_name)
                  return (
                    <div key={h.id ?? `${h.field_name}-${h.changed_at}`} className="flex items-start gap-2 text-xs text-gray-500 py-1.5 border-b border-gray-50 last:border-0">
                      <Clock size={11} className="mt-0.5 flex-shrink-0 text-gray-300" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-x-1">
                          <span className="font-medium text-gray-700">{h.actor_name}</span>
                          {h.field_name === 'created' ? (
                            <span>created this ticket</span>
                          ) : h.change_type === 'comment_added' ? (
                            <span>added a comment</span>
                          ) : (
                            <>
                              <span>changed {h.field_name.replace('_', ' ')}</span>
                              {h.old_value && (
                                <>
                                  <span className="line-through text-gray-400 bg-red-50 px-1 rounded">{h.old_value}</span>
                                  <span className="text-gray-300">→</span>
                                </>
                              )}
                              <span className="text-gray-700 bg-green-50 px-1 rounded font-medium">{h.new_value || '—'}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {revertible && (
                        <button
                          onClick={() => revertMutation.mutate(h.id)}
                          disabled={revertMutation.isPending}
                          className="flex items-center gap-1 text-gray-400 hover:text-gray-800 flex-shrink-0 disabled:opacity-40"
                          title="Revert this change"
                        >
                          <RotateCcw size={11} />
                          Revert
                        </button>
                      )}
                      <span className="flex-shrink-0 text-gray-300">
                        {new Date(h.changed_at).toLocaleDateString()}
                      </span>
                    </div>
                  )
                })}
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400 block">Priority</label>
                  <button
                    onClick={getSuggestedPriority}
                    disabled={loadingSuggest}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                  >
                    <Wand2 size={11} />
                    {loadingSuggest ? 'Thinking...' : 'Suggest'}
                  </button>
                </div>
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

                {suggestedPriority && (
                  <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-indigo-700">
                        Suggested: {suggestedPriority.priority?.toUpperCase()}
                        {' '}({Math.round((suggestedPriority.confidence || 0) * 100)}%)
                      </span>
                    </div>
                    <p className="text-xs text-indigo-600 mb-2">{suggestedPriority.reason}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={applySuggestedPriority}
                        className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => setSuggestedPriority(null)}
                        className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
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

              {/* Labels */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-gray-400 block">Labels</label>
                  <button
                    onClick={() => setShowLabelPicker(v => !v)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
                  >
                    <Plus size={11} />
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ticket.labels?.map(label => (
                    <span
                      key={label.id}
                      className="flex items-center gap-1 text-xs pl-2 pr-1 py-0.5 rounded-full border border-gray-200 text-gray-600"
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: label.color_hex }} />
                      {label.name}
                      <button
                        onClick={() => removeLabelMutation.mutate(label.id)}
                        className="text-gray-300 hover:text-red-500"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  {!ticket.labels?.length && !showLabelPicker && (
                    <span className="text-xs text-gray-300">No labels</span>
                  )}
                </div>

                {showLabelPicker && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {projectLabels
                      .filter(l => !ticket.labels?.some(tl => tl.id === l.id))
                      .map(label => (
                        <button
                          key={label.id}
                          onClick={() => addLabelMutation.mutate(label.id)}
                          className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700"
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: label.color_hex }} />
                          {label.name}
                        </button>
                      ))}
                    {!projectLabels.filter(l => !ticket.labels?.some(tl => tl.id === l.id)).length && (
                      <span className="text-xs text-gray-300">No more labels in this project</span>
                    )}
                  </div>
                )}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <User size={12} />
                  Assignee
                </div>
                <span className="text-xs text-gray-700">{ticket.assignee_name || 'Unassigned'}</span>
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

function formatFileSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FeedbackButtons({ interactionId, given, onFeedback }) {
  if (!interactionId) return null
  if (given) {
    return <span className="text-xs text-gray-400">Thanks for the feedback!</span>
  }
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onFeedback(interactionId, true)}
        className="text-gray-400 hover:text-green-600 transition-colors"
        title="Helpful"
      >
        <ThumbsUp size={13} />
      </button>
      <button
        onClick={() => onFeedback(interactionId, false)}
        className="text-gray-400 hover:text-red-600 transition-colors"
        title="Not helpful"
      >
        <ThumbsDown size={13} />
      </button>
    </div>
  )
}