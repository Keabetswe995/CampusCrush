import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../supabase'
import PrivatePhoto from './PrivatePhoto'
import { ageFrom } from '../lib/constants'
import { attachPhotos } from './Discover'
import ProfileFeed from './ProfileFeed'
import MatchModal from './MatchModal'

export default function LikesYou({ uid, onOpenChat }) {
  const [items, setItems] = useState(null)
  const [open, setOpen] = useState(null)
  const [left, setLeft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [match, setMatch] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data, error } = await supabase.rpc('liked_me')
      if (error) { if (alive) { setError(error.message); setItems([]) } return }
      const rows = await attachPhotos(data)
      const { data: l, error: likesError } = await supabase.rpc('likes_left')
      if (alive) {
        setItems(rows)
        setLeft(likesError ? null : typeof l === 'number' ? l : null)
        if (likesError) setError(likesError.message)
      }
    })()
    return () => { alive = false }
  }, [])

  const drop = (id) => { setItems((l) => l.filter((x) => x.id !== id)); setOpen(null) }

  async function likeBack() {
    setBusy(true); setError('')
    const { data, error } = await supabase.rpc('like_user', { target: open.id })
    setBusy(false)
    if (error) { setError(error.message.includes('DAILY_LIMIT') ? 'You have used all 6 like credits for today. They refresh at midnight.' : error.message); return }
    setLeft(data.remaining)
    const person = open
    drop(person.id)
    if (data.matched) setMatch({ ...person, match_id: data.match_id })
  }

  async function pass() {
    await supabase.from('passes').upsert({ from_user: uid, to_user: open.id, created_at: new Date().toISOString() })
    drop(open.id)
  }

  async function block() {
    if (!window.confirm(`Block ${open.name}?`)) return
    const { error } = await supabase.rpc('block_user', { target: open.id })
    if (error) setError(error.message); else drop(open.id)
  }

  async function report() {
    const reason = window.prompt(`What is wrong with ${open.name}'s profile?`)
    if (!reason || reason.trim().length < 3) return
    const { error } = await supabase.from('reports').insert({ reporter: uid, reported: open.id, reason: reason.trim() })
    window.alert(error ? error.message : 'Thanks, we will look into it.')
  }

  if (open) {
    return (
      <div className="page">
        <button className="back-link" onClick={() => setOpen(null)}><ArrowLeft size={18} /> Likes You</button>
        {error && <p className="alert error" role="alert">{error}</p>}
        <ProfileFeed person={open} canLike={left !== 0} busy={busy} onLike={likeBack} onPass={pass} onBlock={block} onReport={report} />
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head"><h2 className="serif">Likes You</h2></header>
      {error && <p className="alert error" role="alert">{error}</p>}
      {items === null ? (
        <div className="empty"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="empty card">
          <div className="big-emoji">💜</div>
          <h3 className="serif">No likes waiting yet</h3>
          <p className="muted">When someone likes you, they show up here. Like them back to start a chat.</p>
        </div>
      ) : (
        <div className="likes-grid">
          {items.map((p) => (
            <button key={p.id} className="like-tile" onClick={() => setOpen(p)} aria-label={`See ${p.name}'s profile`}>
              <PrivatePhoto path={p.photos[0]} alt="" />
              <span>{p.name}, {ageFrom(p.birth_date)}</span>
            </button>
          ))}
        </div>
      )}
      {match && <MatchModal match={match} onClose={() => setMatch(null)}
        onChat={(id) => { setMatch(null); onOpenChat(id) }} />}
    </div>
  )
}
