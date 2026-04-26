import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRequirement } from '../../services/requirementService'
import { fetchOrganizations } from '../../services/organizationService'
import { reverseGeocode, searchAddress } from '../../services/locationService'
import { getStoredUser } from '../../hooks/useAuth'

function CreateRequirementPage() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [ngos, setNgos] = useState([])
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [form, setForm] = useState({
    receiver_organization: '',
    need_title: '',
    meals_needed: 50,
    urgency: 'HIGH',
    required_before: '',
    location_address: '',
    location_latitude: '',
    location_longitude: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchOrganizations({ kind: 'NGO', mine: true })
      .then((items) => {
        setNgos(items)
        setForm((prev) => ({ ...prev, receiver_organization: prev.receiver_organization || items[0]?.id || '' }))
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (!form.location_address || form.location_address.length < 3) {
      setAddressSuggestions([])
      return
    }

    const timer = setTimeout(() => {
      searchAddress(form.location_address)
        .then((results) => setAddressSuggestions(results))
        .catch(() => setAddressSuggestions([]))
    }, 350)
    return () => clearTimeout(timer)
  }, [form.location_address])

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
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
          location_latitude: lat,
          location_longitude: lng,
          location_address: address || prev.location_address,
        }))
      },
      () => setError('Unable to get location permission.'),
      { enableHighAccuracy: true, timeout: 7000 },
    )
  }

  const applySuggestion = (suggestion) => {
    setForm((prev) => ({
      ...prev,
      location_address: suggestion.address,
      location_latitude: suggestion.latitude,
      location_longitude: suggestion.longitude,
    }))
    setAddressSuggestions([])
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    if (user?.role !== 'RECEIVER') {
      setError('Only receiver NGO accounts can create requirement posts.')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        receiver_organization: form.receiver_organization,
        need_title: form.need_title,
        meals_needed: Number(form.meals_needed),
        urgency: form.urgency,
        required_before: new Date(form.required_before).toISOString(),
        location_address: form.location_address,
        location_latitude: Number(form.location_latitude),
        location_longitude: Number(form.location_longitude),
        notes: form.notes,
      }
      await createRequirement(payload)
      setSuccess('Requirement posted successfully.')
      setTimeout(() => navigate('/app/requirements'), 800)
    } catch (err) {
      const payload = err?.response?.data
      const message =
        payload?.detail ||
        (typeof payload === 'object' ? Object.values(payload)[0]?.[0] : '') ||
        'Unable to create requirement.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      {user?.role !== 'RECEIVER' ? (
        <p className="rounded-soft border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          Only receiver NGO accounts can post requirement cards.
        </p>
      ) : null}
      <h2 className="text-2xl font-bold">Create Requirement Post</h2>
      <p className="text-sm text-slate">Receiver NGO users can post urgent needs that donors can fulfill.</p>
      {ngos.length === 0 ? (
        <p className="rounded-soft border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          No NGO organization found for this account. Re-login once with a receiver account to auto-create one.
        </p>
      ) : null}
      <form className="space-y-4 rounded-soft border border-line bg-white p-5 shadow-card" onSubmit={onSubmit}>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Receiver NGO</span>
          <select
            name="receiver_organization"
            value={form.receiver_organization}
            onChange={onChange}
            className="w-full rounded-soft border border-line px-4 py-3"
            required
          >
            <option value="">Select NGO</option>
            {ngos.map((ngo) => (
              <option key={ngo.id} value={ngo.id}>
                {ngo.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Need title</span>
            <input name="need_title" value={form.need_title} onChange={onChange} className="w-full rounded-soft border border-line px-4 py-3" required />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Meals needed</span>
            <input
              name="meals_needed"
              type="number"
              min={1}
              value={form.meals_needed}
              onChange={onChange}
              className="w-full rounded-soft border border-line px-4 py-3"
              required
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Urgency</span>
            <select name="urgency" value={form.urgency} onChange={onChange} className="w-full rounded-soft border border-line px-4 py-3">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Required before</span>
            <input
              name="required_before"
              type="datetime-local"
              value={form.required_before}
              onChange={onChange}
              className="w-full rounded-soft border border-line px-4 py-3"
              required
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Location address</span>
          <div className="flex flex-wrap gap-2">
            <input
              name="location_address"
              value={form.location_address}
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
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Latitude</span>
            <input name="location_latitude" value={form.location_latitude} onChange={onChange} className="w-full rounded-soft border border-line px-4 py-3" required />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Longitude</span>
            <input name="location_longitude" value={form.location_longitude} onChange={onChange} className="w-full rounded-soft border border-line px-4 py-3" required />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Notes</span>
          <textarea name="notes" value={form.notes} onChange={onChange} className="w-full rounded-soft border border-line px-4 py-3" rows={3} />
        </label>

        {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
        {success ? <p className="text-sm font-semibold text-success">{success}</p> : null}

        <button
          disabled={loading || user?.role !== 'RECEIVER'}
          className="rounded-soft bg-gradient-to-r from-accent to-ink px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Publishing...' : 'Publish requirement'}
        </button>
      </form>
    </div>
  )
}

export default CreateRequirementPage
