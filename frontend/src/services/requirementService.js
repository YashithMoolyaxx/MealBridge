import apiClient from './apiClient'

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

export async function createRequirement(payload) {
  const { data } = await apiClient.post('/requirements/', payload)
  return data
}

export async function listRequirements() {
  const { data } = await apiClient.get('/requirements/')
  return normalizeList(data)
}
