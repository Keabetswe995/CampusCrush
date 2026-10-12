import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { applyTheme, currentTheme } from '../lib/theme'

export function useTheme() {
  const [theme, setTheme] = useState(currentTheme())
  useEffect(() => {
    const on = (e) => setTheme(e.detail)
    window.addEventListener('cc-theme', on)
    return () => window.removeEventListener('cc-theme', on)
  }, [])
  return [theme, (t) => applyTheme(t)]
}

export default function ThemeToggle({ className = '' }) {
  const [theme, set] = useTheme()
  const dark = theme === 'dark'
  return (
    <button type="button" className={`theme-switch ${dark ? 'dark' : ''} ${className}`}
      onClick={() => set(dark ? 'light' : 'dark')} role="switch" aria-checked={dark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <Sun size={14} className="s" />
      <Moon size={14} className="m" />
      <span className="knob" />
    </button>
  )
}
