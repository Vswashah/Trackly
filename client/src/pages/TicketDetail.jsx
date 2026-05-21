import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'

const PRIORITIES = { p0: '#EF4444', p1: '#F59E0B', p2: '#3B82F6', p3: '#6B7280' }
const PRIORITY_LABELS = { p0: 'Critical', p1: 'High', p2: 'Medium', p3: 'Low' }
const STATUS_COLORS = {
  open: '#6B7280', in_progress: '#3B82F6',
  in_review: '#F59E0B', done: '#10B981', cancelled: '#EF4444'
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

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketKey],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/tickets/${ticketKey}`)
      return res.data
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      await api.patch(`/projects/${projectId}/tickets/${ticketKey}`, updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket', ticketKey])
      toast.success('Ticket updated')
    },
    onError: () => toast.error('Failed to update'),
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
    onError: () => toast.error('Failed to add comment'),
  })

  const getHints = async () => {
    setLoadingHints(true)
    try {
      const res = await api.get(`/ai/hints/${ticketKey}`)
      setHints(res.data.hints)
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI unavailable')
    } finally {
      setLoadingHints(false)
    }
  }

  const getSummary = async () => {
    setLoadingSummary(true)
    try {
      const res = await api.post(`/ai/summarize/${ticketKey}`)
      setSummary(res.data.summary)
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI unavailable')
    } finally {
      setLoadingSummary(false)
    }
  }

  if (isLoading) return <div style={styles.loading}>Loading...</div>
  if (!ticket) return <div style={styles.loading}>Ticket not found</div>

  return (
    <div style={styles.container}>
      {/* Nav */}
      <div style={styles.nav}>
        <div style={styles.navLeft}>
          <span style={styles.navLogo} onClick={() => navigate('/')}>Trackly</span>
          <span style={styles.navSep}>/</span>
          <span style={styles.navLink} onClick={() => navigate(`/projects/${projectId}`)}>
            Board
          </span>
          <span style={styles.navSep}>/</span>
          <span style={styles.navCurrent}>{ticket.ticket_key}</span>
        </div>
      </div>

      <div style={styles.layout}>
        {/* Main content */}
        <div style={styles.main}>

          {/* Ticket header */}
          <div style={styles.ticketHeader}>
            <div style={styles.ticketMeta}>
              <span style={styles.ticketKey}>{ticket.ticket_key}</span>
              <span style={{
                ...styles.statusBadge,
                background: STATUS_COLORS[ticket.status] + '20',
                color: STATUS_COLORS[ticket.status],
              }}>
                {ticket.status?.replace('_', ' ')}
              </span>
              <span style={{
                ...styles.priorityBadge,
                background: PRIORITIES[ticket.priority] + '20',
                color: PRIORITIES[ticket.priority],
              }}>
                {PRIORITY_LABELS[ticket.priority]}
              </span>
            </div>
            <h1 style={styles.ticketTitle}>{ticket.title}</h1>
            <p style={styles.ticketDesc}>{ticket.description || 'No description provided.'}</p>
          </div>

          {/* AI Features */}
          <div style={styles.aiSection}>
            <div style={styles.aiButtons}>
              <button
                style={styles.aiBtn}
                onClick={getSummary}
                disabled={loadingSummary}
              >
                {loadingSummary ? '...' : '✨ Summarize'}
              </button>
              <button
                style={styles.aiBtn}
                onClick={getHints}
                disabled={loadingHints || !ticket.has_embedding}
              >
                {loadingHints ? '...' : ticket.has_embedding ? '🤖 Get AI Hints' : '⏳ Embedding...'}
              </button>
            </div>

            {summary && (
              <div style={styles.aiOutput}>
                <div style={styles.aiOutputTitle}>✨ Summary</div>
                <pre style={styles.aiOutputText}>{summary}</pre>
                <button style={styles.aiClose} onClick={() => setSummary(null)}>✕</button>
              </div>
            )}

            {hints && (
              <div style={styles.aiOutput}>
                <div style={styles.aiOutputTitle}>🤖 Resolution Hints</div>
                <pre style={styles.aiOutputText}>{hints}</pre>
                <button style={styles.aiClose} onClick={() => setHints(null)}>✕</button>
              </div>
            )}
          </div>

          {/* Comments */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Comments ({ticket.comments?.length || 0})</h3>

            {ticket.comments?.map(c => (
              <div key={c.id} style={styles.comment}>
                <div style={styles.commentAvatar}>
                  {c.author_name?.charAt(0).toUpperCase()}
                </div>
                <div style={styles.commentBody}>
                  <div style={styles.commentAuthor}>
                    {c.author_name}
                    {c.is_edited && <span style={styles.edited}> (edited)</span>}
                  </div>
                  <div style={styles.commentText}>{c.body}</div>
                </div>
              </div>
            ))}

            <div style={styles.commentForm}>
              <textarea
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
              />
              <button
                style={styles.commentBtn}
                onClick={() => commentMutation.mutate(comment)}
                disabled={!comment.trim() || commentMutation.isPending}
              >
                {commentMutation.isPending ? 'Posting...' : 'Comment'}
              </button>
            </div>
          </div>

          {/* History */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Activity</h3>
            {ticket.history?.map((h, i) => (
              <div key={i} style={styles.historyItem}>
                <span style={styles.historyActor}>{h.actor_name}</span>
                <span style={styles.historyText}>
                  {h.change_type === 'field_change' && h.field_name === 'created'
                    ? ' created this ticket'
                    : ` changed ${h.field_name} from "${h.old_value}" to "${h.new_value}"`
                  }
                </span>
                <span style={styles.historyTime}>
                  {new Date(h.changed_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sideSection}>
            <div style={styles.sideLabel}>Status</div>
            <select
              style={styles.sideSelect}
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

          <div style={styles.sideSection}>
            <div style={styles.sideLabel}>Priority</div>
            <select
              style={styles.sideSelect}
              value={ticket.priority}
              onChange={e => updateMutation.mutate({ priority: e.target.value })}
            >
              <option value="p0">P0 - Critical</option>
              <option value="p1">P1 - High</option>
              <option value="p2">P2 - Medium</option>
              <option value="p3">P3 - Low</option>
            </select>
          </div>

          <div style={styles.sideSection}>
            <div style={styles.sideLabel}>Type</div>
            <div style={styles.sideValue}>{ticket.type}</div>
          </div>

          <div style={styles.sideSection}>
            <div style={styles.sideLabel}>Reporter</div>
            <div style={styles.sideValue}>{ticket.reporter_name}</div>
          </div>

          <div style={styles.sideSection}>
            <div style={styles.sideLabel}>Assignee</div>
            <div style={styles.sideValue}>{ticket.assignee_name || 'Unassigned'}</div>
          </div>

          <div style={styles.sideSection}>
            <div style={styles.sideLabel}>Created</div>
            <div style={styles.sideValue}>
              {new Date(ticket.created_at).toLocaleDateString()}
            </div>
          </div>

          <div style={styles.sideSection}>
            <div style={styles.sideLabel}>AI Embedding</div>
            <div style={{
              ...styles.sideValue,
              color: ticket.has_embedding ? '#10B981' : '#F59E0B'
            }}>
              {ticket.has_embedding ? '✅ Ready' : '⏳ Pending'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#0d0f12' },
  loading: { color: '#8b90a0', padding: '40px', textAlign: 'center' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: '52px', background: '#13161b',
    borderBottom: '1px solid #252a33',
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
  navLogo: { color: '#e2e4e9', fontWeight: '700', fontSize: '16px', cursor: 'pointer' },
  navSep: { color: '#252a33', fontSize: '18px' },
  navLink: { color: '#8b90a0', fontSize: '14px', cursor: 'pointer' },
  navCurrent: { color: '#e2e4e9', fontSize: '14px' },
  layout: { display: 'flex', gap: '24px', padding: '24px', maxWidth: '1200px', margin: '0 auto' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' },
  sidebar: { width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' },
  ticketHeader: {
    background: '#13161b', border: '1px solid #252a33',
    borderRadius: '10px', padding: '24px',
  },
  ticketMeta: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' },
  ticketKey: { color: '#555b6a', fontSize: '12px', fontWeight: '500' },
  statusBadge: { fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: '500' },
  priorityBadge: { fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: '500' },
  ticketTitle: { color: '#e2e4e9', fontSize: '20px', fontWeight: '600', margin: '0 0 12px' },
  ticketDesc: { color: '#8b90a0', fontSize: '14px', lineHeight: '1.6', margin: 0 },
  aiSection: {
    background: '#13161b', border: '1px solid #252a33',
    borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  aiButtons: { display: 'flex', gap: '8px' },
  aiBtn: {
    background: '#1a1e25', border: '1px solid #252a33', borderRadius: '6px',
    color: '#e2e4e9', padding: '8px 14px', fontSize: '13px', cursor: 'pointer',
  },
  aiOutput: {
    background: '#0d1520', border: '1px solid #1e4070', borderRadius: '8px',
    padding: '14px', position: 'relative',
  },
  aiOutputTitle: { color: '#3b8de0', fontSize: '12px', fontWeight: '600', marginBottom: '8px' },
  aiOutputText: {
    color: '#e2e4e9', fontSize: '13px', lineHeight: '1.6',
    margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit',
  },
  aiClose: {
    position: 'absolute', top: '10px', right: '10px',
    background: 'transparent', border: 'none', color: '#555b6a',
    cursor: 'pointer', fontSize: '14px',
  },
  section: {
    background: '#13161b', border: '1px solid #252a33',
    borderRadius: '10px', padding: '20px',
  },
  sectionTitle: { color: '#e2e4e9', fontSize: '14px', fontWeight: '600', margin: '0 0 16px' },
  comment: { display: 'flex', gap: '12px', marginBottom: '16px' },
  commentAvatar: {
    width: '32px', height: '32px', borderRadius: '50%', background: '#3b8de0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: '600', fontSize: '13px', flexShrink: 0,
  },
  commentBody: { flex: 1 },
  commentAuthor: { color: '#e2e4e9', fontSize: '13px', fontWeight: '500', marginBottom: '4px' },
  edited: { color: '#555b6a', fontSize: '11px' },
  commentText: { color: '#8b90a0', fontSize: '13px', lineHeight: '1.5' },
  commentForm: { marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  commentInput: {
    background: '#1a1e25', border: '1px solid #252a33', borderRadius: '8px',
    padding: '10px 14px', color: '#e2e4e9', fontSize: '13px', outline: 'none',
    fontFamily: 'inherit', resize: 'vertical',
  },
  commentBtn: {
    alignSelf: 'flex-end', background: '#3b8de0', color: '#fff', border: 'none',
    borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  historyItem: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 0', borderBottom: '1px solid #1a1e25', fontSize: '12px',
  },
  historyActor: { color: '#e2e4e9', fontWeight: '500' },
  historyText: { color: '#8b90a0', flex: 1 },
  historyTime: { color: '#555b6a' },
  sideSection: {
    background: '#13161b', border: '1px solid #252a33',
    borderRadius: '8px', padding: '12px 14px',
  },
  sideLabel: { color: '#555b6a', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', marginBottom: '6px' },
  sideValue: { color: '#e2e4e9', fontSize: '13px' },
  sideSelect: {
    width: '100%', background: '#1a1e25', border: '1px solid #252a33',
    borderRadius: '6px', padding: '6px 10px', color: '#e2e4e9',
    fontSize: '13px', outline: 'none',
  },
}