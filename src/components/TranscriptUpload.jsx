import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TranscriptUpload({ onDone, currentUser }) {
  const [transcript, setTranscript] = useState('')
  const [meetingName, setMeetingName] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState([])
  const [progressCount, setProgressCount] = useState(0)
  const [boards, setBoards] = useState([])
  const [selectedBoard, setSelectedBoard] = useState('')
  const [newBoardName, setNewBoardName] = useState('')
  const [showNewBoard, setShowNewBoard] = useState(false)
  const progressRef = useRef(null)

  useEffect(() => {
    fetchBoards()
  }, [])

  useEffect(() => {
    if (progressRef.current) progressRef.current.scrollTop = progressRef.current.scrollHeight
  }, [progress])

  async function fetchBoards() {
    const { data } = await supabase.from('boards').select('*').order('name')
    if (data) setBoards(data)
  }

  async function handleCreateBoard() {
    if (!newBoardName.trim()) return
    const { data } = await supabase.from('boards').insert({ name: newBoardName.trim() }).select().single()
    if (data) {
      setBoards(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedBoard(data.name)
      setNewBoardName('')
      setShowNewBoard(false)
    }
  }

  async function handleExtract() {
    if (!transcript.trim()) return
    setError('')
    setLoading(true)
    setExtracted(null)
    setProgress([])
    setProgressCount(0)

    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY
      const today = new Date().toISOString().split('T')[0]

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          stream: true,
          messages: [
            {
              role: 'system',
              content: `You are an assistant that extracts action items from meeting transcripts.
Today's date is ${today}.
Return ONLY a valid JSON object with two keys:
1. "client": string or null - the client/company name this meeting relates to, inferred from context. Set to null if not clearly identifiable.
2. "actions": array of action objects, each with:
   - title: string (clear, concise action description)
   - owners: array of strings (all people responsible, full names if mentioned, else empty array [])
   - due_date: string in YYYY-MM-DD format if a date or timeframe is mentioned, else null
   - comments: string (any relevant context or notes, else null)

Example output:
{"client":"Acme Corp","actions":[{"title":"Send pricing deck","owners":["Lewis","Jane"],"due_date":"2026-04-25","comments":"Include enterprise tier"}]}
            },
            { role: 'user', content: `Extract all action items from this meeting transcript:\n\n${transcript}` }
          ]
        })
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            const delta = json.choices?.[0]?.delta?.content || ''
            fullText += delta
            const matches = fullText.match(/\{[^{}]*"title"\s*:\s*"([^"]+)"[^{}]*\}/g)
            if (matches) {
              const parsed = []
              for (const m of matches) {
                try { const obj = JSON.parse(m.replace(/,\s*$/, '')); if (obj.title) parsed.push(obj) } catch {}
              }
              if (parsed.length > progressCount) {
                setProgressCount(parsed.length)
                setProgress(parsed.map(p => p.title))
              }
            }
          } catch {}
        }
      }

      const cleaned = fullText.replace(/```json|```/g, '').trim()
      const result = JSON.parse(cleaned)
      setExtracted({ client: result.client || '', actions: result.actions || [] })
    } catch (err) {
      setError('Failed to extract actions. Check your API key or try again. ' + err.message)
    }
    setLoading(false)
    setProgress([])
  }

  async function handleSave() {
    if (!extracted?.actions?.length) return
    setSaving(true)
    const source = meetingName.trim() || `Meeting ${new Date().toLocaleDateString('en-GB')}`
    const rows = extracted.actions.map(a => ({
      title: a.title,
      owner: (a.owners && a.owners[0]) || null,
      owners: a.owners || [],
      due_date: a.due_date || null,
      comments: a.comments || null,
      status: 'todo',
      source_meeting: source,
      board_name: selectedBoard || null,
      client: extracted.client || null,
      created_by: currentUser.id
    }))
    await supabase.from('actions').insert(rows)
    setSaving(false)
    onDone()
  }

  function updateAction(index, field, value) {
    setExtracted(prev => ({ ...prev, actions: prev.actions.map((item, i) => i === index ? { ...item, [field]: value } : item) }))
  }

  function removeAction(index) {
    setExtracted(prev => ({ ...prev, actions: prev.actions.filter((_, i) => i !== index) }))
  }

  return (
    <div className="transcript-view">
      <div className="transcript-card">
        <h2>New Meeting</h2>
        <p>Paste your transcript and we'll extract action items automatically.</p>

        <div className="field-row">
          <div className="field">
            <label>Meeting Name (optional)</label>
            <input type="text" value={meetingName} onChange={e => setMeetingName(e.target.value)} placeholder="e.g. Sales Sync 23 Apr" />
          </div>
          <div className="field">
            <label>Board</label>
            {!showNewBoard ? (
              <select value={selectedBoard} onChange={e => { if (e.target.value === '__new__') setShowNewBoard(true); else setSelectedBoard(e.target.value) }}>
                <option value="">No board</option>
                {boards.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                <option value="__new__">+ Create new board</option>
              </select>
            ) : (
              <div style={{ display: 'flex', gap: '6px' }}>
                <input autoFocus value={newBoardName} onChange={e => setNewBoardName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateBoard()} placeholder="Board name" />
                <button className="btn-primary" onClick={handleCreateBoard}>Add</button>
                <button className="btn-secondary" onClick={() => setShowNewBoard(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        <div className="field">
          <label>Transcript</label>
          <textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Paste your meeting transcript here..." rows={10} />
        </div>

        {error && <div className="error-msg">{error}</div>}

        {loading && (
          <div className="progress-box">
            <div className="progress-header">
              <span className="progress-label">Extracting actions</span>
              <span className="progress-count">{progressCount} found</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: progressCount > 0 ? `${Math.min(progressCount * 10, 95)}%` : '15%' }} />
            </div>
            {progress.length > 0 && (
              <div className="progress-log" ref={progressRef}>
                {progress.map((title, i) => (
                  <div key={i} className={`progress-item ${i === progress.length - 1 ? 'progress-item-latest' : ''}`}>
                    <span className="progress-tick">✓</span> {title}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!extracted && !loading && (
          <button className="btn-primary full-width" onClick={handleExtract} disabled={!transcript.trim()}>
            Extract Actions with AI
          </button>
        )}

        {extracted && (
          <div className="extracted-section">
            <div className="extracted-header">
              <h3>{extracted.actions.length} action{extracted.actions.length !== 1 ? 's' : ''} found</h3>
              <button className="btn-secondary small" onClick={() => setExtracted(null)}>Re-extract</button>
            </div>

            <div className="field">
              <label>Client (inferred from transcript)</label>
              <input value={extracted.client || ''} onChange={e => setExtracted(prev => ({ ...prev, client: e.target.value }))} placeholder="Client name or leave blank" />
            </div>

            {extracted.actions.map((action, i) => (
              <div key={i} className="extracted-card">
                <div className="extracted-card-header">
                  <span className="extracted-num">{i + 1}</span>
                  <button className="remove-btn" onClick={() => removeAction(i)}>✕</button>
                </div>
                <div className="field">
                  <label>Action</label>
                  <input value={action.title} onChange={e => updateAction(i, 'title', e.target.value)} />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Owners</label>
                    <input value={(action.owners || []).join(', ')} onChange={e => updateAction(i, 'owners', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="Names, comma separated" />
                  </div>
                  <div className="field">
                    <label>Due Date</label>
                    <input type="date" value={action.due_date || ''} onChange={e => updateAction(i, 'due_date', e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label>Comments</label>
                  <input value={action.comments || ''} onChange={e => updateAction(i, 'comments', e.target.value)} placeholder="Optional notes" />
                </div>
              </div>
            ))}

            <div className="actions-summary">
              <div className="actions-summary-header">
                <h4>Action Summary</h4>
                <button className="btn-secondary small" onClick={() => {
                  const rows = extracted.actions.map(a => `${a.title}\t${a.owner || '-'}\t${formatDate(a.due_date)}`).join('\n')
                  navigator.clipboard.writeText(`Action\tOwner\tDue Date\n${rows}`)
                }}>Copy for email</button>
              </div>
              <table className="summary-table">
                <thead>
                  <tr><th>Action</th><th>Owner</th><th>Due Date</th></tr>
                </thead>
                <tbody>
                  {extracted.actions.map((a, i) => (
                    <tr key={i}><td>{a.title}</td><td>{a.owner || '-'}</td><td>{formatDate(a.due_date)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="btn-primary full-width" onClick={handleSave} disabled={saving || extracted.actions.length === 0}>
              {saving ? 'Saving to board...' : `Add ${extracted.actions.length} action${extracted.actions.length !== 1 ? 's' : ''} to board`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
