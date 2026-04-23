import { useState } from 'react'
import { supabase } from '../supabase'

export default function TranscriptUpload({ onDone, currentUser }) {
  const [transcript, setTranscript] = useState('')
  const [meetingName, setMeetingName] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleExtract() {
    if (!transcript.trim()) return
    setError('')
    setLoading(true)
    setExtracted(null)

    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY
      const today = new Date().toISOString().split('T')[0]

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that extracts action items from meeting transcripts.
Today's date is ${today}.
Return ONLY a valid JSON array. No markdown, no explanation, just raw JSON.
Each item must have:
- title: string (clear, concise action description)
- owner: string (person responsible, full name if mentioned, else null)
- due_date: string in YYYY-MM-DD format if a date or timeframe is mentioned (e.g. "by Friday", "end of month"), else null
- comments: string (any relevant context or notes, else null)

Example output:
[{"title":"Send pricing deck to client","owner":"Lewis","due_date":"2026-04-25","comments":"Include enterprise tier"}]`
            },
            {
              role: 'user',
              content: `Extract all action items from this meeting transcript:\n\n${transcript}`
            }
          ],
          temperature: 0.2
        })
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error.message)

      const raw = data.choices[0].message.content.trim()
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const actions = JSON.parse(cleaned)
      setExtracted(actions)
    } catch (err) {
      setError('Failed to extract actions. Check your API key or try again. ' + err.message)
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!extracted?.length) return
    setSaving(true)
    const source = meetingName.trim() || `Meeting ${new Date().toLocaleDateString('en-GB')}`
    const rows = extracted.map(a => ({
      title: a.title,
      owner: a.owner || null,
      due_date: a.due_date || null,
      comments: a.comments || null,
      status: 'todo',
      source_meeting: source,
      created_by: currentUser.id
    }))
    await supabase.from('actions').insert(rows)
    setSaving(false)
    onDone()
  }

  function updateExtracted(index, field, value) {
    setExtracted(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function removeExtracted(index) {
    setExtracted(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="transcript-view">
      <div className="transcript-card">
        <h2>New Meeting</h2>
        <p>Paste your transcript and we'll extract action items automatically.</p>

        <div className="field">
          <label>Meeting Name (optional)</label>
          <input
            type="text"
            value={meetingName}
            onChange={e => setMeetingName(e.target.value)}
            placeholder="e.g. Sales Sync 23 Apr"
          />
        </div>

        <div className="field">
          <label>Transcript</label>
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="Paste your meeting transcript here..."
            rows={10}
          />
        </div>

        {error && <div className="error-msg">{error}</div>}

        {!extracted && (
          <button className="btn-primary full-width" onClick={handleExtract} disabled={loading || !transcript.trim()}>
            {loading ? 'Extracting actions...' : 'Extract Actions with AI'}
          </button>
        )}

        {extracted && (
          <div className="extracted-section">
            <div className="extracted-header">
              <h3>{extracted.length} action{extracted.length !== 1 ? 's' : ''} found</h3>
              <button className="btn-secondary small" onClick={() => setExtracted(null)}>Re-extract</button>
            </div>

            {extracted.map((action, i) => (
              <div key={i} className="extracted-card">
                <div className="extracted-card-header">
                  <span className="extracted-num">{i + 1}</span>
                  <button className="remove-btn" onClick={() => removeExtracted(i)}>✕</button>
                </div>
                <div className="field">
                  <label>Action</label>
                  <input value={action.title} onChange={e => updateExtracted(i, 'title', e.target.value)} />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Owner</label>
                    <input value={action.owner || ''} onChange={e => updateExtracted(i, 'owner', e.target.value)} placeholder="Name" />
                  </div>
                  <div className="field">
                    <label>Due Date</label>
                    <input type="date" value={action.due_date || ''} onChange={e => updateExtracted(i, 'due_date', e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label>Comments</label>
                  <input value={action.comments || ''} onChange={e => updateExtracted(i, 'comments', e.target.value)} placeholder="Optional notes" />
                </div>
              </div>
            ))}

            <button className="btn-primary full-width" onClick={handleSave} disabled={saving || extracted.length === 0}>
              {saving ? 'Saving to board...' : `Add ${extracted.length} action${extracted.length !== 1 ? 's' : ''} to board`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
