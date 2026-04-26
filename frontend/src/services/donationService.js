import apiClient from './apiClient'

export async function createDonation(payload) {
  const { data } = await apiClient.post('/donations/', payload)
  return data
}

export async function createMissionFromDonation(donationId, payload) {
  const { data } = await apiClient.post(`/donations/${donationId}/create_mission/`, payload)
  return data
}
