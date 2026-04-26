import axios from 'axios'
import { clearAuthSession, getAccessToken, getRefreshToken, setAccessToken } from '../hooks/useAuth'

const configuredBaseURL = import.meta.env.VITE_API_BASE_URL
const directBackendBaseURL = 'http://localhost:8000/api/v1'
const resolvedBaseURL = configuredBaseURL || directBackendBaseURL

const apiClient = axios.create({
  baseURL: resolvedBaseURL,
  timeout: 25000,
})

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise = null

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  refreshPromise = axios
    .post(`${resolvedBaseURL}/auth/refresh/`, { refresh: refreshToken })
    .then((response) => {
      const newAccess = response.data?.access
      if (newAccess) {
        setAccessToken(newAccess)
        return newAccess
      }
      return null
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config
    if (!originalRequest || originalRequest.__isRetryRequest) {
      return Promise.reject(error)
    }

    if (error?.response?.status === 401) {
      const newAccess = await refreshAccessToken()
      if (newAccess) {
        originalRequest.__isRetryRequest = true
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newAccess}`
        return apiClient(originalRequest)
      }
      clearAuthSession()
      if (typeof window !== 'undefined') {
        window.location.assign('/auth/login')
      }
    }

    return Promise.reject(error)
  },
)

export default apiClient
