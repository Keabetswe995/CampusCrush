import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowLeft } from 'lucide-react'
import { supabase } from '../supabase'
import { authErrorMessage } from '../lib/authErrors'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

export default function Auth() {
  const [mode, setMode] = useState('signin') // signin | signup | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [adult, setAdult] = useState(false)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const switchMode = (m) => { setMode(m); setError(''); setInfo('') }

  async function submit(e) {
    e.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'signup') {
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.')
        if (password !== confirm) throw new Error('The two passwords do not match.')
        if (!adult) throw new Error('Please confirm that you are 18 or older.')
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) {
          setInfo('Almost there! Open the confirmation email we just sent, tap the link, then sign in.')
          setMode('signin')
        }
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setInfo('If that email has an account, a reset link is on its way. Check your spam folder too.')
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const titles = {
    signin: ['Welcome back, crush', 'Sign in to see who is waiting for you.'],
    signup: ['Join the campus', 'Meet students from universities across South Africa.'],
    forgot: ['Forgot your password?', 'Enter your email and we will send you a reset link.'],
  }

  return (
    <main className="auth-page">
      <ThemeToggle className="corner" />
      <section className="sticker auth-card">
        <Logo size={48} />
        <h1 className="serif">{titles[mode][0]}</h1>
        <p className="muted">{titles[mode][1]}</p>

        <form onSubmit={submit} className="stack">
          <label className="field">
            <span>Email</span>
            <div className="input-icon"><Mail size={18} />
              <input type="email" required autoComplete="email" placeholder="you@university.ac.za"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </label>

          {mode !== 'forgot' && (
            <label className="field">
              <span>Password</span>
              <div className="input-icon"><Lock size={18} />
                <input type={show ? 'text' : 'password'} required minLength={mode === 'signup' ? 8 : 1}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="icon-btn" onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}

          {mode === 'signup' && (
            <>
              <label className="field">
                <span>Confirm password</span>
                <div className="input-icon"><Lock size={18} />
                  <input type={show ? 'text' : 'password'} required autoComplete="new-password"
                    placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
              </label>
              <label className="check">
                <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                <span>I am 18 or older and a university student.</span>
              </label>
            </>
          )}

          {error && <p className="alert error" role="alert">{error}</p>}
          {info && <p className="alert ok" role="status">{info}</p>}

          <button className="btn primary big" disabled={busy}>
            <Sparkles size={18} />
            {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create my account' : 'Send reset link'}
          </button>
        </form>

        <div className="auth-links">
          {mode === 'signin' && (
            <>
              <button className="link" onClick={() => switchMode('forgot')}>Forgot password?</button>
              <button className="link" onClick={() => switchMode('signup')}>New here? Create an account</button>
            </>
          )}
          {mode === 'signup' && <button className="link" onClick={() => switchMode('signin')}>Already have an account? Sign in</button>}
          {mode === 'forgot' && <button className="link" onClick={() => switchMode('signin')}><ArrowLeft size={14} /> Back to sign in</button>}
        </div>
      </section>
    </main>
  )
}

export function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(authErrorMessage(error))
    else onDone()
  }

  return (
    <main className="auth-page">
      <section className="sticker auth-card">
        <Logo size={48} />
        <h1 className="serif">Choose a new password</h1>
        <form onSubmit={submit} className="stack">
          <label className="field"><span>New password</span>
            <div className="input-icon"><Lock size={18} />
              <input type="password" required autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} />
            </div>
          </label>
          <label className="field"><span>Confirm new password</span>
            <div className="input-icon"><Lock size={18} />
              <input type="password" required autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </label>
          {error && <p className="alert error" role="alert">{error}</p>}
          <button className="btn primary big" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
        </form>
      </section>
    </main>
  )
}
