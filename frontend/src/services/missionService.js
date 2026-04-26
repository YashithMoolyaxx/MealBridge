import apiClient from './apiClient'

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

export async function listMissions(params = {}) {
  const { data } = await apiClient.get('/missions/', { params })
  return normalizeList(data)
}

export async function getMission(missionId) {
  const { data } = await apiClient.get(`/missions/${missionId}/`)
  return data
}

export async function acceptMission(missionId) {
  const { data } = await apiClient.post(`/missions/${missionId}/accept/`)
  return data
}

export async function approveVolunteerRequest(missionId) {
  const { data } = await apiClient.post(`/missions/${missionId}/approve_request/`)
  return data
}

export async function rejectVolunteerRequest(missionId) {
  const { data } = await apiClient.post(`/missions/${missionId}/reject_request/`)
  return data
}

export async function requestDeliveryVerification(missionId) {
  const { data } = await apiClient.post(`/missions/${missionId}/request_delivery/`)
  return data
}

export async function approveDelivery(missionId) {
  const { data } = await apiClient.post(`/missions/${missionId}/approve_delivery/`)
  return data
}

export async function rejectDelivery(missionId) {
  const { data } = await apiClient.post(`/missions/${missionId}/reject_delivery/`)
  return data
}

export async function scanPickup(missionId, qrToken) {
  const { data } = await apiClient.post(`/missions/${missionId}/scan_pickup/`, { qr_token: qrToken })
  return data
}

export async function scanDelivery(missionId, qrToken) {
  const { data } = await apiClient.post(`/missions/${missionId}/scan_delivery/`, { qr_token: qrToken })
  return data
}

export async function cancelMission(missionId) {
  const { data } = await apiClient.post(`/missions/${missionId}/cancel/`)
  return data
}
