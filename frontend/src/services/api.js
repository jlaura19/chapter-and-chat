import axios from 'axios'
import { clearToken, getToken } from './session'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !error.config?.url?.startsWith('/auth/')) {
      clearToken()
      window.dispatchEvent(new Event('chapter-chat:session-expired'))
    }
    return Promise.reject(error)
  },
)

export default api
