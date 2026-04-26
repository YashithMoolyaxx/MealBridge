export function formatMissionState(state) {
  return state
    .toLowerCase()
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

export function formatDistance(km) {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  return `${km.toFixed(1)} km`
}

export function formatCountdown(targetTime) {
  if (!targetTime) return 'No expiry'
  const now = Date.now()
  const target = new Date(targetTime).getTime()
  const diff = target - now

  if (Number.isNaN(target)) return 'Invalid time'
  if (diff <= 0) return 'Expired'

  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  return `${minutes}m ${seconds}s`
}
