import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, LogOut, Trash2, Download, KeyRound, Mail } from 'lucide-react'
import { supabase } from '../supabase'
import { authErrorMessage } from '../lib/authErrors'
import Switch from './Switch'
import { useTheme } from './ThemeToggle'
import InfoPage, { INFO_TITLES } from './InfoPage'
import BlockList from './BlockList'
import { deleteAccountData } from '../lib/account'

export default function Settings({ uid, email, profile, photos, sub, setSub, onProfileChange }) {
  const [theme, setTheme] = useTheme()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [distance, setDistance] = useState(profile.max_distance_km || 50)
  const [minAge, setMinAge] = useState(profile.min_age || 18)
  const [maxAge, setMaxAge] = useState(profile.max_age || 99)

  useEffect(() => {
    setDistance(profile.max_distance_km || 50)
    setMinAge(profile.min_age || 18)
    setMaxAge(profile.max_age || 99)
  }, [profile.max_distance_km, profile.min_age, profile.max_age])

  const page = sub.page
  const back = () => setSub(sub.back ? { page: sub.back, back: null } : null)
  const open = (p) => setSub({ page: p, back: 'main' })

  async function togglePause(on) {
    setError('')
    const { error } = await supabase.from('profiles').update({ paused: on }).eq('id', uid)
    if (error) setError(error.message); else onProfileChange()
  }

  async function saveDistance() {
    setError(''); setMsg('')
    const [profileUpdate, preferenceUpdate] = await Promise.all([
      supabase.from('profiles').update({ max_distance_km: Number(distance) }).eq('id', uid),
      supabase.from('profile_private').update({ min_age: Number(minAge), max_age: Number(maxAge) }).eq('user_id', uid),
    ])
    const error = profileUpdate.error || preferenceUpdate.error
    if (error) setError(error.message)
    else { setMsg('Your discovery preferences were saved.'); await onProfileChange() }
  }

  async function changePassword() {
    setError(''); setMsg('')
    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      if (error) throw error
      setMsg('We emailed you a link to choose a new password.')
    } catch (error) {
      setError(authErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function downloadData() {
    setBusy(true); setError(''); setMsg('')
    try {
      const [prof, privateProfile, ph, likes, matches, messages, blocks] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', uid),
        supabase.from('profile_private').select('*').eq('user_id', uid),
        supabase.from('photos').select('*').eq('user_id', uid),
        supabase.from('likes').select('*').eq('from_user', uid),
        supabase.from('matches').select('*'),
        supabase.from('messages').select('*'),
        supabase.from('blocks').select('*').eq('blocker', uid),
      ])
      const data = {
        exported_at: new Date().toISOString(), email,
        profile: prof.data, private_profile: privateProfile.data, photos: ph.data, likes_sent: likes.data,
        matches: matches.data, messages: messages.data, blocked: blocks.data,
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url; a.download = 'my-campuscrush-data.json'; a.click()
      URL.revokeObjectURL(url)
      setMsg('Your data was downloaded.')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function deleteAccount() {
    const typed = window.prompt('This permanently deletes your profile, photos, matches and chats.\n\nType DELETE to confirm.')
    if (typed !== 'DELETE') return
    setBusy(true); setError('')
    try {
      await deleteAccountData(uid)
    } catch (e) {
      setError(e.message || 'Could not delete your account. Try again.')
      setBusy(false)
    }
  }

  const title = page === 'main' ? 'Settings' : page === 'blocks' ? 'Block list' : INFO_TITLES[page]

  return (
    <div className="settings">
      <header className="sub-head">
        <button className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft size={22} /></button>
        <b>{title}</b><span style={{ width: 34 }} />
      </header>
      <div className="content">
        {page === 'blocks' && <BlockList uid={uid} />}
        {INFO_TITLES[page] && <InfoPage kind={page} />}

        {page === 'main' && (
          <div className="page">
            {error && <p className="alert error" role="alert">{error}</p>}
            {msg && <p className="alert ok" role="status">{msg}</p>}

            <h4 className="group">Discovery preferences</h4>
            <div className="list-card pad-rows">
              <div className="switch-row">
                <div className="field">
                  <span>Maximum distance <b className="km">{distance >= 1000 ? 'All of South Africa' : `${distance} km`}</b></span>
                  <input type="range" min="5" max="1000" step="5" value={distance}
                    onChange={(e) => setDistance(e.target.value)} className="range"
                    aria-label="Maximum distance for profiles" />
                  <div className="range-labels"><span>Close by</span><span>Anywhere in SA</span></div>
                  <small className="muted">Only show people within this distance.</small>
                  <button className="btn ghost small-btn" onClick={saveDistance}>Save preferences</button>
                </div>
              </div>
              <div className="switch-row">
                <div className="field">
                  <span>Age range <b className="km">{minAge}–{maxAge === 99 ? '99+' : maxAge}</b></span>
                  <input type="range" min="18" max="99" value={minAge}
                    onChange={(e) => setMinAge(Math.min(Number(e.target.value), Number(maxAge)))}
                    className="range" aria-label="Minimum age" />
                  <div className="range-labels"><span>Minimum age</span><span>{minAge}</span></div>
                  <input type="range" min="18" max="99" value={maxAge}
                    onChange={(e) => setMaxAge(Math.max(Number(e.target.value), Number(minAge)))}
                    className="range" aria-label="Maximum age" />
                  <div className="range-labels"><span>Maximum age</span><span>{maxAge === 99 ? '99+' : maxAge}</span></div>
                  <small className="muted">You’ll only see adults in your selected age range.</small>
                </div>
              </div>
            </div>

            <h4 className="group">Appearance</h4>
            <div className="list-card pad-rows">
              <Switch label="Dark mode" hint="Easier on the eyes at night." checked={theme === 'dark'}
                onChange={(on) => setTheme(on ? 'dark' : 'light')} />
            </div>

            <h4 className="group">Profile</h4>
            <div className="list-card pad-rows">
              <Switch label="Pause" hint="Pausing stops your profile being shown to new people. You can still chat with current matches."
                checked={!!profile.paused} onChange={togglePause} />
            </div>

            <h4 className="group">Safety</h4>
            <div className="list-card">
              <button className="row-link" onClick={() => open('blocks')}><span><b>Block list</b><small>Block people you know. They won't see you and you won't see them.</small></span><ChevronRight size={20} /></button>
              <button className="row-link" onClick={() => open('tips')}><span><b>Safe dating tips</b></span><ChevronRight size={20} /></button>
              <button className="row-link" onClick={() => open('principles')}><span><b>Member principles</b></span><ChevronRight size={20} /></button>
            </div>

            <h4 className="group">Email and password</h4>
            <div className="list-card">
              <div className="row-link static"><Mail size={20} /><span><b>{email}</b></span></div>
              <button className="row-link" onClick={changePassword} disabled={busy}><KeyRound size={20} /><span><b>Change password</b><small>{busy ? 'Sending…' : 'We will email you a link.'}</small></span><ChevronRight size={20} /></button>
            </div>

            <h4 className="group">Legal and data</h4>
            <div className="list-card">
              <button className="row-link" onClick={() => open('privacy')}><span><b>Privacy Policy</b></span><ChevronRight size={20} /></button>
              <button className="row-link" onClick={() => open('terms')}><span><b>Terms of Service</b></span><ChevronRight size={20} /></button>
              <button className="row-link" onClick={downloadData} disabled={busy}><Download size={20} /><span><b>Download my data</b></span><ChevronRight size={20} /></button>
            </div>

            <div className="list-card gap-top">
              <button className="row-link center-link" onClick={() => supabase.auth.signOut()}><LogOut size={18} /> Log out</button>
              <button className="row-link center-link danger" onClick={deleteAccount} disabled={busy}><Trash2 size={18} /> Delete account</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
