import apiClient from './apiClient'

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

export async function listNotifications() {
  const { data } = await apiClient.get('/notifications/')
  return normalizeList(data)
}
