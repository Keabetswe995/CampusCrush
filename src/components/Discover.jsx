import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Heart, RefreshCw, PauseCircle } from 'lucide-react'
import { supabase } from '../supabase'
import { DAILY_LIMIT } from '../lib/constants'
import ProfileFeed from './ProfileFeed'
import MatchModal from './MatchModal'

export async function attachPhotos(rows) {
  const ids = rows.map((p) => p.id)
  const byUser = {}
  if (ids.length) {
    const { data: ph } = await supabase.from('photos').select('user_id,path,position').in('user_id', ids).order('position')
    ;(ph || []).forEach((r) => { (byUser[r.user_id] = byUser[r.user_id] || []).push(r.path) })
  }
  return rows.map((p) => ({ ...p, photos: byUser[p.id] || [] }))
}

const kmLabel = (km) => (km >= 1000 ? 'All of SA' : `${km} km`)
const same = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()

export default function Discover({ uid, profile, onProfileChange, onOpenChat }) {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [left, setLeft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [match, setMatch] = useState(null)
  const [onlyUni, setOnlyUni] = useState(false)
  const [onlyCity, setOnlyCity] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [km, setKm] = useState(profile.max_distance_km)
  const [boost, setBoost] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase.rpc('discover_profiles', { lim: 20 })
    if (error) { setError(error.message); setLoading(false); return }
    setPeople(await attachPhotos(data))
    const { data: l, error: likesError } = await supabase.rpc('likes_left')
    if (likesError) { setError(likesError.message); setLeft(null) }
    else setLeft(typeof l === 'number' ? l : null)
    const { data: b, error: boostError } = await supabase.from('profile_boosts')
      .select('remaining,active_until').eq('user_id', uid).maybeSingle()
    if (boostError) setError(boostError.message)
    else setBoost(b || { remaining: 0, active_until: null })
    setLoading(false)
  }, [uid])

  useEffect(() => { load() }, [load])

  const visible = people.filter((p) =>
    (!onlyUni || same(p.university, profile.university)) && (!onlyCity || same(p.city, profile.city)))
  const p = visible[0]

  useEffect(() => { document.querySelector('.content')?.scrollTo({ top: 0 }) }, [p?.id])

  const drop = (id) => setPeople((ps) => ps.filter((x) => x.id !== id))

  async function like() {
    if (!p || busy) return
    setBusy(true); setError('')
    const { data, error } = await supabase.rpc('like_user', { target: p.id })
    setBusy(false)
    if (error) {
      const limit = error.message.includes('DAILY_LIMIT')
      setError(limit ? `You have used all ${DAILY_LIMIT} like credits for today. They refresh at midnight.` : error.message)
      if (limit) setLeft(0)
      return
    }
    setLeft(data.remaining)
    drop(p.id)
    if (data.matched) setMatch({ ...p, match_id: data.match_id })
  }

  async function pass() {
    if (!p || busy) return
    setBusy(true); setError('')
    const { error } = await supabase.from('passes')
      .upsert({ from_user: uid, to_user: p.id, created_at: new Date().toISOString() })
    setBusy(false)
    if (error) { setError(`Could not pass on this profile: ${error.message}`); return }
    drop(p.id)
  }

  async function block() {
    if (!p || !window.confirm(`Block ${p.name}? You will never see each other again.`)) return
    const { error } = await supabase.rpc('block_user', { target: p.id })
    if (error) setError(error.message); else drop(p.id)
  }

  async function report() {
    const reason = window.prompt(`What is wrong with ${p.name}'s profile?`)
    if (!reason || reason.trim().length < 3) return
    const { error } = await supabase.from('reports').insert({ reporter: uid, reported: p.id, reason: reason.trim() })
    window.alert(error ? error.message : 'Thanks, we will look into it. You can also block this person.')
  }

  async function applyKm() {
    const { error } = await supabase.from('profiles').update({ max_distance_km: Number(km) }).eq('id', uid)
    if (error) { setError(error.message); return }
    setSheet(false)
    await onProfileChange()
    load()
  }

  async function activateBoost() {
    setBusy(true); setError('')
    const { data, error } = await supabase.rpc('activate_profile_boost')
    setBusy(false)
    if (error) { setError(error.message); return }
    setBoost((current) => ({ ...current, remaining: data.remaining, active_until: data.active_until }))
    load()
  }

  async function resume() {
    const { error } = await supabase.from('profiles').update({ paused: false }).eq('id', uid)
    if (error) { setError(error.message); return }
    onProfileChange()
  }

  const boostActive = boost?.active_until && new Date(boost.active_until).getTime() > Date.now()

  return (
    <div className="discover">
      <div className="chips-bar" aria-label="Discovery filters">
        <button className="fchip" onClick={() => { setKm(profile.max_distance_km); setSheet(true) }}>
          Distance: {kmLabel(profile.max_distance_km)} <ChevronDown size={16} />
        </button>
        <button className={`fchip ${onlyUni ? 'on' : ''}`} aria-pressed={onlyUni} onClick={() => setOnlyUni(!onlyUni)}>My university</button>
        <button className={`fchip ${onlyCity ? 'on' : ''}`} aria-pressed={onlyCity} onClick={() => setOnlyCity(!onlyCity)}>My city</button>
        {boostActive ? (
          <span className="fchip on" role="status">✨ Boost active</span>
        ) : (
          <button className="fchip" onClick={activateBoost} disabled={busy || !boost?.remaining}
            title="Your free boost highlights your profile to people who match your preferences">
            ✨ {boost?.remaining ? 'Use free boost' : 'Boost used'}
          </button>
        )}
        <span className="likes-pill" title="Daily like credits remaining"><Heart size={14} fill="currentColor" /> {left ?? '–'} credits</span>
      </div>

      {profile.paused && (
        <div className="notice">
          <PauseCircle size={20} />
          <span>Your profile is paused. New people can't see you.</span>
          <button className="link" onClick={resume}>Resume</button>
        </div>
      )}
      {error && <p className="alert error" role="alert">{error}</p>}

      {loading ? (
        <div className="empty"><div className="spinner" /><p className="muted">Finding people near you…</p></div>
      ) : !p ? (
        <div className="empty card">
          <div className="big-emoji">🌍</div>
          <h3 className="serif">{people.length ? 'Nobody matches those filters' : "You've seen everyone nearby"}</h3>
          <p className="muted">{people.length ? 'Try turning a filter off.' : 'Widen your distance, or check back later. New students join every day.'}</p>
          {people.length > 0
            ? <button className="btn primary" onClick={() => { setOnlyUni(false); setOnlyCity(false) }}>Clear filters</button>
            : <button className="btn primary" onClick={load}><RefreshCw size={16} /> Look again</button>}
        </div>
      ) : (
        <ProfileFeed key={p.id} person={p} canLike={left !== 0} busy={busy}
          onLike={like} onPass={pass} onBlock={block} onReport={report} />
      )}

      {sheet && (
        <div className="modal sheet-wrap" onClick={() => setSheet(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Maximum distance" onClick={(e) => e.stopPropagation()}>
            <h3 className="serif">Maximum distance</h3>
            <p className="km-big">{kmLabel(Number(km))}</p>
            <input type="range" min="5" max="1000" step="5" value={km} onChange={(e) => setKm(e.target.value)} className="range" aria-label="Maximum distance in kilometres" />
            <div className="range-labels"><span>Close by</span><span>Anywhere in SA</span></div>
            <button className="btn primary big" onClick={applyKm}>Apply</button>
          </div>
        </div>
      )}

      {match && <MatchModal match={match} onClose={() => setMatch(null)}
        onChat={(id) => { setMatch(null); onOpenChat(id) }} />}
    </div>
  )
}
