export const TOKEN_KEY = 'USIU_BOOKCLUB_TOKEN'
export const USERNAME_KEY = 'USIU_BOOKCLUB_USERNAME'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getCurrentUsername() {
  return localStorage.getItem(USERNAME_KEY)
}

export function setSession({ accessToken, user }) {
  localStorage.setItem(TOKEN_KEY, accessToken)
  localStorage.setItem(USERNAME_KEY, user.username)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USERNAME_KEY)
}
