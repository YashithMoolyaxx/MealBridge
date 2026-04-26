import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NotificationPanel from '../../components/notifications/NotificationPanel'
import Panel from '../../components/ui/Panel'
import { getDisplayName, getStoredUser, setStoredUser } from '../../hooks/useAuth'
import { fetchCurrentUser } from '../../services/authService'

const roleDashboard = {
  DONOR: {
    heading: 'Donor Dashboard Focus',
    summary: 'Create donation missions, fulfill NGO requirements, and run voucher campaigns.',
    links: [
      ['Create Donation', '/app/missions/new-donation'],
      ['Requirements Feed', '/app/requirements'],
      ['Voucher Campaigns', '/app/rewards/vouchers'],
    ],
  },
  VOLUNTEER: {
    heading: 'Volunteer Dashboard Focus',
    summary: 'Accept nearby missions, complete QR checkpoints, and track karma growth.',
    links: [
      ['My Missions', '/app/missions/volunteer'],
      ['Impact Feed', '/app/impact'],
      ['Redeem Rewards', '/app/rewards/redeem'],
    ],
  },
  RECEIVER: {
    heading: 'Receiver Dashboard Focus',
    summary: 'Post urgent requirements and monitor incoming mission timelines.',
    links: [
      ['Create Requirement', '/app/missions/new-requirement'],
      ['Donation Feed', '/app/donations'],
      ['Impact Feed', '/app/impact'],
    ],
  },
}

function ProfilePage() {
  const [user, setUser] = useState(() => getStoredUser())
  const displayName = getDisplayName(user)
  const dashboard = roleDashboard[user?.role] || {
    heading: 'Dashboard Focus',
    summary: 'Use your dashboard navigation to continue operations.',
    links: [['Open Dashboard', '/app/dashboard']],
  }

  useEffect(() => {
    fetchCurrentUser()
      .then((payload) => {
        setStoredUser(payload)
        setUser(payload)
      })
      .catch(() => null)
  }, [])

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Panel>
        <h2 className="text-2xl font-bold">{displayName}</h2>
        <p className="mt-1 text-sm text-slate">{user?.email || 'No email available'}</p>
        <p className="mt-3 inline-block rounded-full bg-cloud px-3 py-1 text-xs font-semibold text-slate">
          Role: {user?.role || 'Member'}
        </p>
        <p className="ml-2 mt-3 inline-block rounded-full bg-cloud px-3 py-1 text-xs font-semibold text-slate">
          Profile: {user?.profile_visibility || 'PUBLIC'}
        </p>

        <div className="mt-6 rounded-soft border border-line bg-cloud p-4">
          <h3 className="text-base font-semibold">{dashboard.heading}</h3>
          <p className="mt-1 text-sm text-slate">{dashboard.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {dashboard.links.map(([label, path]) => (
              <Link key={path} to={path} className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white">
                {label}
              </Link>
            ))}
            <Link to="/app/account" className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-ink">
              Manage account
            </Link>
          </div>
        </div>
      </Panel>
      <NotificationPanel />
    </div>
  )
}

export default ProfilePage
