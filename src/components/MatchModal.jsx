import { PartyPopper } from 'lucide-react'
import PrivatePhoto from './PrivatePhoto'

export default function MatchModal({ match, onClose, onChat }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="It's a match">
      <div className="sticker match-card">
        <div className="confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--i': i }}>💜</i>)}</div>
        <PartyPopper size={36} />
        <h2 className="serif">It's a match</h2>
        <p>You and <b>{match.name}</b> liked each other.</p>
        {match.photos[0] && <PrivatePhoto className="match-pic" path={match.photos[0]} alt="" />}
        <div className="row">
          <button className="btn ghost" onClick={onClose}>Keep going</button>
          <button className="btn primary" onClick={() => onChat(match.match_id)}>Send a message</button>
        </div>
      </div>
    </div>
  )
}
