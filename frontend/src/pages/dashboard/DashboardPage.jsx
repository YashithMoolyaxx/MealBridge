import { useEffect, useState } from 'react'
import Panel from '../../components/ui/Panel'
import { getDisplayName, getStoredUser } from '../../hooks/useAuth'
import { fetchDashboardStats } from '../../services/authService'

function DashboardPage() {
  const user = getStoredUser()
  const name = getDisplayName(user)
  const [stats, setStats] = useState({
    completed_missions: 0,
    meals_rescued: 0,
    karma_points: 0,
    last_completed_at: null,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboardStats()
      .then((data) => {
        setStats(data)
        setError('')
      })
      .catch(() => setError('Unable to load dashboard stats.'))
  }, [])

  const statCards = [
    ['Completed Missions', stats.completed_missions],
    ['Meals Rescued', `${stats.meals_rescued} meals`],
    ['Karma Points', stats.karma_points],
    [
      'Last Completed',
      stats.last_completed_at
        ? new Date(stats.last_completed_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : 'No missions yet',
    ],
  ]

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold">Operations Dashboard</h2>
        <p className="text-sm text-slate">
          {name}, this is your {user?.role || 'Member'} control surface for real-time mission orchestration.
        </p>
      </section>

      {error ? <Panel>{error}</Panel> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(([label, value]) => (
          <Panel key={label}>
            <p className="text-sm text-slate">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </Panel>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h3 className="text-base font-semibold">Mission Health</h3>
          <p className="mt-2 text-sm text-slate">96.2% on-time completion rate over last 7 days.</p>
        </Panel>
        <Panel>
          <h3 className="text-base font-semibold">Risk Queue</h3>
          <p className="mt-2 text-sm text-slate">4 missions near expiry window require escalation.</p>
        </Panel>
      </section>
    </div>
  )
}

export default DashboardPage
