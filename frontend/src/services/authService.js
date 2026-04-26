import apiClient from './apiClient'

export async function registerUser(payload) {
  const { data } = await apiClient.post('/auth/register/', payload)
  return data
}

export async function loginUser({ username, password }) {
  const { data } = await apiClient.post('/auth/login/', { username, password })
  return data
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get('/auth/me/')
  return data
}

export async function updateCurrentUser(payload) {
  const { data } = await apiClient.patch('/auth/me/', payload)
  return data
}

export async function fetchDashboardStats() {
  const { data } = await apiClient.get('/auth/stats/')
  return data
}

export async function fetchLeaderboard(role) {
  const { data } = await apiClient.get('/auth/leaderboard/', { params: { role } })
  return data
}
