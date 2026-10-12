import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Send, MoreVertical, Ban, Flag, X, GraduationCap, MapPin, Mic, Square } from 'lucide-react'
import { supabase } from '../supabase'
import PrivatePhoto from './PrivatePhoto'
import { ageFrom, timeLabel, choiceLabel, GENDER_IDENTITIES, ORIENTATIONS, DATING_INTENTIONS } from '../lib/constants'

export default function Chat({ uid, match, onBack, onBlocked }) {
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(false)
  const [view, setView] = useState(false)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const end = useRef(null)
  const recorder = useRef(null)
  const stream = useRef(null)
  const chunks = useRef([])
  const stopTimer = useRef(null)
  const other = match.other

  useEffect(() => {
    let alive = true
    const withAudioUrl = async (message) => {
      if (!message.audio_path) return message
      const { data, error } = await supabase.storage.from('voice-notes').createSignedUrl(message.audio_path, 3600)
      if (error) throw error
      return { ...message, audio_url: data.signedUrl }
    }
    supabase.from('messages').select('*').eq('match_id', match.id).order('created_at')
      .then(async ({ data, error }) => {
        if (error) throw error
        const messages = await Promise.all((data || []).map(withAudioUrl))
        if (alive) setMsgs(messages)
      })
      .catch((err) => { if (alive) setError(`Could not load chat: ${err.message}`) })
    const channel = supabase
      .channel(`chat-${match.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${match.id}` },
        async (payload) => {
          try {
            const message = await withAudioUrl(payload.new)
            setMsgs((cur) => (cur.some((m) => m.id === message.id) ? cur : [...cur, message]))
          } catch (err) {
            setError(`Could not load voice note: ${err.message}`)
          }
        })
      .subscribe()
    return () => {
      alive = false
      window.clearTimeout(stopTimer.current)
      if (recorder.current?.state === 'recording') {
        recorder.current.onstop = null
        recorder.current.stop()
      }
      stream.current?.getTracks().forEach((track) => track.stop())
      supabase.removeChannel(channel)
    }
  }, [match.id])

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText(''); setError('')
    const { data, error } = await supabase.from('messages')
      .insert({ match_id: match.id, sender_id: uid, body }).select().single()
    if (error) { setError('Message not sent. You may no longer be matched.'); setText(body); return }
    setMsgs((cur) => (cur.some((m) => m.id === data.id) ? cur : [...cur, data]))
  }

  async function sendVoiceNote(blob, mimeType) {
    setError('')
    const contentType = mimeType.split(';')[0] || 'audio/webm'
    const extension = ({ 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' })[contentType] || 'webm'
    const path = `${match.id}/${uid}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('voice-notes')
      .upload(path, blob, { contentType, upsert: false })
    if (uploadError) throw new Error(`Voice note upload failed: ${uploadError.message}`)

    const { data, error: insertError } = await supabase.from('messages').insert({
      match_id: match.id, sender_id: uid, body: 'Voice note', message_type: 'voice', audio_path: path,
    }).select().single()
    if (insertError) {
      await supabase.storage.from('voice-notes').remove([path])
      throw new Error(`Voice note could not be sent: ${insertError.message}`)
    }
    const { data: signed, error: signedError } = await supabase.storage.from('voice-notes').createSignedUrl(path, 3600)
    if (signedError) throw new Error(`Voice note sent but could not be played: ${signedError.message}`)
    setMsgs((cur) => (cur.some((m) => m.id === data.id) ? cur : [...cur, { ...data, audio_url: signed.signedUrl }]))
  }

  async function toggleRecording() {
    if (recorder.current?.state === 'recording') {
      window.clearTimeout(stopTimer.current)
      recorder.current.stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported by this device or browser.')
      return
    }
    setError('')
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = media
      const activeRecorder = new MediaRecorder(media)
      chunks.current = []
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data)
      }
      activeRecorder.onstop = async () => {
        media.getTracks().forEach((track) => track.stop())
        stream.current = null
        recorder.current = null
        setRecording(false)
        const blob = new Blob(chunks.current, { type: activeRecorder.mimeType || 'audio/webm' })
        if (!blob.size) { setError('No audio was recorded. Please try again.'); return }
        if (blob.size > 10 * 1024 * 1024) { setError('That voice note is too large. Please record a shorter one.'); return }
        try { await sendVoiceNote(blob, activeRecorder.mimeType || 'audio/webm') }
        catch (err) { setError(err.message || 'Voice note could not be sent.') }
      }
      activeRecorder.start()
      recorder.current = activeRecorder
      setRecording(true)
      stopTimer.current = window.setTimeout(() => {
        if (activeRecorder.state === 'recording') activeRecorder.stop()
      }, 60_000)
    } catch (err) {
      stream.current?.getTracks().forEach((track) => track.stop())
      stream.current = null
      setError(err.message || 'Microphone access was denied.')
    }
  }

  async function block() {
    setMenu(false)
    if (!window.confirm(`Block ${other.name}? The chat will be deleted and you will never see each other again.`)) return
    const { error } = await supabase.rpc('block_user', { target: other.id })
    if (error) setError(error.message); else onBlocked()
  }

  async function report() {
    setMenu(false)
    const reason = window.prompt(`What is wrong with ${other.name}'s profile or messages?`)
    if (!reason || reason.trim().length < 3) return
    const { error } = await supabase.from('reports').insert({ reporter: uid, reported: other.id, reason: reason.trim() })
    if (error) setError(error.message)
    else window.alert('Thanks. We will look into it. You can also block this person.')
  }

  return (
    <div className="chat">
      <header className="chat-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back to matches"><ArrowLeft size={22} /></button>
        <button className="chat-who" onClick={() => setView(true)}>
          {match.photos[0] ? <PrivatePhoto path={match.photos[0]} alt="" /> : <span className="avatar-fallback">{other.name[0]}</span>}
          <span><b>{other.name}</b><small className="muted">{Date.now() - new Date(other.last_active_at || 0).getTime() < 5 * 60_000 ? 'Active now · tap to see profile' : 'Tap to see profile'}</small></span>
        </button>
        <div className="menu-wrap">
          <button className="icon-btn" onClick={() => setMenu(!menu)} aria-label="More options"><MoreVertical size={22} /></button>
          {menu && (
            <div className="menu sticker">
              <button onClick={report}><Flag size={16} /> Report</button>
              <button className="danger" onClick={block}><Ban size={16} /> Block</button>
            </div>
          )}
        </div>
      </header>

      <div className="chat-body">
        {msgs.length === 0 && <p className="muted center">You matched with {other.name}! Break the ice 🧊</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.sender_id === uid ? 'mine' : 'theirs'}`}>
            {m.message_type === 'voice' && m.audio_url
              ? <audio className="voice-player" controls preload="none" src={m.audio_url} aria-label="Voice note" />
              : <span>{m.body}</span>}
            <small>{timeLabel(m.created_at)}</small>
          </div>
        ))}
        <div ref={end} />
      </div>

      {error && <p className="alert error" role="alert">{error}</p>}
      <form className="composer" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Say something sweet…" aria-label="Message" />
        <button type="button" className={`round voice ${recording ? 'recording' : ''}`}
          onClick={toggleRecording} aria-label={recording ? 'Stop and send voice note' : 'Record voice note'}
          title={recording ? 'Stop and send voice note (max 60 seconds)' : 'Record voice note'}>
          {recording ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
        </button>
        <button className="round like send" aria-label="Send message" disabled={!text.trim()}><Send size={20} /></button>
      </form>
      {recording && <p className="muted small center">Recording… tap the square to send (max 60 seconds)</p>}

      {view && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={`${other.name}'s profile`}>
          <div className="sticker profile-sheet">
            <button className="icon-btn close" onClick={() => setView(false)} aria-label="Close"><X size={22} /></button>
            <h3>{other.name}, {ageFrom(other.birth_date)}</h3>
            <p className="meta"><GraduationCap size={16} /> {other.university}</p>
            <p className="meta"><MapPin size={16} /> {other.city}</p>
            {other.gender_identity && other.gender_identity !== 'prefer_not_to_say' &&
              <p className="meta">{choiceLabel(GENDER_IDENTITIES, other.gender_identity)}</p>}
            {other.show_orientation && other.orientation && other.orientation !== 'prefer_not_to_say' &&
              <p className="meta">{choiceLabel(ORIENTATIONS, other.orientation)}</p>}
            {other.height_cm && <p className="meta">{other.height_cm} cm</p>}
            {other.dating_intention && <p className="meta">{choiceLabel(DATING_INTENTIONS, other.dating_intention)}</p>}
            {other.smoking && <p className="meta">Smoking: {other.smoking}</p>}
            {other.drinking && <p className="meta">Drinking: {other.drinking}</p>}
            {other.bio && <p className="bio">{other.bio}</p>}
            {other.interests?.length > 0 && <div className="chips">{other.interests.map((i) => <span className="chip on static" key={i}>{i}</span>)}</div>}
            {other.music_preferences?.length > 0 && <div className="chips">{other.music_preferences.map((i) => <span className="chip static" key={i}>{i}</span>)}</div>}
            <div className="sheet-photos">{match.photos.map((p) => <PrivatePhoto key={p} path={p} alt={`${other.name}`} />)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
