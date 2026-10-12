import { useRef, useState } from 'react'
import { Heart, X, GraduationCap, MapPin, Cake, Navigation, MoreHorizontal, Ban, Flag, Ruler } from 'lucide-react'
import PrivatePhoto from './PrivatePhoto'
import {
  ageFrom, choiceLabel, GENDER_IDENTITIES, ORIENTATIONS, DATING_INTENTIONS,
} from '../lib/constants'

// A person's profile as a scrolling feed of photo and info cards. Every card has its own heart.
export default function ProfileFeed({ person, canLike, busy, onLike, onPass, onBlock, onReport }) {
  const [menu, setMenu] = useState(false)
  const swipeStart = useRef(null)
  const suppressClick = useRef(false)
  const isNew = person.created_at && Date.now() - new Date(person.created_at).getTime() < 7 * 86400000

  function startSwipe(event) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    if (event.target.closest('button, a, input, textarea, select, [role="dialog"]')) return
    swipeStart.current = { x: event.clientX, y: event.clientY }
  }

  function finishSwipe(event) {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || busy) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 1.25) return
    suppressClick.current = true
    window.setTimeout(() => { suppressClick.current = false }, 0)
    if (dx > 0) {
      if (canLike) onLike()
    } else {
      onPass()
    }
  }

  function suppressSwipeClick(event) {
    if (!suppressClick.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick.current = false
  }

  const Fab = () => (
    <button className="heart-fab" onClick={onLike} disabled={!canLike || busy} aria-label={`Like ${person.name}`}>
      <Heart size={22} fill="currentColor" />
    </button>
  )

  const cards = []
  if (person.bio) {
    cards.push(
      <div className="card prompt" key="bio">
        <small>About me</small>
        <p className="serif prompt-text">{person.bio}</p>
        <Fab />
      </div>
    )
  }
  if (person.music_preferences?.length) {
    cards.push(
      <div className="card prompt" key="music">
        <small>My music</small>
        <div className="chips">{person.music_preferences.map((genre) => <span className="chip static" key={genre}>{genre}</span>)}</div>
        <Fab />
      </div>
    )
  }
  cards.push(
    <div className="card" key="facts">
      <ul className="facts">
        <li><Cake size={20} /> {ageFrom(person.birth_date)}</li>
        <li><GraduationCap size={20} /> {person.university}</li>
        <li><MapPin size={20} /> {person.city}</li>
        {person.gender_identity && person.gender_identity !== 'prefer_not_to_say' && (
          <li>{choiceLabel(GENDER_IDENTITIES, person.gender_identity)}</li>
        )}
        {person.show_orientation && person.orientation && person.orientation !== 'prefer_not_to_say' && (
          <li>{choiceLabel(ORIENTATIONS, person.orientation)}</li>
        )}
        {person.height_cm && <li><Ruler size={20} /> {person.height_cm} cm</li>}
        {person.dating_intention && <li>{choiceLabel(DATING_INTENTIONS, person.dating_intention)}</li>}
        {person.smoking && <li>Smoking: {person.smoking}</li>}
        {person.drinking && <li>Drinking: {person.drinking}</li>}
        {person.distance_km != null && (
          <li><Navigation size={20} /> {person.distance_km <= 1 ? 'Less than 1 km away' : `${person.distance_km} km away`}</li>
        )}
      </ul>
    </div>
  )
  if (person.interests?.length) {
    cards.push(
      <div className="card prompt" key="int">
        <small>I'm into</small>
        <div className="chips">{person.interests.map((i) => <span className="chip static" key={i}>{i}</span>)}</div>
        <Fab />
      </div>
    )
  }

  const items = []
  person.photos.forEach((path, i) => {
    items.push(
      <figure className="feed-photo" key={path}>
        <PrivatePhoto path={path} alt={`${person.name}, photo ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} />
        <Fab />
      </figure>
    )
    if (cards[i]) items.push(cards[i])
  })
  for (let i = person.photos.length; i < cards.length; i++) items.push(cards[i])

  return (
    <div className="feed" onPointerDown={startSwipe} onPointerUp={finishSwipe}
      onPointerCancel={() => { swipeStart.current = null }} onClickCapture={suppressSwipeClick}>
      <header className="who">
        <div>
          <h2 className="serif name">{person.name}</h2>
          {isNew && <span className="pill plum">New here</span>}
          {person.active_now && <span className="active-pill"><i /> Active now</span>}
        </div>
        <div className="menu-wrap">
          <button className="icon-btn" onClick={() => setMenu(!menu)} aria-label="More options"><MoreHorizontal size={24} /></button>
          {menu && (
            <div className="menu sticker">
              <button onClick={() => { setMenu(false); onReport() }}><Flag size={16} /> Report</button>
              <button className="danger" onClick={() => { setMenu(false); onBlock() }}><Ban size={16} /> Block</button>
            </div>
          )}
        </div>
      </header>
      {items}
      <div className="pass-wrap">
        <button className="pass-fab" onClick={onPass} disabled={busy} aria-label={`Pass on ${person.name}`}><X size={26} /></button>
        <span className="swipe-hint" aria-hidden="true">Swipe right to like · left to pass</span>
      </div>
    </div>
  )
}
