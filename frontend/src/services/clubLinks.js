export function buildInviteLink(clubId, code) {
  return `${window.location.origin}/clubs/${clubId}?invite=${encodeURIComponent(code)}`
}

export function parseInviteLink(text) {
  const match = text.trim().match(/\/clubs\/(\d+)\?(?:.*&)?invite=([^&\s]+)/)
  if (!match) {
    return null
  }
  return { clubId: Number(match[1]), code: decodeURIComponent(match[2]) }
}
