import { useState } from 'react'
import { supabase } from '../supabase'

export default function CardModal({ action, owners, onClose, onUpdate }) {
  const [title, setTitle] = useState(action.title)
  const [owner, setOwner] = useState(action.owner || '')
  const [dueDate, setDueDate] = useState(action.due_date || '')
  const [status, setStatus] = useState(action.status)
  const [comments, setComments] = useState(action.comments || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setSaving(true)
    await supabase.from('actions').update({
      title,
      owner,
      due_date: dueDate || null,
      status,
      comments
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

  const ownerOptions = [...new Set([...owners, owner].filter(Boolean))]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="field">
          <label>Action</label>
          <textarea value={title} onChange={e => setTitle(e.target.value)} rows={2} />
        </div>

        <div className="field-row">
          <div className="field">
            <label>Owner</label>
            <input
              list="owner-list"
              value={owner}
              onChange={e => setOwner(e.target.value)}
              placeholder="Type a name"
            />
            <datalist id="owner-list">
              {ownerOptions.map(o => <option key={o} value={o} />)}
            </datalist>
          </div>
          <div className="field">
            <label>Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
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
