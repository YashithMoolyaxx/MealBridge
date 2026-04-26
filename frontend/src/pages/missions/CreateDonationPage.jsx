import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createDonation, createMissionFromDonation } from '../../services/donationService'
import { fetchOrganizations } from '../../services/organizationService'
import { reverseGeocode, searchAddress } from '../../services/locationService'
import { uploadDonationImage, supabaseEnabled } from '../../services/storageService'
import { getStoredUser } from '../../hooks/useAuth'

const categories = [
  'COOKED_MEALS',
  'DRY_RATIONS',
  'BAKERY',
  'PRODUCE',
  'OTHER',
]

function CreateDonationPage() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [form, setForm] = useState({
    donor_organization: '',
    receiver_organization_id: '',
    food_title: '',
    food_quantity: 10,
    quantity_unit: 'Meals',
    food_category: 'COOKED_MEALS',
    expiry_time: '',
    pickup_address: '',
    pickup_latitude: '',
    pickup_longitude: '',
    image_url: '',
    notes: '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [donorOrgs, setDonorOrgs] = useState([])
  const [receiverOrgs, setReceiverOrgs] = useState([])
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    Promise.all([
      fetchOrganizations({ kind: 'DONOR_BUSINESS', mine: true }),
      fetchOrganizations({ kind: 'NGO' }),
    ])
      .then(([donors, ngos]) => {
        setDonorOrgs(donors)
        setReceiverOrgs(ngos)
        setForm((prev) => ({
          ...prev,
          donor_organization: prev.donor_organization || donors[0]?.id || '',
          receiver_organization_id: prev.receiver_organization_id || ngos[0]?.id || '',
        }))
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (!form.pickup_address || form.pickup_address.length < 3) {
      setAddressSuggestions([])
      return
    }

    const timer = setTimeout(() => {
      searchAddress(form.pickup_address)
        .then((results) => setAddressSuggestions(results))
        .catch(() => setAddressSuggestions([]))
    }, 350)
    return () => clearTimeout(timer)
  }, [form.pickup_address])

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const normalizeCoordinate = (value) => {
    const parsed = Number(value)
    if (Number.isNaN(parsed)) return ''
    return parsed.toFixed(6)
  }

  const readAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(new Error('Unable to read image file.'))
      reader.readAsDataURL(file)
    })

  const onImageChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      setForm((prev) => ({ ...prev, image_url: '' }))
      setImageFile(null)
      setImagePreview('')
      return
    }

    setImageFile(file)
    const objectUrl = URL.createObjectURL(file)
    setImagePreview(objectUrl)

    if (!supabaseEnabled()) {
      const base64 = await readAsDataUrl(file)
      setForm((prev) => ({ ...prev, image_url: base64 }))
    }
  }

  const applySuggestion = (suggestion) => {
    setForm((prev) => ({
      ...prev,
      pickup_address: suggestion.address,
      pickup_latitude: suggestion.latitude,
      pickup_longitude: suggestion.longitude,
    }))
    setAddressSuggestions([])
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.')
      return
    }
    setError('')
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude.toFixed(6)
        const lng = position.coords.longitude.toFixed(6)
        const address = await reverseGeocode(lat, lng).catch(() => '')
        setForm((prev) => ({
          ...prev,
          pickup_latitude: lat,
          pickup_longitude: lng,
          pickup_address: address || prev.pickup_address,
        }))
      },
      () => setError('Unable to get current location. Please allow location permission.'),
      { enableHighAccuracy: true, timeout: 7000 },
    )
  }

  const payload = useMemo(
    () => ({
      donor_organization: form.donor_organization || null,
      food_title: form.food_title,
      food_quantity: Number(form.food_quantity),
      quantity_unit: form.quantity_unit,
      food_category: form.food_category,
      expiry_time: form.expiry_time ? new Date(form.expiry_time).toISOString() : null,
      pickup_address: form.pickup_address,
      pickup_latitude: Number(normalizeCoordinate(form.pickup_latitude)),
      pickup_longitude: Number(normalizeCoordinate(form.pickup_longitude)),
      image_url: form.image_url,
      notes: form.notes,
    }),
    [form],
  )

  const onSubmit = async (event) => {
    event.preventDefault()
    if (user?.role !== 'DONOR') {
      setError('Only donor accounts can create donations.')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (!payload.expiry_time) throw new Error('Please set an expiry time.')
      if (!payload.pickup_address || Number.isNaN(payload.pickup_latitude) || Number.isNaN(payload.pickup_longitude)) {
        throw new Error('Pickup location is required. Use current location or choose an address suggestion.')
      }
      if (!form.receiver_organization_id) {
        throw new Error('Please select a receiver NGO to create the mission.')
      }

      let imageUrl = payload.image_url
      if (imageFile && supabaseEnabled()) {
        imageUrl = await uploadDonationImage(imageFile)
      }

      const donation = await createDonation({ ...payload, image_url: imageUrl || '' })
      const selectedReceiver = form.receiver_organization_id
      await createMissionFromDonation(donation.id, { receiver_organization_id: selectedReceiver })

      setSuccess('Donation posted and mission created successfully.')
      setTimeout(() => navigate('/app/missions/volunteer'), 900)
    } catch (err) {
      const payload = err?.response?.data
      const message =
        payload?.detail ||
        (typeof payload === 'object' ? Object.values(payload)[0]?.[0] : '') ||
        err?.message ||
        'Unable to create donation right now.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      {user?.role !== 'DONOR' ? (
        <p className="rounded-soft border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          Only donor accounts can create donation missions.
        </p>
      ) : null}
      <h2 className="text-2xl font-bold">Create Donation Mission</h2>
      <p className="text-sm text-slate">
        Add food details, pick a precise location, and select a receiver NGO to create mission instantly.
      </p>
      {donorOrgs.length === 0 ? (
        <p className="rounded-soft border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          No donor organization found for this account. Re-login once with a donor account to auto-create one.
        </p>
      ) : null}

      <form className="space-y-4 rounded-soft border border-line bg-white p-5 shadow-card" onSubmit={onSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Food title</span>
            <input name="food_title" value={form.food_title} onChange={onChange} className="w-full rounded-soft border border-line px-4 py-3" required />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Food category</span>
            <select name="food_category" value={form.food_category} onChange={onChange} className="w-full rounded-soft border border-line px-4 py-3">
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Food quantity</span>
            <input
              name="food_quantity"
              type="number"
              min={1}
              value={form.food_quantity}
              onChange={onChange}
              className="w-full rounded-soft border border-line px-4 py-3"
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Unit</span>
            <input name="quantity_unit" value={form.quantity_unit} onChange={onChange} className="w-full rounded-soft border border-line px-4 py-3" />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Expiry time</span>
            <input
              name="expiry_time"
              type="datetime-local"
              value={form.expiry_time}
              onChange={onChange}
              className="w-full rounded-soft border border-line px-4 py-3"
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Image upload</span>
            <input
              type="file"
              accept="image/*"
              onChange={onImageChange}
              className="w-full rounded-soft border border-line bg-white px-4 py-3"
            />
          </label>
        </div>

        {imagePreview ? (
          <div className="rounded-soft border border-line bg-cloud p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate">Preview</p>
            <img src={imagePreview} alt="Preview" className="mt-2 h-40 w-full rounded-soft object-cover" />
          </div>
        ) : null}

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Pickup address</span>
          <div className="flex flex-wrap gap-2">
            <input
              name="pickup_address"
              value={form.pickup_address}
              onChange={onChange}
              className="min-w-[220px] flex-1 rounded-soft border border-line px-4 py-3"
              placeholder="Search address"
              required
            />
            <button
              type="button"
              onClick={useCurrentLocation}
              className="rounded-soft border border-line bg-cloud px-4 py-3 text-sm font-semibold text-slate"
            >
              Use current location
            </button>
          </div>
          {addressSuggestions.length > 0 ? (
            <div className="max-h-44 overflow-auto rounded-soft border border-line bg-white">
              {addressSuggestions.map((suggestion) => (
                <button
                  key={`${suggestion.latitude}-${suggestion.longitude}`}
                  type="button"
                  onClick={() => applySuggestion(suggestion)}
                  className="block w-full border-b border-line/60 px-3 py-2 text-left text-sm hover:bg-cloud"
                >
                  {suggestion.address}
                </button>
              ))}
            </div>
          ) : null}
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Pickup latitude</span>
            <input
              name="pickup_latitude"
              value={form.pickup_latitude}
              onChange={(event) => onChange({ ...event, target: { ...event.target, value: normalizeCoordinate(event.target.value) } })}
              className="w-full rounded-soft border border-line px-4 py-3"
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Pickup longitude</span>
            <input
              name="pickup_longitude"
              value={form.pickup_longitude}
              onChange={(event) => onChange({ ...event, target: { ...event.target, value: normalizeCoordinate(event.target.value) } })}
              className="w-full rounded-soft border border-line px-4 py-3"
              required
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Donor business (optional)</span>
            <select name="donor_organization" value={form.donor_organization} onChange={onChange} className="w-full rounded-soft border border-line px-4 py-3">
              <option value="">Select donor business</option>
              {donorOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Receiver NGO</span>
            <select
              name="receiver_organization_id"
              value={form.receiver_organization_id}
              onChange={onChange}
              className="w-full rounded-soft border border-line px-4 py-3"
              required
            >
              <option value="">Select receiver NGO</option>
              {receiverOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Notes</span>
          <textarea name="notes" value={form.notes} onChange={onChange} className="w-full rounded-soft border border-line px-4 py-3" rows={3} maxLength={200} />
          <p className="text-xs text-slate">Max 200 characters.</p>
        </label>

        {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
        {success ? <p className="text-sm font-semibold text-success">{success}</p> : null}

        <button
          disabled={loading || user?.role !== 'DONOR'}
          className="rounded-soft bg-gradient-to-r from-accent to-ink px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Creating...' : 'Create donation'}
        </button>
      </form>
    </div>
  )
}

export default CreateDonationPage
