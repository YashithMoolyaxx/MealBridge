import { Link } from 'react-router-dom'
import { isAuthenticated } from '../hooks/useAuth'
import Logo from '../components/ui/Logo'

const metrics = [
  ['Food rescued this week', '12,480 meals'],
  ['Average pickup response', '8 min'],
  ['Mission completion rate', '96.2%'],
  ['Verified NGOs', '74'],
]

const lifecycle = [
  ['Created', 'Donation mission posted with expiry and pickup location.'],
  ['Volunteer Assigned', 'Nearest volunteer accepts within radius alert window.'],
  ['Pickup In Progress', 'Donor confirms with one-time pickup QR scan.'],
  ['On Route', 'ETA updates continuously using maps travel estimates.'],
  ['Delivered', 'NGO confirms final handover using delivery QR token.'],
  ['Completed', 'Timeline is locked and contribution enters impact feed.'],
]

const roleCards = [
  ['Donors', 'Create donation cards, fulfill NGO requirements, and issue reward vouchers.'],
  ['Volunteers', 'Receive nearby missions, scan checkpoints, and earn karma points.'],
  ['Receivers', 'Post urgent requirements and track verified inbound deliveries.'],
]

function LandingPage() {
  const loggedIn = isAuthenticated()

  return (
    <div className="animate-page-in relative min-h-screen overflow-hidden bg-gradient-to-b from-white via-cloud to-cloud text-ink">
      <div className="animate-glow pointer-events-none absolute left-[-120px] top-[-120px] h-[320px] w-[320px] rounded-full bg-accent/20 blur-3xl" />
      <div className="animate-glow pointer-events-none absolute bottom-[-140px] right-[-80px] h-[320px] w-[320px] rounded-full bg-sunrise/25 blur-3xl" />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Logo />
        <div className="flex gap-2">
          <Link to="/auth/login" className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold shadow-card">
            Login
          </Link>
          <Link to="/auth/register" className="rounded-full bg-gradient-to-r from-accent to-ink px-4 py-2 text-sm font-semibold text-white shadow-card">
            Sign up
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="animate-fade-up text-xs uppercase tracking-[0.25em] text-slate">Mission-first food logistics</p>
            <h1 className="animate-fade-up-delayed mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
              Move surplus food from kitchen to community with proof, speed, and trust.
            </h1>
            <p className="animate-fade-up-delayed-2 mt-5 max-w-2xl text-lg text-slate">
              MealBridge links donors, volunteers, and NGOs through verified mission states, dual QR checkpoints, and transparent impact reporting.
            </p>

            <div className="animate-fade-up-delayed-2 mt-8 flex flex-wrap gap-3">
              <Link
                to={loggedIn ? '/app/dashboard' : '/auth/register'}
                className="rounded-full bg-gradient-to-r from-accent to-ink px-6 py-3 text-sm font-semibold text-white shadow-card"
              >
                {loggedIn ? 'Open dashboard' : 'Launch mission workflow'}
              </Link>
              <Link to="/app/impact" className="rounded-full border border-line bg-white px-6 py-3 text-sm font-semibold shadow-card">
                View impact feed
              </Link>
            </div>
          </div>

          <div className="animate-fade-up-delayed-2 rounded-soft border border-line bg-white p-5 shadow-panel">
            <p className="text-xs uppercase tracking-[0.14em] text-slate">Live mission snapshot</p>
            <h2 className="mt-2 text-xl font-bold">Mission M-8942</h2>
            <div className="mt-4 space-y-2 text-sm">
              <p className="rounded-lg bg-bloom px-3 py-2">12:05 PM - Donation posted</p>
              <p className="rounded-lg bg-bloom px-3 py-2">12:10 PM - Volunteer assigned</p>
              <p className="rounded-lg bg-bloom px-3 py-2">12:18 PM - Pickup QR scanned</p>
              <p className="rounded-lg bg-bloom px-3 py-2">12:34 PM - Delivery QR scanned</p>
              <p className="rounded-lg bg-bloom px-3 py-2">12:35 PM - Mission completed</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {metrics.map(([label, value]) => (
            <article key={label} className="animate-float rounded-soft border border-line bg-white p-4 shadow-card">
              <p className="text-xs uppercase tracking-[0.12em] text-slate">{label}</p>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-soft border border-line bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate">Lifecycle precision</p>
              <h3 className="mt-1 text-2xl font-bold">Mission state machine</h3>
            </div>
            <p className="text-sm text-slate">Every transition is validated, timestamped, and visible in timeline history.</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {lifecycle.map(([title, text]) => (
              <article key={title} className="rounded-soft border border-line bg-cloud p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm text-slate">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-2xl font-bold">Built for every actor in the supply chain</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {roleCards.map(([title, text]) => (
              <article key={title} className="rounded-soft border border-line bg-white p-5 shadow-card">
                <h4 className="text-lg font-semibold">{title}</h4>
                <p className="mt-2 text-sm text-slate">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-soft border border-line bg-gradient-to-r from-ink to-accent p-7 text-white shadow-panel">
          <p className="text-xs uppercase tracking-[0.14em] text-white/70">Transparency by design</p>
          <h3 className="mt-2 text-2xl font-bold sm:text-3xl">Public impact with user-controlled visibility</h3>
          <p className="mt-3 max-w-3xl text-sm text-white/80">
            Users can set profile visibility to Public or Private in account settings. Public profiles display names in impact feed, while Private profiles are shown anonymously.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to={loggedIn ? '/app/account' : '/auth/register'} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink">
              {loggedIn ? 'Manage privacy settings' : 'Create account'}
            </Link>
            <Link to="/auth/login" className="rounded-full border border-white/50 px-5 py-3 text-sm font-semibold">
              Sign in
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

export default LandingPage
