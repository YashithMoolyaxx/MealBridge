import { useEffect, useState } from 'react'
import RequirementCard from '../../components/cards/RequirementCard'
import { fetchRequirementFeed } from '../../services/feedService'

function RequirementFeedPage() {
  const [requirements, setRequirements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchRequirementFeed()
      .then((items) => setRequirements(items))
      .catch(() => setError('Unable to load requirement feed.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Requirement Feed</h2>
      <p className="text-sm text-slate">This feed shows requirement forms posted by receiver NGOs.</p>
      {loading ? <p className="text-sm text-slate">Loading requirements...</p> : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
      {!loading && !error && requirements.length === 0 ? <p className="text-sm text-slate">No requirement posts yet.</p> : null}
      {requirements.map((item) => (
        <RequirementCard
          key={item.id}
          ngo={item.receiver_name}
          need={`${item.meals_needed} meals`}
          urgency={item.urgency}
          location={item.location_address}
          before={new Date(item.required_before).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        />
      ))}
    </div>
  )
}

export default RequirementFeedPage
