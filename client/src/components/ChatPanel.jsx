import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Send, Sparkles, CheckCircle2, XCircle } from 'lucide-react'
import api from '../lib/api'

export default function ChatPanel({ projectId, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I can help plan this project — ask me to create tickets, update statuses, or set up a sprint." },
  ])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: async (nextMessages) => {
      // Anthropic's API only wants role/content, not our local metadata (e.g. actions)
      const payload = nextMessages.map(m => ({ role: m.role, content: m.content }))
      const res = await api.post('/ai/chat', { project_id: projectId, messages: payload })
      return res.data
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, actions: data.actions }])
      if (data.actions?.some(a => a.ok)) {
        queryClient.invalidateQueries(['tickets', projectId])
        queryClient.invalidateQueries(['sprints', projectId])
      }
    },
    onError: () => {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong reaching the AI.' }])
    },
  })

  const send = () => {
    if (!input.trim() || chatMutation.isPending) return
    const nextMessages = [...messages, { role: 'user', content: input.trim() }]
    setMessages(nextMessages)
    setInput('')
    chatMutation.mutate(nextMessages)
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-indigo-500" />
          <h2 className="font-semibold text-gray-900 text-sm">AI Planning Chat</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              m.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              {m.actions?.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-gray-200 pt-2">
                  {m.actions.map((a, j) => (
                    <div key={j} className="flex items-center gap-1.5 text-xs text-gray-500">
                      {a.ok ? <CheckCircle2 size={11} className="text-green-500 flex-shrink-0" /> : <XCircle size={11} className="text-red-500 flex-shrink-0" />}
                      <span>{describeAction(a)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-400 rounded-xl px-3 py-2 text-sm">Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-gray-100 flex-shrink-0">
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400"
            placeholder="e.g. Create 3 tickets for the login redesign..."
            value={input}
            autoFocus
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send() }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || chatMutation.isPending}
            className="px-3 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function describeAction(a) {
  if (!a.ok) return `Failed to ${a.tool.replace(/_/g, ' ')}: ${a.result?.error || 'unknown error'}`
  switch (a.tool) {
    case 'create_ticket': return `Created ticket "${a.result?.title}" (${a.result?.ticket_key})`
    case 'update_ticket': return `Updated ${a.input?.ticket_key}`
    case 'create_sprint': return `Created sprint "${a.result?.name}"`
    case 'list_tickets': return `Looked up tickets`
    case 'list_sprints': return `Looked up sprints`
    default: return a.tool.replace(/_/g, ' ')
  }
}
