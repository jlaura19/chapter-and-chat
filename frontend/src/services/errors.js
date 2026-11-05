export function errorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail) {
    return detail
  }
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item) => item.msg).join(' ')
  }
  return fallback
}
