import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

const SWATCHES = ['#6B7280', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export default function LabelsModal({ projectId, onClose }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[0])
  const queryClient = useQueryClient()

  const { data: labels, isLoading } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/labels`)
      return res.data
    }
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/projects/${projectId}/labels`, { name, color_hex: color })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['labels', projectId])
      setName('')
      toast.success('Label created')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create label'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (labelId) => api.delete(`/projects/${projectId}/labels/${labelId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['labels', projectId])
      toast.success('Label deleted')
    },
    onError: () => toast.error('Failed to delete label'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Labels</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-5">
            <label className="text-xs font-medium text-gray-500 block mb-1.5">New label</label>
            <div className="flex items-center gap-2 mb-2">
              {SWATCHES.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full flex-shrink-0 transition-all ${color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400"
                placeholder="e.g. frontend, urgent..."
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && name.trim()) createMutation.mutate() }}
              />
              <button
                onClick={() => createMutation.mutate()}
                disabled={!name.trim() || createMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 mb-3">
              {labels?.length || 0} label{labels?.length !== 1 ? 's' : ''}
            </div>

            {isLoading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : (
              <div className="space-y-1.5">
                {labels?.map(label => (
                  <div key={label.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 group">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: label.color_hex }} />
                    <span className="text-sm text-gray-700 flex-1">{label.name}</span>
                    <button
                      onClick={() => deleteMutation.mutate(label.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {!labels?.length && (
                  <p className="text-sm text-gray-400 text-center py-6 flex flex-col items-center gap-2">
                    <Tag size={20} className="text-gray-300" />
                    No labels yet
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
