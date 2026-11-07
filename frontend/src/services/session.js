export const TOKEN_KEY = 'CHAPTER_CHAT_TOKEN'
export const USERNAME_KEY = 'CHAPTER_CHAT_USERNAME'
export const GUEST_ID_KEY = 'CHAPTER_CHAT_GUEST_ID'
const LEGACY_TOKEN_KEY = 'USIU_BOOKCLUB_TOKEN'
const LEGACY_USERNAME_KEY = 'USIU_BOOKCLUB_USERNAME'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getCurrentUsername() {
  return localStorage.getItem(USERNAME_KEY)
}

export function getGuestId() {
  let guestId = localStorage.getItem(GUEST_ID_KEY)
  if (!guestId) {
    guestId = crypto.randomUUID()
    localStorage.setItem(GUEST_ID_KEY, guestId)
  }
  return guestId
}

export function setSession({ accessToken, user }) {
  localStorage.setItem(TOKEN_KEY, accessToken)
  localStorage.setItem(USERNAME_KEY, user.username)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USERNAME_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  localStorage.removeItem(LEGACY_USERNAME_KEY)
}
