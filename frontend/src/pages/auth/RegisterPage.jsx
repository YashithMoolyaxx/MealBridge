import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchCurrentUser, loginUser, registerUser } from '../../services/authService'
import { saveAuthSession, setAccessToken } from '../../hooks/useAuth'

const roleOptions = [
  { label: 'Donor', value: 'DONOR' },
  { label: 'Volunteer', value: 'VOLUNTEER' },
  { label: 'Receiver NGO', value: 'RECEIVER' },
]

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Z" />
        <circle cx="12" cy="12" r="2.6" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m3 3 18 18" />
      <path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c6 0 9 6 9 6a15.8 15.8 0 0 1-3 3.6" />
      <path d="M6.7 6.8C4.4 8.3 3 12 3 12s3 6 9 6c1.6 0 3-.4 4.1-1" />
      <path d="M14.2 14.2A3 3 0 0 1 9.8 9.8" />
    </svg>
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    username: '',
    email: '',
    phone_number: '',
    role: 'DONOR',
    profile_visibility: 'PUBLIC',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await registerUser(form)
      const tokens = await loginUser({ username: form.username, password: form.password })
      setAccessToken(tokens.access)
      const me = await fetchCurrentUser()
      saveAuthSession(me, tokens.access, tokens.refresh)
      navigate('/app/dashboard')
    } catch (err) {
      const payload = err?.response?.data
      let message = 'Unable to create account. Check fields and try again.'
      if (typeof payload === 'string') {
        message = payload
      } else if (payload?.detail) {
        message = payload.detail
      } else if (payload && typeof payload === 'object') {
        const firstKey = Object.keys(payload)[0]
        if (firstKey) {
          const raw = payload[firstKey]
          message = `${firstKey}: ${Array.isArray(raw) ? raw[0] : raw}`
        }
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold">Create account</h2>
      <p className="mt-1 text-sm text-slate">Choose role, privacy preference, and onboard with verification workflow.</p>
      <form className="mt-6 space-y-4 rounded-soft border border-line bg-cloud/70 p-4" onSubmit={onSubmit} autoComplete="off">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Username</span>
            <input
              name="username"
              value={form.username}
              onChange={onChange}
              className="w-full rounded-soft border border-line px-4 py-3 outline-none transition focus:border-ink/50"
              placeholder="username"
              autoComplete="off"
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Email</span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              className="w-full rounded-soft border border-line px-4 py-3 outline-none transition focus:border-ink/50"
              placeholder="mail@example.com"
              autoComplete="off"
              required
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Phone number</span>
          <input
            name="phone_number"
            value={form.phone_number}
            onChange={onChange}
            className="w-full rounded-soft border border-line px-4 py-3 outline-none transition focus:border-ink/50"
            placeholder="+91..."
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Role</span>
            <select
              name="role"
              value={form.role}
              onChange={onChange}
              className="w-full rounded-soft border border-line px-4 py-3 outline-none transition focus:border-ink/50"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Profile visibility</span>
            <select
              name="profile_visibility"
              value={form.profile_visibility}
              onChange={onChange}
              className="w-full rounded-soft border border-line px-4 py-3 outline-none transition focus:border-ink/50"
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Password</span>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              minLength={8}
              value={form.password}
              onChange={onChange}
              className="w-full rounded-soft border border-line px-4 py-3 pr-14 outline-none transition focus:border-ink/50"
              placeholder="Password (min 8 chars)"
              autoComplete="off"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate hover:bg-cloud"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </label>
        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
        <button
          disabled={loading}
          className="w-full rounded-soft bg-gradient-to-r from-accent to-ink px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate">
        Already have an account?{' '}
        <Link to="/auth/login" className="font-semibold text-ink underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export default RegisterPage
