import { useCallback, useEffect, useState } from 'react'
import { Compass, Heart, MessageCircle, User, Settings as Gear } from 'lucide-react'
import { supabase, configured } from './supabase'
import Logo from './components/Logo'
import ThemeToggle from './components/ThemeToggle'
import Auth, { ResetPassword } from './components/Auth'
import ProfileForm from './components/ProfileForm'
import PhotoManager from './components/PhotoManager'
import Discover from './components/Discover'
import LikesYou from './components/LikesYou'
import Matches, { loadMatches } from './components/Matches'
import Chat from './components/Chat'
import Profile from './components/Profile'
import Settings from './components/Settings'
import { MIN_DISCOVERY_PHOTOS } from './lib/constants'
import { deleteAccountData } from './lib/account'
import PrivatePhoto, { clearPrivatePhotoCache } from './components/PrivatePhoto'

function Splash({ text = 'Loading…' }) {
  return <main className="auth-page"><div className="empty"><div className="spinner" /><p className="muted">{text}</p></div></main>
}

function Setup() {
  return (
    <main className="auth-page">
      <section className="sticker auth-card">
        <Logo size={44} />
        <h1 className="serif">One quick setup step</h1>
        <p>Add your Supabase details to the hidden <code>.env</code> file, then restart <code>npm run dev</code>:</p>
        <pre className="code">{`VITE_SUPABASE_URL=https://xxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-key`}</pre>
      </section>
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [profile, setProfile] = useState(undefined) // undefined = loading, null = none yet
  const [profileLoadError, setProfileLoadError] = useState('')
  const [photos, setPhotos] = useState([])
  const [tab, setTab] = useState('discover')
  const [chat, setChat] = useState(null)
  const [sub, setSub] = useState(null) // { page, back } for settings screens
  const [deleteError, setDeleteError] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') {
        clearPrivatePhotoCache()
        setProfile(undefined); setPhotos([]); setChat(null); setSub(null); setTab('discover')
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user?.id

  const loadMe = useCallback(async () => {
    if (!uid) return
    const [
      { data: p, error: profileError },
      { data: ph, error: photosError },
      { data: privacy, error: privacyError },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('photos').select('*').eq('user_id', uid).order('position'),
      supabase.from('profile_private').select('orientation,interested_in,min_age,max_age').eq('user_id', uid).maybeSingle(),
    ])
    const error = profileError || photosError || privacyError
    if (error) { setProfileLoadError(error.message); return }
    setProfileLoadError('')
    setProfile(p ? {
      ...p, orientation: privacy?.orientation || 'prefer_not_to_say',
      interested_in: privacy?.interested_in || [], min_age: privacy?.min_age || 18,
      max_age: privacy?.max_age || 99,
    } : null)
    setPhotos(ph || [])
  }, [uid])

  useEffect(() => { loadMe() }, [loadMe])

  useEffect(() => {
    if (!uid || !profile || photos.length < MIN_DISCOVERY_PHOTOS) return
    const updatePresence = async () => {
      if (document.visibilityState !== 'visible') return
      const { error } = await supabase.rpc('touch_profile_presence')
      if (error) console.error('Could not update active status:', error.message)
    }
    updatePresence()
    const timer = window.setInterval(updatePresence, 60_000)
    document.addEventListener('visibilitychange', updatePresence)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', updatePresence)
    }
  }, [uid, profile, photos.length])

  async function openChatById(matchId) {
    const all = await loadMatches(uid)
    const m = all.find((x) => x.id === matchId)
    if (m) { setTab('matches'); setChat(m) }
  }

  async function deleteAccount() {
    const typed = window.prompt('This permanently deletes your account and all its data.\n\nType DELETE to confirm.')
    if (typed !== 'DELETE') return
    setDeleteError(''); setDeletingAccount(true)
    try {
      await deleteAccountData(uid)
    } catch (error) {
      setDeleteError(error.message || 'Could not delete your account. Try again.')
    } finally {
      setDeletingAccount(false)
    }
  }

  if (!configured) return <Setup />
  if (!ready) return <Splash />
  if (recovery) return <ResetPassword onDone={() => setRecovery(false)} />
  if (!session) return <Auth />
  if (profileLoadError) {
    const missingPrivateProfile = /profile_private|schema cache/i.test(profileLoadError)
    return (
      <main className="auth-page">
        <section className="sticker auth-card">
          <h1 className="serif">Could not load your profile</h1>
          <p className="alert error" role="alert">{profileLoadError}</p>
          <p className="muted">
            {missingPrivateProfile
              ? 'This Supabase project is missing profile_private. In Supabase SQL Editor, run the complete supabase/update_3.sql script and wait for it to finish successfully. Then run supabase/update_4.sql. Do not run update_4.sql first.'
              : 'Check your connection and make sure the latest Supabase update scripts have been run.'}
          </p>
          <button className="btn primary" onClick={loadMe}>Try again</button>
        </section>
      </main>
    )
  }
  if (profile === undefined) return <Splash text="Getting your profile…" />

  if (profile === null) {
    return (
      <main className="auth-page top">
        <ThemeToggle className="corner" />
        <section className="sticker auth-card wide">
          <Logo size={40} />
          <h1 className="serif">Tell us about you</h1>
          <p className="muted">Step 1 of 2. This is what people will see.</p>
          {deleteError && <p className="alert error" role="alert">{deleteError}</p>}
          <ProfileForm uid={uid} profile={null} onSaved={loadMe} submitLabel="Save and add photos" />
          <button className="link danger" onClick={deleteAccount} disabled={deletingAccount}>
            {deletingAccount ? 'Deleting…' : 'Delete account'}
          </button>
          <button className="link" onClick={() => supabase.auth.signOut()}>Log out</button>
        </section>
      </main>
    )
  }

  if (sub) {
    return (
      <div className="shell">
        <Settings uid={uid} email={session.user.email} profile={profile} photos={photos}
          sub={sub} setSub={setSub} onProfileChange={loadMe} />
      </div>
    )
  }

  if (photos.length < MIN_DISCOVERY_PHOTOS) {
    return (
      <main className="auth-page top">
        <ThemeToggle className="corner" />
        <section className="sticker auth-card wide">
          <Logo size={40} />
          <h1 className="serif">Add your best photos</h1>
          <p className="muted">Add at least {MIN_DISCOVERY_PHOTOS} photos (up to six) before you can discover people. Everyone you meet can see them.</p>
          <PhotoManager uid={uid} photos={photos} onChange={loadMe} />
          <button className="link" onClick={() => setSub({ page: 'main', back: null })}>Settings and account options</button>
        </section>
      </main>
    )
  }

  if (chat) {
    return (
      <div className="shell">
        <Chat uid={uid} match={chat} onBack={() => setChat(null)} onBlocked={() => setChat(null)} />
      </div>
    )
  }

  const tabs = [
    ['discover', 'Discover', <Compass size={24} key="d" />],
    ['likes', 'Likes You', <Heart size={24} key="l" />],
    ['matches', 'Matches', <MessageCircle size={24} key="m" />],
    ['profile', 'Profile', photos[0]
      ? <PrivatePhoto className="nav-avatar" path={photos[0].path} alt="" key="p" />
      : <User size={24} key="p" />],
  ]

  return (
    <div className="shell">
      <div className="topbar">
        <Logo size={30} />
        <div className="top-actions">
          <ThemeToggle />
          <button className="icon-btn" onClick={() => setSub({ page: 'main', back: null })} aria-label="Settings"><Gear size={24} /></button>
        </div>
      </div>
      <div className="content">
        {tab === 'discover' && <Discover uid={uid} profile={profile} onProfileChange={loadMe} onOpenChat={openChatById} />}
        {tab === 'likes' && <LikesYou uid={uid} onOpenChat={openChatById} />}
        {tab === 'matches' && <Matches uid={uid} onOpen={setChat} />}
        {tab === 'profile' && (
          <Profile uid={uid} profile={profile} photos={photos} onChange={loadMe}
            onOpenPage={(p) => setSub({ page: p, back: null })} />
        )}
      </div>
      <nav className="tabs" aria-label="Main">
        {tabs.map(([key, label, icon]) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}>
            {icon}<span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
