import { Link, NavLink, Outlet } from 'react-router-dom'
import Logo from '../components/ui/Logo'

function AuthLayout() {
  return (
    <div className="animate-page-in relative flex min-h-screen items-center justify-center overflow-hidden bg-cloud p-6">
      <div className="animate-glow pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
      <div className="animate-glow pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-sunrise/20 blur-3xl" />
      <div className="grid w-full max-w-5xl overflow-hidden rounded-soft border border-line bg-white shadow-panel md:grid-cols-2">
        <section className="bg-gradient-to-br from-ink to-accent p-6 text-white sm:p-8">
          <Logo tone="light" />
          <h2 className="mt-3 text-3xl font-bold leading-tight">Coordinate surplus food with verified mission control.</h2>
          <p className="mt-4 text-sm text-white/75">
            Track each handoff with QR evidence, location-aware dispatch, and transparent completion timelines.
          </p>
          <div className="mt-6 space-y-2 text-sm text-white/80">
            <p className="rounded-lg border border-white/20 px-3 py-2">State machine driven workflow</p>
            <p className="rounded-lg border border-white/20 px-3 py-2">Public impact with privacy controls</p>
            <p className="rounded-lg border border-white/20 px-3 py-2">WhatsApp + in-app mission alerts</p>
          </div>
          <Link to="/" className="mt-6 inline-block rounded-full border border-white/40 px-4 py-2 text-sm">
            Back to landing
          </Link>
        </section>
        <section className="bg-white p-6 sm:p-8">
          <div className="mb-5 flex gap-2">
            <NavLink
              to="/auth/login"
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-xs font-semibold ${isActive ? 'bg-gradient-to-r from-accent to-ink text-white' : 'bg-cloud text-slate'}`
              }
            >
              Login
            </NavLink>
            <NavLink
              to="/auth/register"
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-xs font-semibold ${isActive ? 'bg-gradient-to-r from-accent to-ink text-white' : 'bg-cloud text-slate'}`
              }
            >
              Sign up
            </NavLink>
          </div>
          <Outlet />
        </section>
      </div>
    </div>
  )
}

export default AuthLayout
