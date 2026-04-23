import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import Board from './components/Board'
import TranscriptUpload from './components/TranscriptUpload'
import Login from './components/Login'
import './App.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [view, setView] = useState('board')
  const [actions, setActions] = useState([])
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const isDragging = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    fetchActions()
    fetchBoards()
    const channel = supabase
      .channel('actions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actions' }, () => {
        if (!isDragging.current) fetchActions()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, () => fetchBoards())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [session])

  async function fetchActions() {
    const { data, error } = await supabase.from('actions').select('*').order('created_at', { ascending: false })
    if (!error) setActions(data)
  }

  async function fetchBoards() {
    const { data } = await supabase.from('boards').select('*').order('name')
    if (data) setBoards(data)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /></div>
  if (!session) return <Login />

  const userInitials = session.user.email.slice(0, 2).toUpperCase()

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-logo">Action<span>Track</span></div>
        <div className="nav-center">
          <div className="nav-tabs">
            <button className={`nav-tab ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>Board</button>
            <button className={`nav-tab ${view === 'transcript' ? 'active' : ''}`} onClick={() => setView('transcript')}>+ New Meeting</button>
          </div>
        </div>
        <div className="nav-right">
          <div className="avatar" title={session.user.email}>{userInitials}</div>
          <button className="sign-out-btn" onClick={handleSignOut}>Sign out</button>
        </div>
      </nav>

      {view === 'board' && (
        <Board
          actions={actions}
          boards={boards}
          onUpdate={fetchActions}
          onDragStateChange={(dragging) => { isDragging.current = dragging }}
          currentUser={session.user}
        />
      )}
      {view === 'transcript' && (
        <TranscriptUpload onDone={() => { fetchActions(); setView('board') }} currentUser={session.user} />
      )}
    </div>
  )
}
