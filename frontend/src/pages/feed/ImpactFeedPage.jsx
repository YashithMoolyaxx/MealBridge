import { useEffect, useState } from 'react'
import Panel from '../../components/ui/Panel'
import { fetchImpactFeed } from '../../services/feedService'

function ImpactFeedPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchImpactFeed()
      .then((payload) => {
        const list = Array.isArray(payload?.results) ? payload.results : payload
        setEntries(Array.isArray(list) ? list : [])
      })
      .catch(() => setError('Unable to load impact feed right now.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Impact Feed</h2>
      <p className="text-sm text-slate">
        Public feed respects profile visibility. Private contributors are shown as anonymous.
      </p>

      {loading ? <Panel>Loading impact feed...</Panel> : null}
      {error ? <Panel>{error}</Panel> : null}
      {!loading && !error && entries.length === 0 ? <Panel>No completed public missions yet.</Panel> : null}

      {entries.map((entry) => (
        <Panel key={entry.id}>
          <p className="text-sm text-slate">Mission {entry.mission}</p>
          <p className="mt-1 text-lg font-semibold">{entry.beneficiary_count || 0} beneficiaries served</p>
          <p className="mt-2 text-sm text-slate">
            {entry.donor_name} {'->'} {entry.volunteer_name} {'->'} {entry.receiver_name}
          </p>
          {entry.public_note ? <p className="mt-2 text-sm text-slate">{entry.public_note}</p> : null}
        </Panel>
      ))}
    </div>
  )
}

export default ImpactFeedPage
