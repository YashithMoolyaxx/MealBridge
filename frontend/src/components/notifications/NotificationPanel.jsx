import { useEffect, useState } from 'react'
import Panel from '../ui/Panel'
import { listNotifications } from '../../services/notificationService'
import { approveDelivery, approveVolunteerRequest, rejectDelivery, rejectVolunteerRequest } from '../../services/missionService'

function NotificationPanel() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState('')

  useEffect(() => {
    let alive = true
    const load = () => {
      listNotifications()
        .then((data) => {
          if (!alive) return
          setItems(data)
        })
        .catch(() => {
          if (!alive) return
          setError('Unable to load notifications.')
        })
        .finally(() => {
          if (!alive) return
          setLoading(false)
        })
    }

    load()
    const timer = setInterval(load, 20000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const refreshNotifications = async () => {
    try {
      const data = await listNotifications()
      setItems(data)
    } catch (err) {
      setError('Unable to load notifications.')
    }
  }

  return (
    <Panel>
      <h3 className="text-base font-semibold">Notifications</h3>
      {loading ? <p className="mt-2 text-sm text-slate">Loading notifications...</p> : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className="mt-2 text-sm text-slate">No notifications yet.</p>
      ) : null}
      <ul className="mt-3 space-y-2 text-sm text-slate">
        {items.map((item) => (
          <li key={item.id} className="rounded-soft border border-line bg-cloud px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-slate">{item.channel.replace('_', ' ')}</p>
            <p className="mt-1 text-sm font-semibold text-ink">{item.title}</p>
            <p className="mt-1 text-sm text-slate">{item.body}</p>
            {item.payload?.action === 'VOLUNTEER_REQUEST' ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    if (!item.payload?.mission_id) return
                    setActionId(item.id)
                    try {
                      await approveVolunteerRequest(item.payload.mission_id)
                      await refreshNotifications()
                    } catch (err) {
                      setError('Unable to approve request.')
                    } finally {
                      setActionId('')
                    }
                  }}
                  disabled={actionId === item.id}
                  className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {actionId === item.id ? 'Approving...' : 'Approve'}
                </button>
                <button
                  onClick={async () => {
                    if (!item.payload?.mission_id) return
                    setActionId(item.id)
                    try {
                      await rejectVolunteerRequest(item.payload.mission_id)
                      await refreshNotifications()
                    } catch (err) {
                      setError('Unable to reject request.')
                    } finally {
                      setActionId('')
                    }
                  }}
                  disabled={actionId === item.id}
                  className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {actionId === item.id ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            ) : null}
            {item.payload?.action === 'DELIVERY_VERIFY' ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    if (!item.payload?.mission_id) return
                    setActionId(item.id)
                    try {
                      await approveDelivery(item.payload.mission_id)
                      await refreshNotifications()
                    } catch (err) {
                      setError('Unable to approve delivery.')
                    } finally {
                      setActionId('')
                    }
                  }}
                  disabled={actionId === item.id}
                  className="rounded-full bg-success px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {actionId === item.id ? 'Saving...' : 'Accept delivery'}
                </button>
                <button
                  onClick={async () => {
                    if (!item.payload?.mission_id) return
                    setActionId(item.id)
                    try {
                      await rejectDelivery(item.payload.mission_id)
                      await refreshNotifications()
                    } catch (err) {
                      setError('Unable to reject delivery.')
                    } finally {
                      setActionId('')
                    }
                  }}
                  disabled={actionId === item.id}
                  className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {actionId === item.id ? 'Saving...' : 'Reject delivery'}
                </button>
              </div>
            ) : null}
            {item.payload?.mission_id ? (
              <a
                href={`/app/missions/${item.payload.mission_id}`}
                className="mt-2 inline-flex rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink"
              >
                View mission
              </a>
            ) : null}
            <p className="mt-2 text-xs text-slate">
              {new Date(item.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export default NotificationPanel
