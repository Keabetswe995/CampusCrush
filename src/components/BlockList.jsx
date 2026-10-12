import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function BlockList({ uid }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    const { data, error } = await supabase.rpc('my_blocked_list')
    if (error) setError(error.message)
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  async function unblock(r) {
    if (!window.confirm(`Unblock ${r.name}? You may see each other again.`)) return
    const { error } = await supabase.from('blocks').delete().eq('blocker', uid).eq('blocked', r.id)
    if (error) setError(error.message); else load()
  }

  return (
    <div>
      <h2 className="serif">Block list</h2>
      <p className="muted">People you block can't see you and you can't see them.</p>
      {error && <p className="alert error" role="alert">{error}</p>}
      {rows === null ? <div className="empty"><div className="spinner" /></div>
        : rows.length === 0 ? <div className="card center"><p className="muted">You haven't blocked anyone.</p></div>
        : (
          <div className="list-card">
            {rows.map((r) => (
              <div className="row-link static" key={r.id}>
                <span><b>{r.name}</b><small>Blocked {new Date(r.blocked_at).toLocaleDateString()}</small></span>
                <button className="btn ghost small-btn" onClick={() => unblock(r)}>Unblock</button>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
