const KEY = 'cc-theme'
const COLORS = { light: '#f4f2f5', dark: '#0f0d10' }

export function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', COLORS[theme])
  try { localStorage.setItem(KEY, theme) } catch { /* private mode: just don't remember */ }
  window.dispatchEvent(new CustomEvent('cc-theme', { detail: theme }))
}
