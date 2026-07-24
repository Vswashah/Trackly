import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Crown, User as UserIcon } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import api from '../lib/api'

export default function TeamMembers() {
  const [search, setSearch] = useState('')

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await api.get('/team/members')
      return res.data
    }
  })

  const filtered = members.filter(m =>
    !search ||
    m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-56 flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Team Members</h1>
            <p className="text-sm text-gray-500 mt-1">Everyone who shares a project with you</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 w-56"
              placeholder="Search teammates..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Loading team...</div>
          )}

          {!isLoading && !filtered.length && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              {members.length ? 'No matches' : 'No teammates yet — invite people from a project board'}
            </div>
          )}

          {filtered.map((member, i) => (
            <div
              key={member.id}
              className={`flex items-center gap-4 px-5 py-4 ${i !== 0 ? 'border-t border-gray-100' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden">
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  member.full_name?.charAt(0).toUpperCase()
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{member.full_name}</div>
                <div className="text-xs text-gray-400">{member.email}</div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap max-w-xs justify-end">
                {member.projects?.map(p => (
                  <span
                    key={p.id}
                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                      p.role === 'project_owner'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {p.role === 'project_owner' ? <Crown size={10} /> : <UserIcon size={10} />}
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
