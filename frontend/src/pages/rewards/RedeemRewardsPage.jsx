import { useEffect, useState } from 'react'
import Panel from '../../components/ui/Panel'
import { getStoredUser, setStoredUser } from '../../hooks/useAuth'
import { fetchCurrentUser } from '../../services/authService'
import { listMyRedemptions, listVoucherCampaigns, redeemVoucher } from '../../services/rewardService'

function RedeemRewardsPage() {
  const [user, setUser] = useState(() => getStoredUser())
  const [campaigns, setCampaigns] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    Promise.all([fetchCurrentUser(), listVoucherCampaigns(), listMyRedemptions()])
      .then(([me, campaignItems, redemptionItems]) => {
        setUser(me)
        setStoredUser(me)
        setCampaigns(campaignItems)
        setRedemptions(redemptionItems)
      })
      .catch(() => setError('Unable to load rewards right now.'))
      .finally(() => setLoading(false))
  }, [])

  const onRedeem = async (campaign) => {
    if (user?.role !== 'VOLUNTEER') {
      setError('Only volunteer accounts can redeem rewards.')
      return
    }

    setInfo('')
    setError('')
    try {
      const result = await redeemVoucher(campaign.id)
      setInfo(`Voucher redeemed: ${result.code}`)
      const updated = await listMyRedemptions()
      setRedemptions(updated)
    } catch (err) {
      const message = err?.response?.data?.detail || 'Redemption failed.'
      setError(message)
    }
  }

  const redeemedCampaignIds = new Set(redemptions.map((item) => item.campaign))

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Redeem Rewards</h2>
      <p className="text-sm text-slate">Available karma: {user?.karma_points || 0}</p>
      {user?.role !== 'VOLUNTEER' ? <Panel>Only volunteer accounts can redeem karma rewards.</Panel> : null}
      {loading ? <Panel>Loading rewards...</Panel> : null}
      {error ? <Panel>{error}</Panel> : null}
      {info ? <Panel>{info}</Panel> : null}

      {campaigns.map((campaign) => {
        const eligible = campaign.can_redeem
        const alreadyRedeemed = redeemedCampaignIds.has(campaign.id)

        return (
          <Panel key={campaign.id}>
            <h3 className="text-lg font-semibold">{campaign.title}</h3>
            <p className="mt-1 text-sm text-slate">{campaign.offer_text}</p>
            <p className="mt-2 text-sm text-slate">Required karma: {campaign.required_karma}</p>
            <button
              disabled={!eligible || alreadyRedeemed || user?.role !== 'VOLUNTEER'}
              onClick={() => onRedeem(campaign)}
              className="mt-4 rounded-soft bg-gradient-to-r from-accent to-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {alreadyRedeemed ? 'Already redeemed' : eligible ? 'Redeem now' : 'Not enough karma'}
            </button>
          </Panel>
        )
      })}

      {redemptions.length ? (
        <Panel>
          <h3 className="text-base font-semibold">My Redemption Codes</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate">
            {redemptions.map((item) => (
              <li key={item.id} className="rounded-soft border border-line bg-cloud px-3 py-2">
                {item.campaign_title}: <span className="font-semibold text-ink">{item.code}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}

export default RedeemRewardsPage
