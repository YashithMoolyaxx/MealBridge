import { useEffect, useMemo, useState } from 'react'
import Panel from '../../components/ui/Panel'
import { fetchLeaderboard } from '../../services/authService'

const roles = [
  { label: 'Donors', value: 'DONOR' },
  { label: 'Volunteers', value: 'VOLUNTEER' },
  { label: 'Receivers', value: 'RECEIVER' },
]

const medals = ['🥇', '🥈', '🥉']

function LeaderboardPage() {
  const [role, setRole] = useState('VOLUNTEER')
  const [entries, setEntries] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchLeaderboard(role)
      .then((data) => {
        setEntries(data)
        setError('')
      })
      .catch(() => setError('Unable to load leaderboard.'))
      .finally(() => setLoading(false))
  }, [role])

  const topThree = useMemo(() => entries.slice(0, 3), [entries])
  const rest = useMemo(() => entries.slice(3), [entries])

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold">Leaderboard</h2>
        <p className="text-sm text-slate">
          Rank the top contributors by karma points across donors, volunteers, and receivers.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {roles.map((item) => (
          <button
            key={item.value}
            onClick={() => setRole(item.value)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              role === item.value ? 'bg-gradient-to-r from-accent to-ink text-white' : 'bg-cloud text-slate'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <Panel>Loading leaderboard...</Panel> : null}
      {error ? <Panel>{error}</Panel> : null}

      {topThree.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-3">
          {topThree.map((entry, index) => (
            <Panel key={entry.id} className="relative">
              <div className="absolute right-4 top-4 text-2xl">{medals[index]}</div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate">Rank #{index + 1}</p>
              <h3 className="mt-2 text-lg font-semibold">{entry.username}</h3>
              <p className="mt-1 text-sm text-slate">Karma: {entry.karma_points}</p>
              <p className="mt-1 text-sm text-slate">Completed missions: {entry.completed_missions}</p>
              <p className="mt-1 text-sm text-slate">Meals rescued: {entry.meals_rescued}</p>
            </Panel>
          ))}
        </section>
      ) : null}

      {rest.length > 0 ? (
        <Panel>
          <div className="space-y-3">
            {rest.map((entry, index) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold">{index + 4}. {entry.username}</p>
                  <p className="text-xs text-slate">Completed: {entry.completed_missions} · Meals: {entry.meals_rescued}</p>
                </div>
                <span className="rounded-full bg-cloud px-3 py-1 text-xs font-semibold text-slate">Karma {entry.karma_points}</span>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  )
}

export default LeaderboardPage
