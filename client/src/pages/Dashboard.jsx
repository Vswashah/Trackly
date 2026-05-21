import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import useAuthStore from '../store/auth.store'
import api from '../lib/api'

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showNewProject, setShowNewProject] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      // For now use the hardcoded project we created
      return [{ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Trackly App', slug: 'trackly-app', ticket_count: 3 }]
    }
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div style={styles.container}>
      {/* Navbar */}
      <div style={styles.nav}>
        <span style={styles.navLogo}>Trackly</span>
        <div style={styles.navRight}>
          <span style={styles.navUser}>{user?.full_name}</span>
          <button style={styles.navBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        <div style={styles.pageHeader}>
          <h2 style={styles.pageTitle}>Projects</h2>
          <button style={styles.newBtn} onClick={() => setShowNewProject(!showNewProject)}>
            + New Project
          </button>
        </div>

        {/* New Project Form */}
        {showNewProject && (
          <div style={styles.formCard}>
            <input
              style={styles.input}
              placeholder="Project name"
              value={name}
              onChange={e => {
                setName(e.target.value)
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
              }}
            />
            <input
              style={styles.input}
              placeholder="Slug (auto-generated)"
              value={slug}
              onChange={e => setSlug(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={styles.btn} onClick={() => toast.success('Project API coming soon!')}>
                Create
              </button>
              <button style={styles.btnSecondary} onClick={() => setShowNewProject(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {isLoading ? (
          <p style={styles.empty}>Loading...</p>
        ) : (
          <div style={styles.grid}>
            {projects?.map(project => (
              <div
                key={project.id}
                style={styles.projectCard}
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div style={styles.projectIcon}>
                  {project.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={styles.projectName}>{project.name}</div>
                  <div style={styles.projectMeta}>{project.ticket_count || 0} tickets</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#0d0f12' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 32px', height: '56px', background: '#13161b',
    borderBottom: '1px solid #252a33',
  },
  navLogo: { color: '#e2e4e9', fontWeight: '700', fontSize: '18px' },
  navRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  navUser: { color: '#8b90a0', fontSize: '14px' },
  navBtn: {
    background: 'transparent', border: '1px solid #252a33', borderRadius: '6px',
    color: '#8b90a0', padding: '6px 12px', fontSize: '13px', cursor: 'pointer',
  },
  content: { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  pageTitle: { color: '#e2e4e9', fontSize: '22px', fontWeight: '600', margin: 0 },
  newBtn: {
    background: '#3b8de0', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  formCard: {
    background: '#13161b', border: '1px solid #252a33', borderRadius: '10px',
    padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  input: {
    background: '#1a1e25', border: '1px solid #252a33', borderRadius: '8px',
    padding: '10px 14px', color: '#e2e4e9', fontSize: '14px', outline: 'none',
  },
  btn: {
    background: '#3b8de0', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  btnSecondary: {
    background: 'transparent', color: '#8b90a0', border: '1px solid #252a33',
    borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' },
  projectCard: {
    background: '#13161b', border: '1px solid #252a33', borderRadius: '10px',
    padding: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px',
    transition: 'border-color .15s',
  },
  projectIcon: {
    width: '40px', height: '40px', borderRadius: '8px', background: '#3b8de0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: '700', fontSize: '18px', flexShrink: 0,
  },
  projectName: { color: '#e2e4e9', fontWeight: '500', fontSize: '15px', marginBottom: '4px' },
  projectMeta: { color: '#8b90a0', fontSize: '12px' },
  empty: { color: '#8b90a0', fontSize: '14px' },
}