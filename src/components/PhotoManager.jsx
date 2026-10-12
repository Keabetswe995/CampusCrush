import { useRef, useState } from 'react'
import { Camera, Trash2, Plus } from 'lucide-react'
import { supabase } from '../supabase'
import { MAX_PHOTOS } from '../lib/constants'
import PrivatePhoto from './PrivatePhoto'

// Shrinks the picture and re-saves it as JPEG. This also strips hidden GPS data from photos.
async function compress(file, max = 1080) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not read that image.'))), 'image/jpeg', 0.85)
  )
}

export default function PhotoManager({ uid, photos, onChange }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onFiles(e) {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    setError(''); setBusy(true)
    try {
      const room = MAX_PHOTOS - photos.length
      let pos = photos.length ? Math.max(...photos.map((p) => p.position)) + 1 : 0
      for (const f of files.slice(0, room)) {
        if (!f.type.startsWith('image/')) throw new Error('Only picture files can be uploaded.')
        const blob = await compress(f)
        const path = `${uid}/${crypto.randomUUID()}.jpg`
        const up = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' })
        if (up.error) throw new Error(`Photo storage: ${up.error.message}`)
        const ins = await supabase.from('photos').insert({ user_id: uid, path, position: pos++ })
        if (ins.error) {
          await supabase.storage.from('photos').remove([path])
          throw new Error(`Photo record: ${ins.error.message}`)
        }
      }
      if (files.length > room) setError(`Only ${MAX_PHOTOS} photos fit. The extra ones were skipped.`)
      await onChange()
    } catch (err) {
      const message = err.message || 'Upload failed. Try again.'
      setError(/row-level security policy/i.test(message)
        ? 'Supabase blocked the photo upload. Run supabase/update_2.sql in your project’s SQL Editor, then try again.'
        : message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(p) {
    if (!window.confirm('Remove this photo?')) return
    setBusy(true); setError('')
    try {
      const stored = await supabase.storage.from('photos').remove([p.path])
      if (stored.error) throw stored.error
      const { error } = await supabase.from('photos').delete().eq('id', p.id)
      if (error) throw error
      await onChange()
    } catch (err) {
      setError(err.message || 'Could not remove that photo.')
    } finally {
      setBusy(false)
    }
  }

  const slots = Array.from({ length: MAX_PHOTOS }, (_, i) => photos[i] || null)

  return (
    <div>
      <div className="photo-grid">
        {slots.map((p, i) =>
          p ? (
            <div className="photo-slot filled" key={p.id}>
              <PrivatePhoto path={p.path} alt={`Your photo ${i + 1}`} />
              {i === 0 && <span className="badge">Main</span>}
              <button className="photo-del" onClick={() => remove(p)} aria-label="Remove photo" disabled={busy}>
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <button key={`e${i}`} className="photo-slot empty" onClick={() => input.current.click()} disabled={busy}
              aria-label="Add a photo">
              {i === photos.length ? <Camera size={26} /> : <Plus size={22} />}
            </button>
          )
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onFiles} />
      <p className="muted small">{photos.length} of {MAX_PHOTOS} photos. Everyone you meet can see all of them.</p>
      {busy && <p className="muted small">Working on it…</p>}
      {error && <p className="alert error" role="alert">{error}</p>}
    </div>
  )
}
