import apiClient from './apiClient'

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

export async function listVoucherCampaigns() {
  const { data } = await apiClient.get('/vouchers/campaigns/')
  return normalizeList(data)
}

export async function createVoucherCampaign(payload) {
  const { data } = await apiClient.post('/vouchers/campaigns/', payload)
  return data
}

export async function redeemVoucher(campaignId) {
  const { data } = await apiClient.post('/vouchers/redemptions/', { campaign: campaignId })
  return data
}

export async function listMyRedemptions() {
  const { data } = await apiClient.get('/vouchers/redemptions/')
  return normalizeList(data)
}
