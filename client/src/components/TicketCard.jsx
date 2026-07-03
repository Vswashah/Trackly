import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate, useParams } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'

const PRIORITY_STYLES = {
  p0: 'bg-red-50 text-red-600 border border-red-200',
  p1: 'bg-orange-50 text-orange-600 border border-orange-200',
  p2: 'bg-blue-50 text-blue-600 border border-blue-200',
  p3: 'bg-gray-100 text-gray-500 border border-gray-200',
}

const LABEL_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
  'bg-purple-100 text-purple-700',
  'bg-red-100 text-red-700',
]

export default function TicketCard({ ticket, index }) {
  const navigate = useNavigate()
  const { projectId } = useParams()

  // This is the magic — useDraggable gives us:
  // attributes: aria attributes for accessibility
  // listeners: mouse/touch event handlers
  // setNodeRef: ref to attach to the DOM element
  // transform: current position while dragging
  // isDragging: whether this card is being dragged
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: ticket.id,        // unique ID for this draggable
    data: {
      ticket,             // pass ticket data so we can access it in onDragEnd
    }
  })

  // CSS.Translate converts the transform object {x, y} into a CSS transform string
  // e.g. "translate3d(10px, 20px, 0)"
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}          // attach dnd-kit to this DOM element
      style={style}
      {...attributes}           // aria attributes
      {...listeners}            // drag event listeners
      className={`bg-white rounded-xl border border-gray-200 p-4 
        hover:border-gray-300 hover:shadow-sm transition-all
        ${isDragging ? 'shadow-lg border-blue-300 z-50' : ''}`}
      onClick={(e) => {
        // Only navigate if we're not dragging
        if (!isDragging) {
          navigate(`/projects/${projectId}/tickets/${ticket.ticket_key}`)
        }
      }}
    >
      {/* Priority + type badges */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium 
          ${PRIORITY_STYLES[ticket.priority]}`}>
          {ticket.priority?.toUpperCase()}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full 
          ${LABEL_COLORS[index % LABEL_COLORS.length]}`}>
          {ticket.type}
        </span>
      </div>

      {/* Title */}
      <div className="text-sm font-medium text-gray-900 mb-1 leading-snug">
        {ticket.title}
      </div>

      {/* Project name */}
      <div className="flex items-center gap-1 mb-3">
        <div className="w-3.5 h-3.5 bg-gray-200 rounded-sm"></div>
        <span className="text-xs text-gray-400">Trackly App</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {ticket.assignee_avatar ? (
          <img
            src={ticket.assignee_avatar}
            alt={ticket.assignee_name}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : ticket.assignee_name ? (
          <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center 
            justify-center text-white text-xs font-medium">
            {ticket.assignee_name.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-200"></div>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {ticket.due_date && (
            <span className={`px-1.5 py-0.5 rounded-full font-medium ${
              new Date(ticket.due_date) < new Date().setHours(0, 0, 0, 0) &&
              !['done', 'cancelled'].includes(ticket.status)
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}>
              {new Date(ticket.due_date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric'
              })}
            </span>
          )}
          <span>
            {new Date(ticket.created_at).toLocaleDateString('en-US', { 
              month: 'short', day: 'numeric' 
            })}
          </span>
          <div className="flex items-center gap-0.5">
            <MessageSquare size={11} />
            <span>0</span>
          </div>
        </div>
      </div>
    </div>
  )
}