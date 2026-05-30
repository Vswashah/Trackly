import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, UserPlus, Crown, User } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function MembersModal({ projectId, onClose }) {
  const [email, setEmail] = useState('')
  const queryClient = useQueryClient()

  const { data: members, isLoading } = useQuery({
    queryKey: ['members', projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/members`)
      return res.data
    }
  })

  const inviteMutation = useMutation({
    mutationFn: async (email) => {
      const res = await api.post(`/projects/${projectId}/invite`, { email })
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['members', projectId])
      setEmail('')
      toast.success(data.message)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to invite'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Team Members</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {/* Invite form */}
          <div className="mb-5">
            <label className="text-xs font-medium text-gray-500 block mb-1.5">
              Invite by email
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400"
                placeholder="teammate@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && email.trim()) {
                    inviteMutation.mutate(email.trim())
                  }
                }}
              />
              <button
                onClick={() => inviteMutation.mutate(email.trim())}
                disabled={!email.trim() || inviteMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                <UserPlus size={14} />
                Invite
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              They must have a Trackly account already
            </p>
          </div>

          {/* Members list */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-3">
              {members?.length || 0} member{members?.length !== 1 ? 's' : ''}
            </div>

            {isLoading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : (
              <div className="space-y-2">
                {members?.map(member => (
                  <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {member.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {member.full_name}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{member.email}</div>
                    </div>
                    <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                      member.role === 'project_owner' 
                        ? 'bg-amber-50 text-amber-600' 
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {member.role === 'project_owner' ? <Crown size={10} /> : <User size={10} />}
                      {member.role === 'project_owner' ? 'Owner' : member.role}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}