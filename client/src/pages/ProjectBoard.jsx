import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'

const STATUSES = [
  { code: 'open', label: 'Open', color: '#6B7280' },
  { code: 'in_progress', label: 'In Progress', color: '#3B82F6' },
  { code: 'in_review', label: 'In Review', color: '#F59E0B' },
  { code: 'done', label: 'Done', color: '#10B981' },
]

const PRIORITIES = { p0: '#EF4444', p1: '#F59E0B', p2: '#3B82F6', p3: '#6B7280' }

export default function ProjectBoard() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('p2')
  const [type, setType] = useState('task')
  const [similar, setSimilar] = useState([])
  const [checkingDupe, setCheckingDupe] = useState(false)

  const { data, isLoading } = useQuery({
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
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create ticket'),
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketKey, status }) => {
      await api.patch(`/projects/${projectId}/tickets/${ticketKey}`, { status })
    },
    onSuccess: () => queryClient.invalidateQueries(['tickets', projectId]),
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

  const ticketsByStatus = (status) =>
    (data || []).filter(t => t.status === status)

  return (
    <div style={styles.container}>
      {/* Nav */}
      <div style={styles.nav}>
        <div style={styles.navLeft}>
          <span style={styles.navLogo} onClick={() => navigate('/')}>Trackly</span>
          <span style={styles.navSep}>/</span>
          <span style={styles.navProject}>Trackly App</span>
        </div>
        <button style={styles.newBtn} onClick={() => setShowNewTicket(true)}>
          + New Ticket
        </button>
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>New Ticket</h3>

            <input
              style={styles.input}
              placeholder="Title"
              value={title}
              onChange={e => {
                setTitle(e.target.value)
                clearTimeout(window._dupeTimer)
                window._dupeTimer = setTimeout(() => checkSimilar(e.target.value), 500)
              }}
              autoFocus
            />

            {/* Similar tickets warning */}
            {checkingDupe && <p style={styles.checking}>Checking for duplicates...</p>}
            {similar.length > 0 && (
              <div style={styles.dupeWarning}>
                <p style={styles.dupeTitle}>⚠️ Similar tickets found:</p>
                {similar.map(t => (
                  <div key={t.ticket_key} style={styles.dupeItem}>
                    <span style={styles.dupeKey}>{t.ticket_key}</span>
                    <span style={styles.dupeText}>{t.title}</span>
                    <span style={styles.dupeSim}>{Math.round(t.similarity * 100)}%</span>
                  </div>
                ))}
              </div>
            )}

            <textarea
              style={{ ...styles.input, height: '100px', resize: 'vertical' }}
              placeholder="Description"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />

            <div style={styles.row}>
              <select style={styles.select} value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="p0">P0 - Critical</option>
                <option value="p1">P1 - High</option>
                <option value="p2">P2 - Medium</option>
                <option value="p3">P3 - Low</option>
              </select>
              <select style={styles.select} value={type} onChange={e => setType(e.target.value)}>
                <option value="bug">Bug</option>
                <option value="feature">Feature</option>
                <option value="task">Task</option>
                <option value="chore">Chore</option>
              </select>
            </div>

            <div style={styles.modalBtns}>
              <button
                style={styles.btn}
                onClick={() => createMutation.mutate({ title, description, priority, type })}
                disabled={!title || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Ticket'}
              </button>
              <button style={styles.btnSecondary} onClick={() => {
                setShowNewTicket(false)
                setSimilar([])
                setTitle('')
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div style={styles.board}>
        {STATUSES.map(status => (
          <div key={status.code} style={styles.column}>
            <div style={styles.columnHeader}>
              <div style={{ ...styles.columnDot, background: status.color }} />
              <span style={styles.columnTitle}>{status.label}</span>
              <span style={styles.columnCount}>{ticketsByStatus(status.code).length}</span>
            </div>

            <div style={styles.columnBody}>
              {isLoading ? (
                <p style={styles.loading}>Loading...</p>
              ) : (
                ticketsByStatus(status.code).map(ticket => (
                  <div
                    key={ticket.id}
                    style={styles.ticketCard}
                    onClick={() => navigate(`/projects/${projectId}/tickets/${ticket.ticket_key}`)}
                  >
                    <div style={styles.ticketKey}>{ticket.ticket_key}</div>
                    <div style={styles.ticketTitle}>{ticket.title}</div>
                    <div style={styles.ticketMeta}>
                      <span style={{
                        ...styles.priorityBadge,
                        background: PRIORITIES[ticket.priority] + '20',
                        color: PRIORITIES[ticket.priority],
                      }}>
                        {ticket.priority?.toUpperCase()}
                      </span>
                      <span style={styles.typeBadge}>{ticket.type}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#0d0f12', display: 'flex', flexDirection: 'column' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: '52px', background: '#13161b',
    borderBottom: '1px solid #252a33', flexShrink: 0,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
  navLogo: { color: '#e2e4e9', fontWeight: '700', fontSize: '16px', cursor: 'pointer' },
  navSep: { color: '#252a33', fontSize: '18px' },
  navProject: { color: '#8b90a0', fontSize: '14px' },
  newBtn: {
    background: '#3b8de0', color: '#fff', border: 'none', borderRadius: '6px',
    padding: '7px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  board: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px', padding: '20px 24px', flex: 1, overflowX: 'auto',
  },
  column: {
    background: '#13161b', border: '1px solid #252a33',
    borderRadius: '10px', display: 'flex', flexDirection: 'column', minHeight: '400px',
  },
  columnHeader: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 14px', borderBottom: '1px solid #252a33',
  },
  columnDot: { width: '8px', height: '8px', borderRadius: '50%' },
  columnTitle: { color: '#e2e4e9', fontSize: '13px', fontWeight: '500', flex: 1 },
  columnCount: {
    background: '#1a1e25', color: '#8b90a0', fontSize: '11px',
    padding: '2px 7px', borderRadius: '10px',
  },
  columnBody: { padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  ticketCard: {
    background: '#1a1e25', border: '1px solid #252a33', borderRadius: '8px',
    padding: '12px', cursor: 'pointer',
  },
  ticketKey: { color: '#555b6a', fontSize: '11px', marginBottom: '4px' },
  ticketTitle: { color: '#e2e4e9', fontSize: '13px', lineHeight: '1.4', marginBottom: '8px' },
  ticketMeta: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  priorityBadge: { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' },
  typeBadge: {
    fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
    background: '#252a33', color: '#8b90a0',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#13161b', border: '1px solid #252a33', borderRadius: '12px',
    padding: '28px', width: '100%', maxWidth: '520px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  modalTitle: { color: '#e2e4e9', fontSize: '18px', fontWeight: '600', margin: 0 },
  input: {
    background: '#1a1e25', border: '1px solid #252a33', borderRadius: '8px',
    padding: '10px 14px', color: '#e2e4e9', fontSize: '14px', outline: 'none',
    fontFamily: 'inherit',
  },
  checking: { color: '#8b90a0', fontSize: '12px', margin: 0 },
  dupeWarning: {
    background: '#2a1a0a', border: '1px solid #5a3010', borderRadius: '8px', padding: '12px',
  },
  dupeTitle: { color: '#f0a060', fontSize: '12px', fontWeight: '600', margin: '0 0 8px' },
  dupeItem: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
  dupeKey: { color: '#8b90a0', fontSize: '11px', minWidth: '70px' },
  dupeText: { color: '#e2e4e9', fontSize: '12px', flex: 1 },
  dupeSim: { color: '#f0a060', fontSize: '11px', fontWeight: '600' },
  row: { display: 'flex', gap: '10px' },
  select: {
    flex: 1, background: '#1a1e25', border: '1px solid #252a33', borderRadius: '8px',
    padding: '10px 14px', color: '#e2e4e9', fontSize: '13px', outline: 'none',
  },
  modalBtns: { display: 'flex', gap: '8px' },
  btn: {
    background: '#3b8de0', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '10px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  btnSecondary: {
    background: 'transparent', color: '#8b90a0', border: '1px solid #252a33',
    borderRadius: '8px', padding: '10px 16px', fontSize: '13px', cursor: 'pointer',
  },
  loading: { color: '#8b90a0', fontSize: '13px', padding: '8px' },
}