import { useState } from 'react'
import { Pencil, ChevronRight, ShieldBan, BookHeart, HeartHandshake, LifeBuoy } from 'lucide-react'
import { ageFrom, SUPPORT_EMAIL } from '../lib/constants'
import PhotoManager from './PhotoManager'
import ProfileForm from './ProfileForm'
import PrivatePhoto from './PrivatePhoto'

export default function Profile({ uid, profile, photos, onChange, onOpenPage }) {
  const [tab, setTab] = useState('photos')
  const tabs = [['photos', 'Photos'], ['about', 'About me'], ['safety', 'Safety']]

  return (
    <div className="page">
      <div className="me-head">
        <button className="avatar-ring" onClick={() => setTab('photos')} aria-label="Edit photos">
          <PrivatePhoto path={photos[0].path} alt="Your main photo" />
          <span className="pencil"><Pencil size={14} /></span>
        </button>
        <h2 className="serif">{profile.name}, {ageFrom(profile.birth_date)}</h2>
        <p className="muted">{profile.university} · {profile.city}</p>
      </div>

      <div className="subtabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'photos' && (
        <section className="card">
          <PhotoManager uid={uid} photos={photos} onChange={onChange} />
        </section>
      )}
      {tab === 'about' && (
        <section className="card">
          <ProfileForm uid={uid} profile={profile} onSaved={onChange} />
        </section>
      )}
      {tab === 'safety' && (
        <div className="list-card">
          <button className="row-link" onClick={() => onOpenPage('blocks')}>
            <ShieldBan size={22} /><span><b>Block list</b><small>People you blocked can't see you and you can't see them.</small></span><ChevronRight size={20} />
          </button>
          <button className="row-link" onClick={() => onOpenPage('tips')}>
            <BookHeart size={22} /><span><b>Safe dating tips</b><small>Meet up smart and stay in control.</small></span><ChevronRight size={20} />
          </button>
          <button className="row-link" onClick={() => onOpenPage('principles')}>
            <HeartHandshake size={22} /><span><b>Member principles</b><small>How we treat each other here.</small></span><ChevronRight size={20} />
          </button>
          <a className="row-link" href={`mailto:${SUPPORT_EMAIL}?subject=CampusCrush%20safety%20report`}>
            <LifeBuoy size={22} /><span><b>Contact support</b><small>Something serious? Email us.</small></span><ChevronRight size={20} />
          </a>
        </div>
      )}
    </div>
  )
}
