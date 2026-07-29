import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Eye, Pencil, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import Sidebar from '../components/Sidebar'
import api from '../lib/api'
import renderMarkdownLite from '../lib/markdownLite'

export default function ProjectDocs() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('preview')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const { data: docs = [] } = useQuery({
    queryKey: ['docs', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/docs`)).data,
  })

  const { data: doc } = useQuery({
    queryKey: ['doc', selectedId],
    queryFn: async () => (await api.get(`/projects/${projectId}/docs/${selectedId}`)).data,
    enabled: !!selectedId,
  })

  useEffect(() => {
    if (doc) {
      setTitle(doc.title)
      setContent(doc.content || '')
    }
  }, [doc?.id])

  const createMutation = useMutation({
    mutationFn: async () => (await api.post(`/projects/${projectId}/docs`, {
      title: 'Untitled doc', content: '',
    })).data,
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries(['docs', projectId])
      setSelectedId(newDoc.id)
      setMode('edit')
    },
    onError: () => toast.error('Failed to create doc'),
  })

  const saveMutation = useMutation({
    mutationFn: async () => api.patch(`/projects/${projectId}/docs/${selectedId}`, { title, content }),
    onSuccess: () => {
      queryClient.invalidateQueries(['docs', projectId])
      queryClient.invalidateQueries(['doc', selectedId])
      toast.success('Saved')
      setMode('preview')
    },
    onError: () => toast.error('Failed to save'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (docId) => api.delete(`/projects/${projectId}/docs/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['docs', projectId])
      setSelectedId(null)
      toast.success('Doc deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const dirty = doc && (title !== doc.title || content !== (doc.content || ''))

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-56 flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center gap-3">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-sm font-semibold text-gray-900">Project Docs</h1>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Doc list */}
          <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-gray-100">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                <Plus size={14} />
                New Doc
              </button>
            </div>
            <div className="p-2">
              {docs.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setSelectedId(d.id); setMode('preview') }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
                    selectedId === d.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="truncate">{d.title}</div>
                  <div className="text-xs text-gray-400">{new Date(d.updated_at).toLocaleDateString()}</div>
                </button>
              ))}
              {!docs.length && (
                <p className="text-xs text-gray-400 text-center py-8 flex flex-col items-center gap-2">
                  <FileText size={18} className="text-gray-300" />
                  No docs yet
                </p>
              )}
            </div>
          </div>

          {/* Doc content */}
          <div className="flex-1 overflow-y-auto p-8">
            {!selectedId && (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                Select a doc, or create a new one
              </div>
            )}

            {selectedId && doc && (
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  {mode === 'edit' ? (
                    <input
                      className="text-xl font-semibold text-gray-900 outline-none border-b border-transparent focus:border-gray-300 flex-1"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                    />
                  ) : (
                    <h1 className="text-xl font-semibold text-gray-900">{doc.title}</h1>
                  )}

                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {mode === 'preview' ? (
                      <button
                        onClick={() => setMode('edit')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setMode('preview')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                        >
                          <Eye size={13} />
                          Preview
                        </button>
                        <button
                          onClick={() => saveMutation.mutate()}
                          disabled={!dirty || saveMutation.isPending}
                          className="px-3 py-1.5 text-sm bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                        >
                          {saveMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(selectedId)}
                      className="text-gray-300 hover:text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {mode === 'edit' ? (
                  <textarea
                    className="w-full min-h-[60vh] px-4 py-3 text-sm font-mono border border-gray-200 rounded-xl outline-none focus:border-gray-400 resize-y leading-relaxed"
                    placeholder={'# Heading\n\nWrite in **bold**, `code`, or\n- list items'}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                  />
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-700">
                    {content
                      ? renderMarkdownLite(content)
                      : <p className="text-gray-400">This doc is empty — click Edit to start writing.</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
