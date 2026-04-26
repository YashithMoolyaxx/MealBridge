import { useEffect, useState } from 'react'
import Panel from '../../components/ui/Panel'
import { createVoucherCampaign, listVoucherCampaigns } from '../../services/rewardService'
import { fetchOrganizations } from '../../services/organizationService'
import { getStoredUser } from '../../hooks/useAuth'

function BusinessVoucherPage() {
  const user = getStoredUser()
  const [campaigns, setCampaigns] = useState([])
  const [donorOrgs, setDonorOrgs] = useState([])
  const [form, setForm] = useState({
    donor_organization: '',
    title: '',
    offer_text: '',
    required_karma: 100,
    starts_at: '',
    ends_at: '',
    is_active: true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const loadData = () => {
    Promise.all([
      listVoucherCampaigns(),
      fetchOrganizations({ kind: 'DONOR_BUSINESS', mine: true }),
    ])
      .then(([campaignItems, donorItems]) => {
        setCampaigns(campaignItems)
        setDonorOrgs(donorItems)
        setForm((prev) => ({ ...prev, donor_organization: prev.donor_organization || donorItems[0]?.id || '' }))
      })
      .catch(() => setError('Unable to load voucher campaigns.'))
  }

  useEffect(() => {
    loadData()
  }, [])

  const onChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    if (user?.role !== 'DONOR') {
      setError('Only donor accounts can create voucher campaigns.')
      return
    }
    setLoading(true)
    setError('')
    setInfo('')

    try {
      await createVoucherCampaign({
        donor_organization: form.donor_organization,
        title: form.title,
        offer_text: form.offer_text,
        required_karma: Number(form.required_karma),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        is_active: form.is_active,
      })
      setInfo('Voucher campaign created successfully.')
      setForm((prev) => ({ ...prev, title: '', offer_text: '', required_karma: 100 }))
      loadData()
    } catch (err) {
      const payload = err?.response?.data
      const message =
        payload?.detail ||
        (typeof payload === 'object' ? Object.values(payload)[0]?.[0] : '') ||
        'Unable to create voucher campaign.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Business Voucher Campaigns</h2>
      {user?.role !== 'DONOR' ? <Panel>Only donor accounts can create business voucher campaigns.</Panel> : null}
      <Panel>
        <h3 className="text-lg font-semibold">Create promotional voucher</h3>
        <p className="mt-2 text-sm text-slate">Set required karma and active window for volunteers.</p>
        {donorOrgs.length === 0 ? (
          <p className="mt-3 rounded-soft border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            No donor organization linked to this account yet. Re-login with a donor account to auto-create one.
          </p>
        ) : null}

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <select
            name="donor_organization"
            value={form.donor_organization}
            onChange={onChange}
            className="w-full rounded-soft border border-line px-4 py-3"
            required
          >
            <option value="">Select donor business</option>
            {donorOrgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <input name="title" value={form.title} onChange={onChange} className="w-full rounded-soft border border-line px-4 py-3" placeholder="Campaign title" required />
          <input
            name="offer_text"
            value={form.offer_text}
            onChange={onChange}
            className="w-full rounded-soft border border-line px-4 py-3 md:col-span-2"
            placeholder="Offer text (e.g., 20% discount)"
            required
          />
          <input
            name="required_karma"
            type="number"
            min={1}
            value={form.required_karma}
            onChange={onChange}
            className="w-full rounded-soft border border-line px-4 py-3"
            placeholder="Required karma"
            required
          />
          <label className="flex items-center gap-2 rounded-soft border border-line bg-cloud px-4 py-3 text-sm">
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={onChange} /> Active campaign
          </label>
          <input
            name="starts_at"
            type="datetime-local"
            value={form.starts_at}
            onChange={onChange}
            className="w-full rounded-soft border border-line px-4 py-3"
            required
          />
          <input
            name="ends_at"
            type="datetime-local"
            value={form.ends_at}
            onChange={onChange}
            className="w-full rounded-soft border border-line px-4 py-3"
            required
          />
          <button
            type="submit"
            disabled={loading || user?.role !== 'DONOR'}
            className="rounded-soft bg-gradient-to-r from-accent to-ink px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Creating...' : 'Create campaign'}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm font-semibold text-danger">{error}</p> : null}
        {info ? <p className="mt-3 text-sm font-semibold text-success">{info}</p> : null}
      </Panel>

      {campaigns.map((campaign) => (
        <Panel key={campaign.id}>
          <h3 className="text-base font-semibold">{campaign.title}</h3>
          <p className="mt-1 text-sm text-slate">{campaign.offer_text}</p>
          <p className="mt-2 text-sm text-slate">Required karma: {campaign.required_karma}</p>
          <p className="mt-1 text-xs text-slate">{campaign.is_active ? 'Active' : 'Inactive'}</p>
        </Panel>
      ))}
    </div>
  )
}

export default BusinessVoucherPage
