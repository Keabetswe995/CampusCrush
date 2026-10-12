import { useState } from 'react'
import { MapPin, GraduationCap, Save, LocateFixed } from 'lucide-react'
import { supabase } from '../supabase'
import {
  UNIVERSITIES, CITIES, INTERESTS, maxBirthDate, cityCoords,
  GENDER_IDENTITIES, ORIENTATIONS, INTERESTED_GENDERS, DATING_INTENTIONS,
  MUSIC_GENRES, SMOKING_OPTIONS, DRINKING_OPTIONS,
} from '../lib/constants'

export default function ProfileForm({ uid, profile, onSaved, submitLabel = 'Save profile' }) {
  const [name, setName] = useState(profile?.name || '')
  const [birth, setBirth] = useState(profile?.birth_date || '')
  const [university, setUniversity] = useState(profile?.university || '')
  const [city, setCity] = useState(profile?.city || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [interests, setInterests] = useState(profile?.interests || [])
  const [genderIdentity, setGenderIdentity] = useState(profile?.gender_identity || '')
  const [orientation, setOrientation] = useState(profile?.orientation || '')
  const [interestedIn, setInterestedIn] = useState(profile?.interested_in || [])
  const [minAge, setMinAge] = useState(profile?.min_age || 18)
  const [maxAge, setMaxAge] = useState(profile?.max_age || 99)
  const [showOrientation, setShowOrientation] = useState(profile?.show_orientation ?? false)
  const [heightCm, setHeightCm] = useState(profile?.height_cm || '')
  const [datingIntention, setDatingIntention] = useState(profile?.dating_intention || 'open_to_seeing')
  const [music, setMusic] = useState(profile?.music_preferences || [])
  const [smoking, setSmoking] = useState(profile?.smoking || 'Prefer not to say')
  const [drinking, setDrinking] = useState(profile?.drinking || 'Prefer not to say')
  const [km, setKm] = useState(profile?.max_distance_km || 50)
  const [gps, setGps] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const toggle = (i) =>
    setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : cur.length < 8 ? [...cur, i] : cur))

  const toggleSelection = (setter, selected, option, max = Infinity) => {
    setter(selected.includes(option)
      ? selected.filter((item) => item !== option)
      : selected.length < max ? [...selected, option] : selected)
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError('Your browser cannot share location.')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Rounded to ~1 km so your exact spot is never stored.
        setGps([+pos.coords.latitude.toFixed(2), +pos.coords.longitude.toFixed(2)])
        setError('')
      },
      () => setError('Location was blocked. You can still pick your city instead.'),
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }

  async function submit(e) {
    e.preventDefault()
    setError(''); setSaved(false)
    if (!birth) return setError('Please enter your date of birth.')
    if (birth > maxBirthDate()) return setError('You must be 18 or older to use CampusCrush.')
    if (!genderIdentity || !orientation) return setError('Choose your gender identity and orientation.')
    if (interestedIn.length === 0) return setError('Choose at least one gender you are interested in.')
    if (heightCm && (Number(heightCm) < 120 || Number(heightCm) > 230)) return setError('Enter a height between 120 and 230 cm.')
    setBusy(true)
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: uid, name: name.trim(), birth_date: birth, university: university.trim(),
        city: city.trim(), bio: bio.trim(), interests, max_distance_km: Number(km),
        gender_identity: genderIdentity, show_orientation: showOrientation,
        height_cm: heightCm ? Number(heightCm) : null, dating_intention: datingIntention,
        music_preferences: music, smoking, drinking,
      })
      if (error) throw error
      const privateProfile = await supabase.from('profile_private')
        .upsert({
          user_id: uid, orientation, interested_in: interestedIn,
          min_age: Number(minAge), max_age: Number(maxAge),
        }).select('user_id').single()
      if (privateProfile.error) throw privateProfile.error
      const coords = gps || cityCoords(city)
      if (coords) {
        const loc = await supabase.from('profile_locations').upsert({ user_id: uid, lat: coords[0], lng: coords[1] })
        if (loc.error) throw loc.error
      }
      setSaved(true)
      await onSaved()
    } catch (err) {
      setError(err.message || 'Could not save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <label className="field"><span>First name</span>
        <input required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Thando" />
      </label>

      <label className="field"><span>Gender identity</span>
        <select required value={genderIdentity} onChange={(e) => setGenderIdentity(e.target.value)}>
          <option value="" disabled>Choose your gender identity</option>
          {GENDER_IDENTITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      <label className="field"><span>Sexual orientation</span>
        <select required value={orientation} onChange={(e) => setOrientation(e.target.value)}>
          <option value="" disabled>Choose your orientation</option>
          {ORIENTATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={showOrientation} onChange={(e) => setShowOrientation(e.target.checked)} />
        <span>Show my orientation on my profile</span>
      </label>

      <div className="field">
        <span>Who would you like to meet?</span>
        <div className="chips">
          {INTERESTED_GENDERS.map(([value, label]) => (
            <button type="button" key={value} className={`chip ${interestedIn.includes(value) ? 'on' : ''}`}
              aria-pressed={interestedIn.includes(value)}
              onClick={() => toggleSelection(setInterestedIn, interestedIn, value)}>
              {label}
            </button>
          ))}
        </div>
        <small className="muted">You will only see people who are also interested in your gender identity.</small>
      </div>

      <label className="field"><span>Date of birth</span>
        <input type="date" required max={maxBirthDate()} value={birth} onChange={(e) => setBirth(e.target.value)} />
        <small className="muted">Only your age is shown to others.</small>
      </label>

      <label className="field"><span>Height (cm)</span>
        <input type="number" min="120" max="230" inputMode="numeric" value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)} placeholder="Optional" />
      </label>

      <label className="field"><span>Dating intentions</span>
        <select value={datingIntention} onChange={(e) => setDatingIntention(e.target.value)}>
          {DATING_INTENTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      <label className="field"><span>University</span>
        <div className="input-icon"><GraduationCap size={18} />
          <input required list="unis" value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="Start typing…" />
        </div>
        <datalist id="unis">{UNIVERSITIES.map((u) => <option key={u} value={u} />)}</datalist>
      </label>

      <label className="field"><span>City</span>
        <div className="input-icon"><MapPin size={18} />
          <input required list="cities" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Where do you study?" />
        </div>
        <datalist id="cities">{Object.keys(CITIES).map((c) => <option key={c} value={c} />)}</datalist>
      </label>

      <div className="field">
        <span>How far should we look? <b className="km">{km >= 1000 ? 'All of South Africa' : `${km} km`}</b></span>
        <input type="range" min="5" max="1000" step="5" value={km} onChange={(e) => setKm(e.target.value)} className="range" />
        <div className="range-labels"><span>Close by</span><span>Anywhere in SA</span></div>
        <button type="button" className="btn ghost small-btn" onClick={useMyLocation}>
          <LocateFixed size={16} /> {gps ? 'Location saved for this update' : 'Use my current location'}
        </button>
        <small className="muted">Otherwise we use your city. Other people only see how many km away you are.</small>
      </div>

      <label className="field"><span>About you</span>
        <textarea rows={4} maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)}
          placeholder="Study life, favourite braai snack, your type of Sunday…" />
        <small className="muted">{bio.length}/300</small>
      </label>

      <div className="field"><span>Your interests <small className="muted">(pick up to 8)</small></span>
        <div className="chips">
          {INTERESTS.map((i) => (
            <button type="button" key={i} className={`chip ${interests.includes(i) ? 'on' : ''}`}
              aria-pressed={interests.includes(i)} onClick={() => toggle(i)}>{i}</button>
          ))}
        </div>
      </div>

      <div className="field"><span>Music <small className="muted">(pick up to 5)</small></span>
        <div className="chips">
          {MUSIC_GENRES.map((genre) => (
            <button type="button" key={genre} className={`chip ${music.includes(genre) ? 'on' : ''}`}
              aria-pressed={music.includes(genre)}
              onClick={() => toggleSelection(setMusic, music, genre, 5)}>{genre}</button>
          ))}
        </div>
      </div>

      <label className="field"><span>Smoking</span>
        <select value={smoking} onChange={(e) => setSmoking(e.target.value)}>
          {SMOKING_OPTIONS.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>

      <label className="field"><span>Drinking</span>
        <select value={drinking} onChange={(e) => setDrinking(e.target.value)}>
          {DRINKING_OPTIONS.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>

      {error && <p className="alert error" role="alert">{error}</p>}
      {saved && <p className="alert ok" role="status">Saved!</p>}
      <button className="btn primary big" disabled={busy}><Save size={18} /> {busy ? 'Saving…' : submitLabel}</button>
    </form>
  )
}
