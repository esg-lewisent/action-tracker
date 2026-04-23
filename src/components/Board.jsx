import { useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { supabase } from '../supabase'
import CardModal from './CardModal'

function getDateStatus(dateStr) {
  if (!dateStr) return 'none'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr)
  const diff = (due - today) / (1000 * 60 * 60 * 24)
  if (diff < 0) return 'overdue'
  if (diff <= 3) return 'due-soon'
  return 'on-track'
}

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const OWNER_COLORS = ['#4f6ef7', '#7c3aed', '#059669', '#dc2626', '#d97706', '#0891b2', '#be185d']
function ownerColor(name) {
  if (!name) return '#94a3b8'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return OWNER_COLORS[Math.abs(hash) % OWNER_COLORS.length]
}

export default function Board({ actions, onUpdate, currentUser }) {
  const [selectedAction, setSelectedAction] = useState(null)
  const [ownerFilter, setOwnerFilter] = useState('all')

  const owners = [...new Set(actions.map(a => a.owner).filter(Boolean))]

  const filtered = ownerFilter === 'all' ? actions : actions.filter(a => a.owner === ownerFilter)
  const todo = filtered.filter(a => a.status === 'todo')
  const done = filtered.filter(a => a.status === 'done')

  async function onDragEnd(result) {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId) return
    const newStatus = destination.droppableId
    await supabase.from('actions').update({ status: newStatus }).eq('id', draggableId)
    onUpdate()
  }

  return (
    <div className="board-container">
      <div className="board-header">
        <div>
          <h1 className="board-title">Action Tracker</h1>
          <p className="board-meta">{todo.length} open · {done.length} done</p>
        </div>
        <div className="filter-bar">
          <label className="filter-label">Owner</label>
          <select className="filter-select" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
            <option value="all">All</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board">
          {[['todo', 'To Do', todo], ['done', 'Done', done]].map(([id, label, items]) => (
            <Droppable droppableId={id} key={id}>
              {(provided, snapshot) => (
                <div
                  className={`column ${snapshot.isDraggingOver ? 'drag-over' : ''} ${id === 'done' ? 'done-column' : ''}`}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  <div className="column-header">
                    <span className="column-title">{label}</span>
                    <span className="column-count">{items.length}</span>
                  </div>
                  {items.map((action, index) => {
                    const status = getDateStatus(action.due_date)
                    return (
                      <Draggable draggableId={action.id} index={index} key={action.id}>
                        {(provided, snapshot) => (
                          <div
                            className={`card ${status} ${snapshot.isDragging ? 'dragging' : ''}`}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => setSelectedAction(action)}
                          >
                            <div className="card-title">{action.title}</div>
                            <div className="card-meta">
                              <div className="card-owner">
                                <div className="owner-dot" style={{ background: ownerColor(action.owner) }}>
                                  {getInitials(action.owner)}
                                </div>
                                <span>{action.owner || 'Unassigned'}</span>
                              </div>
                              {action.due_date && (
                                <span className={`card-date ${status}`}>{formatDate(action.due_date)}</span>
                              )}
                            </div>
                            {action.comments && (
                              <div className="card-comment">{action.comments}</div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    )
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {selectedAction && (
        <CardModal
          action={selectedAction}
          owners={owners}
          onClose={() => setSelectedAction(null)}
          onUpdate={() => { onUpdate(); setSelectedAction(null) }}
        />
      )}
    </div>
  )
}
