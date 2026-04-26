const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'donations'

function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

function buildPublicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`
}

function getFileExtension(file) {
  const name = file?.name || ''
  const parts = name.split('.')
  if (parts.length > 1) return parts.pop()
  return 'jpg'
}

export async function uploadDonationImage(file) {
  if (!hasSupabaseConfig()) return null
  const ext = getFileExtension(file)
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = `donations/${safeName}`
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': file.type || 'image/jpeg',
      'x-upsert': 'true',
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error('Image upload failed')
  }

  return buildPublicUrl(path)
}

export function supabaseEnabled() {
  return hasSupabaseConfig()
}
