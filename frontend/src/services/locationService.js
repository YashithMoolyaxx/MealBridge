const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

export async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
  const response = await fetch(url, {
    headers: { 'Accept-Language': 'en' },
  })
  if (!response.ok) throw new Error('Failed to reverse geocode location')
  const payload = await response.json()
  return payload.display_name || ''
}

export async function searchAddress(query) {
  if (!query || query.length < 3) return []
  const encoded = encodeURIComponent(query)
  const url = `${NOMINATIM_BASE}/search?format=jsonv2&q=${encoded}&limit=5`
  const response = await fetch(url, {
    headers: { 'Accept-Language': 'en' },
  })
  if (!response.ok) throw new Error('Failed to search address')
  const payload = await response.json()
  return payload.map((item) => ({
    address: item.display_name,
    latitude: item.lat,
    longitude: item.lon,
  }))
}
