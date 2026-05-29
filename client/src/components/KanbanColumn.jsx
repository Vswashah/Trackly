import { useDroppable } from '@dnd-kit/core'
import { Plus, MoreHorizontal } from 'lucide-react'
import TicketCard from './TicketCard'

export default function KanbanColumn({ status, tickets, onNewTicket }) {

  // useDroppable registers this column as a drop target
  // id must match what we check in onDragEnd
  // isOver becomes true when a dragged card hovers over this column
  const { setNodeRef, isOver } = useDroppable({
    id: status.code,
  })

  return (
    <div className="w-72 flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {status.label}
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 
            px-1.5 py-0.5 rounded-full">
            {tickets.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewTicket}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
          >
            <Plus size={14} />
          </button>
          <button className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Drop zone — this is what accepts dragged cards */}
      <div
        ref={setNodeRef}
        className={`min-h-32 rounded-xl p-2 transition-colors space-y-2
          ${isOver 
            ? 'bg-blue-50 border-2 border-blue-200 border-dashed' 
            : 'bg-gray-50 border-2 border-transparent'
          }`}
      >
        {tickets.map((ticket, index) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            index={index}
          />
        ))}

        {/* Add task button */}
        <button
          onClick={onNewTicket}
          className="w-full text-left px-3 py-2 text-sm text-gray-400 
            hover:text-gray-600 hover:bg-white rounded-lg border 
            border-dashed border-transparent hover:border-gray-200 
            transition-all flex items-center gap-2"
        >
          <Plus size={14} />
          Add Task
        </button>
      </div>
    </div>
  )
}