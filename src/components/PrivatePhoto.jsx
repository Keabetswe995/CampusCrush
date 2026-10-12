import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const signedPhotos = new Map()
const placeholder = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

export function clearPrivatePhotoCache() {
  signedPhotos.clear()
}

export default function PrivatePhoto({ path, alt = '', ...props }) {
  const [url, setUrl] = useState(() => {
    const cached = signedPhotos.get(path)
    return cached?.expiresAt > Date.now() ? cached.url : ''
  })
  const [failed, setFailed] = useState(false)
  const [retryState, setRetryState] = useState({ path, attempt: 0 })
  const retry = retryState.path === path ? retryState.attempt : 0

  useEffect(() => {
    let active = true
    const cached = signedPhotos.get(path)
    if (cached && cached.expiresAt > Date.now()) {
      setUrl(cached.url)
      setFailed(false)
      return () => { active = false }
    }

    setUrl('')
    setFailed(false)
    supabase.storage.from('photos').createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (error) throw error
        if (!data?.signedUrl) throw new Error('Storage did not return a signed photo URL.')
        signedPhotos.set(path, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60_000 })
        if (active) setUrl(data.signedUrl)
      })
      .catch((error) => {
        console.error('Could not load a private profile photo:', error.message)
        if (active) setFailed(true)
      })

    return () => { active = false }
  }, [path, retry])

  return (
    <img {...props} src={failed ? placeholder : url || placeholder}
      style={{ background: 'var(--sel)', ...props.style }}
      alt={failed ? `${alt} (unavailable)` : alt}
      onError={(event) => {
        if (!url) return
        if (retry === 0) {
          signedPhotos.delete(path)
          setUrl('')
          setRetryState({ path, attempt: 1 })
          return
        }
        console.error('Could not display a signed profile photo.')
        setFailed(true)
        props.onError?.(event)
      }} />
  )
}
