import { useState, useRef } from 'react'
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

function MultiSelect({ label, options, selected, onChange, onDelete }) {
  const [open, setOpen] = useState(false)
  const [hoveredOption, setHoveredOption] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter(v => v !== val))
    else onChange([...selected, val])
  }

  const displayLabel = selected.length === 0 ? 'All' : selected.length === 1 ? selected[0] : `${selected.length} selected`

  function handleDeleteClick(e, option) {
    e.stopPropagation()
    setConfirmDelete(option)
  }

  function handleConfirmDelete(e) {
    e.stopPropagation()
    onDelete(confirmDelete)
    setConfirmDelete(null)
    setOpen(false)
  }

  function handleCancelDelete(e) {
    e.stopPropagation()
    setConfirmDelete(null)
  }

  return (
    <div className="multiselect" style={{ position: 'relative' }}>
      <button className="multiselect-btn" onClick={() => setOpen(!open)}>
        <span>{label}: <strong>{displayLabel}</strong></span>
        <span className="multiselect-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <>
          <div className="multiselect-backdrop" onClick={() => { setOpen(false); setConfirmDelete(null) }} />
          <div className="multiselect-dropdown">
            {confirmDelete ? (
              <div className="delete-confirm">
                <p className="delete-confirm-text">Delete <strong>{confirmDelete}</strong>? This will delete all actions in this board. You cannot undo this.</p>
                <div className="delete-confirm-actions">
                  <button className="btn-danger small" onClick={handleConfirmDelete}>Yes, delete</button>
                  <button className="btn-secondary small" onClick={handleCancelDelete}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {selected.length > 0 && (
                  <div className="multiselect-clear" onClick={() => { onChange([]); setOpen(false) }}>Clear all</div>
                )}
                {options.map(o => (
                  <div
                    key={o}
                    className="multiselect-option-row"
                    onMouseEnter={() => setHoveredOption(o)}
                    onMouseLeave={() => setHoveredOption(null)}
                  >
                    <label className="multiselect-option">
                      <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} />
                      {o}
                    </label>
                    {onDelete && hoveredOption === o && (
                      <button className="option-delete-btn" onClick={e => handleDeleteClick(e, o)} title="Delete board">✕</button>
                    )}
                  </div>
                ))}
                {options.length === 0 && <div className="multiselect-empty">No options</div>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Card({ action, onClick, onDragStart }) {
  const status = getDateStatus(action.due_date)
  return (
    <div
      className={`card ${status}`}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('actionId', action.id)
        e.dataTransfer.setData('currentStatus', action.status)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart && onDragStart()
        setTimeout(() => e.target.classList.add('dragging'), 0)
      }}
      onDragEnd={e => e.target.classList.remove('dragging')}
      onClick={onClick}
    >
      <div className="card-title">{action.title}</div>
      <div className="card-tags">
        {action.board_name && <span className="card-tag tag-board">{action.board_name}</span>}
        {action.client && <span className="card-tag tag-client">{action.client}</span>}
      </div>
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
      {action.comments && <div className="card-comment">{action.comments}</div>}
    </div>
  )
}

function Column({ id, label, items, onCardClick, onDrop }) {
  const [isOver, setIsOver] = useState(false)

  return (
    <div
      className={`column ${id === 'done' ? 'done-column' : ''} ${isOver ? 'drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsOver(true) }}
      onDragLeave={() => setIsOver(false)}
      onDrop={e => {
        e.preventDefault()
        setIsOver(false)
        const actionId = e.dataTransfer.getData('actionId')
        const currentStatus = e.dataTransfer.getData('currentStatus')
        if (actionId && currentStatus !== id) onDrop(actionId, id)
      }}
    >
      <div className="column-header">
        <span className="column-title">{label}</span>
        <span className="column-count">{items.length}</span>
      </div>
      {items.map(action => (
        <Card key={action.id} action={action} onClick={() => onCardClick(action)} />
      ))}
    </div>
  )
}

export default function Board({ actions, boards, onUpdate, onDragStateChange, currentUser }) {
  const [selectedAction, setSelectedAction] = useState(null)
  const [ownerFilters, setOwnerFilters] = useState([])
  const [clientFilters, setClientFilters] = useState([])
  const [boardFilters, setBoardFilters] = useState([])

  const owners = [...new Set(actions.map(a => a.owner).filter(Boolean))].sort()
  const clients = [...new Set(actions.map(a => a.client).filter(Boolean))].sort()
  const boardNames = [...new Set(actions.map(a => a.board_name).filter(Boolean))].sort()

  const filtered = actions.filter(a => {
    if (ownerFilters.length > 0 && !ownerFilters.includes(a.owner)) return false
    if (clientFilters.length > 0 && !clientFilters.includes(a.client)) return false
    if (boardFilters.length > 0 && !boardFilters.includes(a.board_name)) return false
    return true
  })

  const todo = filtered.filter(a => a.status === 'todo')
  const done = filtered.filter(a => a.status === 'done')
  const activeFilterCount = ownerFilters.length + clientFilters.length + boardFilters.length

  async function handleDrop(actionId, newStatus) {
    onDragStateChange && onDragStateChange(false)
    await supabase.from('actions').update({ status: newStatus }).eq('id', actionId)
    onUpdate()
  }

  async function handleDeleteBoard(boardName) {
    await supabase.from('actions').delete().eq('board_name', boardName)
    await supabase.from('boards').delete().eq('name', boardName)
    setBoardFilters(prev => prev.filter(b => b !== boardName))
    onUpdate()
  }

  return (
    <div className="board-container">
      <div className="board-header">
        <div>
          <h1 className="board-title">Action Tracker</h1>
          <p className="board-meta">{todo.length} open · {done.length} done{activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active` : ''}</p>
        </div>
        <div className="filter-bar">
          <MultiSelect label="Board" options={boardNames} selected={boardFilters} onChange={setBoardFilters} onDelete={handleDeleteBoard} />
          <MultiSelect label="Client" options={clients} selected={clientFilters} onChange={setClientFilters} />
          <MultiSelect label="Owner" options={owners} selected={ownerFilters} onChange={setOwnerFilters} />
        </div>
      </div>

      <div className="board">
        <Column id="todo" label="To Do" items={todo} onCardClick={setSelectedAction} onDrop={handleDrop} />
        <Column id="done" label="Done" items={done} onCardClick={setSelectedAction} onDrop={handleDrop} />
      </div>

      {selectedAction && (
        <CardModal
          action={selectedAction}
          owners={owners}
          clients={clients}
          boards={boards}
          onClose={() => setSelectedAction(null)}
          onUpdate={() => { onUpdate(); setSelectedAction(null) }}
        />
      )}
    </div>
  )
}
