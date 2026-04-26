import { useEffect, useMemo, useState } from 'react'
import MissionCard from '../../components/cards/MissionCard'
import { listMissions } from '../../services/missionService'

function DonationFeedPage() {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [, setTicker] = useState(0)

  useEffect(() => {
    Promise.all([listMissions({ state: 'COMPLETED' }), listMissions({ state: 'DELIVERY_REJECTED' })])
      .then(([completed, rejected]) => {
        setMissions([...(completed || []), ...(rejected || [])])
        setError('')
      })
      .catch(() => setError('Unable to load completed donations.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setTicker((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const cards = useMemo(() => {
    return missions.map((mission) => {
      const isRejected = mission.state === 'DELIVERY_REJECTED'
      const statusText = isRejected ? 'Delivery rejected' : 'Completed'
      const statusTime = new Date(mission.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      return {
        id: mission.id,
        title: `${mission.donation_food_quantity || 0} ${mission.donation_quantity_unit || ''} - ${mission.donation_food_title || 'Donation'}`,
        subtitle: mission.receiver_name || 'Receiver NGO',
        meta: [mission.delivery_address, `${statusText} ${statusTime}`],
        donatedBy: mission.donor_name || 'Donor',
        isRejected,
      }
    })
  }, [missions])

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Completed Donations</h2>
      {loading ? <p className="text-sm text-slate">Loading completed missions...</p> : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
      {!loading && !error && cards.length === 0 ? <p className="text-sm text-slate">No completed donations yet.</p> : null}
      {cards.map((item) => (
        <div key={item.id}>
          <MissionCard
            title={item.title}
            subtitle={item.subtitle}
            meta={item.meta}
            className={item.isRejected ? 'border-danger/40 bg-danger/5' : 'border-success/30 bg-success/5'}
          />
          <p className={`mt-2 text-sm font-semibold ${item.isRejected ? 'text-danger' : 'text-success'}`}>
            {item.isRejected ? 'Incomplete delivery' : 'Done successfully'} · Donated by {item.donatedBy}
          </p>
        </div>
      ))}
    </div>
  )
}

export default DonationFeedPage
