import { useState } from 'react'
import Panel from '../../components/ui/Panel'
import { getStoredUser, setStoredUser } from '../../hooks/useAuth'
import { updateCurrentUser } from '../../services/authService'

function AccountSettingsPage() {
  const existing = getStoredUser()
  const [form, setForm] = useState({
    first_name: existing?.first_name || '',
    last_name: existing?.last_name || '',
    phone_number: existing?.phone_number || '',
    whatsapp_opt_in: Boolean(existing?.whatsapp_opt_in),
    profile_visibility: existing?.profile_visibility || 'PUBLIC',
  })
  const [saving, setSaving] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [errorText, setErrorText] = useState('')

  const onChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrorText('')
    setStatusText('')
    try {
      const updated = await updateCurrentUser(form)
      setStoredUser(updated)
      setStatusText('Account settings saved.')
    } catch (error) {
      const payload = error?.response?.data
      if (payload?.detail) {
        setErrorText(payload.detail)
      } else {
        setErrorText('Unable to update account settings right now.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Account Settings</h2>
      <p className="text-sm text-slate">Control public profile visibility and personal account details.</p>

      <Panel>
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">First name</span>
              <input
                name="first_name"
                value={form.first_name}
                onChange={onChange}
                className="w-full rounded-soft border border-line px-4 py-3"
                placeholder="First name"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Last name</span>
              <input
                name="last_name"
                value={form.last_name}
                onChange={onChange}
                className="w-full rounded-soft border border-line px-4 py-3"
                placeholder="Last name"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Phone number</span>
            <input
              name="phone_number"
              value={form.phone_number}
              onChange={onChange}
              className="w-full rounded-soft border border-line px-4 py-3"
              placeholder="+91..."
            />
          </label>

          <div className="rounded-soft border border-line bg-cloud p-4">
            <p className="text-sm font-semibold">Public Profile Visibility</p>
            <p className="mt-1 text-sm text-slate">
              This controls whether your name appears on public mission impact cards when you contribute.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-soft border border-line bg-white px-4 py-3">
                <input
                  type="radio"
                  name="profile_visibility"
                  value="PUBLIC"
                  checked={form.profile_visibility === 'PUBLIC'}
                  onChange={onChange}
                />
                <span className="text-sm font-medium">Public</span>
              </label>
              <label className="flex items-center gap-2 rounded-soft border border-line bg-white px-4 py-3">
                <input
                  type="radio"
                  name="profile_visibility"
                  value="PRIVATE"
                  checked={form.profile_visibility === 'PRIVATE'}
                  onChange={onChange}
                />
                <span className="text-sm font-medium">Private</span>
              </label>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-soft border border-line bg-cloud px-4 py-3">
            <input
              type="checkbox"
              name="whatsapp_opt_in"
              checked={form.whatsapp_opt_in}
              onChange={onChange}
            />
            <span className="text-sm text-ink">Allow WhatsApp mission alerts</span>
          </label>

          {statusText ? <p className="text-sm font-semibold text-success">{statusText}</p> : null}
          {errorText ? <p className="text-sm font-semibold text-danger">{errorText}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="rounded-soft bg-ink px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </form>
      </Panel>
    </div>
  )
}

export default AccountSettingsPage
