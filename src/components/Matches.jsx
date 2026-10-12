import { useEffect, useState, useCallback } from 'react'
import { MessageCircle } from 'lucide-react'
import { supabase } from '../supabase'
import { ageFrom } from '../lib/constants'
import PrivatePhoto from './PrivatePhoto'

export async function loadMatches(uid) {
  const { data: ms, error: matchesError } = await supabase.from('matches').select('*').order('created_at', { ascending: false })
  if (matchesError) throw matchesError
  if (!ms?.length) return []
  const otherIds = ms.map((m) => (m.user_a === uid ? m.user_b : m.user_a))
  const mids = ms.map((m) => m.id)
  const [profiles, photosResult, messages] = await Promise.all([
    supabase.rpc('matched_profiles'),
    supabase.from('photos').select('user_id,path,position').in('user_id', otherIds).order('position'),
    supabase.from('messages').select('match_id,body,created_at,sender_id').in('match_id', mids)
      .order('created_at', { ascending: false }).limit(500),
  ])
  const failed = [profiles, photosResult, messages].find((result) => result.error)
  if (failed?.error) throw failed.error
  const profs = profiles.data
  const phs = photosResult.data
  const msgs = messages.data
  const pmap = Object.fromEntries((profs || []).map((p) => [p.id, p]))
  const photosByUser = {}
  ;(phs || []).forEach((r) => { (photosByUser[r.user_id] = photosByUser[r.user_id] || []).push(r.path) })
  const last = {}
  ;(msgs || []).forEach((m) => { if (!last[m.match_id]) last[m.match_id] = m })
  return ms
    .map((m) => {
      const oid = m.user_a === uid ? m.user_b : m.user_a
      return { id: m.id, created_at: m.created_at, other: pmap[oid], photos: photosByUser[oid] || [], last: last[m.id] }
    })
    .filter((m) => m.other)
}

export default function Matches({ uid, onOpen }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try { setItems(await loadMatches(uid)); setError('') }
    catch (err) { setItems([]); setError(`Could not load matches: ${err.message}`) }
  }, [uid])
  useEffect(() => { refresh() }, [refresh])

  return (
    <div className="page">
      <header className="page-head"><h2 className="serif">Matches</h2></header>
      {error && <p className="alert error" role="alert">{error}</p>}
      {items === null ? (
        <div className="empty"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="empty sticker">
          <div className="big-emoji">💌</div>
          <h3 className="serif">No matches yet</h3>
          <p className="muted">When someone you like likes you back, they will show up here and you can chat.</p>
        </div>
      ) : (
        <ul className="match-list">
          {items.map((m) => (
            <li key={m.id}>
              <button className="match-row" onClick={() => onOpen(m)}>
                {m.photos[0] ? <PrivatePhoto path={m.photos[0]} alt="" /> : <span className="avatar-fallback">{m.other.name[0]}</span>}
                <span className="match-text">
                  <b>{m.other.name}, {ageFrom(m.other.birth_date)}</b>
                  <span className="muted">{m.last ? m.last.body : `Matched! Say hi 👋`}</span>
                </span>
                <MessageCircle size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
