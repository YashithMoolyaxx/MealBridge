import apiClient from './apiClient'

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

export async function fetchDonationFeed() {
  const { data } = await apiClient.get('/donations/')
  return normalizeList(data)
}

export async function fetchRequirementFeed() {
  const { data } = await apiClient.get('/requirements/')
  return normalizeList(data)
}

export async function fetchImpactFeed() {
  const { data } = await apiClient.get('/impact-feed/')
  return normalizeList(data)
}
