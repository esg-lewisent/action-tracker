import { useState } from 'react'
import { supabase } from '../supabase'

function OwnerTagInput({ owners, onChange, suggestions }) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filtered = suggestions.filter(s =>
    s.toLowerCase().includes(input.toLowerCase()) && !owners.includes(s)
  )

  function addOwner(name) {
    const trimmed = name.trim()
    if (trimmed && !owners.includes(trimmed)) onChange([...owners, trimmed])
    setInput('')
    setShowSuggestions(false)
  }

  function removeOwner(name) {
    onChange(owners.filter(o => o !== name))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && input.trim()) { e.preventDefault(); addOwner(input) }
    if (e.key === 'Backspace' && !input && owners.length > 0) removeOwner(owners[owners.length - 1])
  }

  return (
    <div className="owner-tag-input" style={{ position: 'relative' }}>
      <div className="owner-tags-container">
        {owners.map(o => (
          <span key={o} className="owner-tag">
            {o}
            <button onClick={() => removeOwner(o)} className="owner-tag-remove">✕</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={owners.length === 0 ? 'Type a name and press Enter' : ''}
          className="owner-tag-field"
        />
      </div>
      {showSuggestions && input && filtered.length > 0 && (
        <div className="owner-suggestions">
          {filtered.map(s => (
            <div key={s} className="owner-suggestion" onMouseDown={() => addOwner(s)}>{s}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CardModal({ action, owners, clients, boards, onClose, onUpdate }) {
  const [title, setTitle] = useState(action.title)
  const [cardOwners, setCardOwners] = useState(action.owners || (action.owner ? [action.owner] : []))
  const [client, setClient] = useState(action.client || '')
  const [dueDate, setDueDate] = useState(action.due_date || '')
  const [status, setStatus] = useState(action.status)
  const [comments, setComments] = useState(action.comments || '')
  const [boardName, setBoardName] = useState(action.board_name || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setSaving(true)
    await supabase.from('actions').update({
      title,
      owner: cardOwners[0] || null,
      owners: cardOwners,
      client,
      due_date: dueDate || null,
      status,
      comments,
      board_name: boardName || null
    }).eq('id', action.id)
    setSaving(false)
    onUpdate()
  }

  async function handleDelete() {
    if (!confirm('Delete this action?')) return
    setDeleting(true)
    await supabase.from('actions').delete().eq('id', action.id)
    setDeleting(false)
    onUpdate()
  }

  const clientOptions = [...new Set([...clients, client].filter(Boolean))]
  const boardOptions = [...new Set([...(boards || []).map(b => b.name), boardName].filter(Boolean))]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="field">
          <label>Action</label>
          <textarea value={title} onChange={e => setTitle(e.target.value)} rows={2} />
        </div>

        <div className="field-row">
          <div className="field" style={{ flex: 2 }}>
            <label>Owners</label>
            <OwnerTagInput owners={cardOwners} onChange={setCardOwners} suggestions={owners} />
          </div>
          <div className="field">
            <label>Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Client</label>
            <input list="client-list" value={client} onChange={e => setClient(e.target.value)} placeholder="Client name" />
            <datalist id="client-list">{clientOptions.map(o => <option key={o} value={o} />)}</datalist>
          </div>
          <div className="field">
            <label>Board</label>
            <input list="board-list" value={boardName} onChange={e => setBoardName(e.target.value)} placeholder="Board name" />
            <datalist id="board-list">{boardOptions.map(o => <option key={o} value={o} />)}</datalist>
          </div>
        </div>

        <div className="field">
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="todo">To Do</option>
            <option value="done">Done</option>
          </select>
        </div>

        <div className="field">
          <label>Comments</label>
          <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} placeholder="Any notes or context..." />
        </div>

        {action.source_meeting && (
          <div className="field">
            <label>Source Meeting</label>
            <div className="source-tag">{action.source_meeting}</div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
