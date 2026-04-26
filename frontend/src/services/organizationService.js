import apiClient from './apiClient'

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

export async function fetchOrganizations({ kind, verified, mine } = {}) {
  const params = {}
  if (kind) params.kind = kind
  if (typeof verified === 'boolean') params.verified = verified ? 'true' : 'false'
  if (typeof mine === 'boolean') params.mine = mine ? 'true' : 'false'
  const { data } = await apiClient.get('/organizations/', { params })
  return normalizeList(data)
}
