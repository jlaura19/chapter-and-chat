const THEME_KEY = 'CHAPTER_CHAT_THEME'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

let preference = localStorage.getItem(THEME_KEY) || 'LIGHT'

function render() {
  const dark = preference === 'DARK' || (preference === 'SYSTEM' && darkQuery.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function applyTheme(value) {
  preference = ['LIGHT', 'DARK', 'SYSTEM'].includes(value) ? value : 'LIGHT'
  localStorage.setItem(THEME_KEY, preference)
  render()
}

export function initTheme() {
  darkQuery.addEventListener('change', render)
  render()
}
