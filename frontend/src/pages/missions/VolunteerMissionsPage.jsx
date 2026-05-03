import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Panel from '../../components/ui/Panel'
import Modal from '../../components/ui/Modal'
import { getDisplayName, getStoredUser } from '../../hooks/useAuth'
import {
  acceptMission,
  approveDelivery,
  approveVolunteerRequest,
  cancelMission,
  getMission,
  getAdvancedHungerRoute,
  listMissions,
  rejectDelivery,
  rejectVolunteerRequest,
  requestDeliveryVerification,
} from '../../services/missionService'
import { formatCountdown, formatMissionState } from '../../utils/formatters'

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

const KARMA_TIERS = [
  { maxKg: 5, donor: 5, volunteer: 10, receiver: 3 },
  { maxKg: 15, donor: 10, volunteer: 20, receiver: 6 },
  { maxKg: Infinity, donor: 20, volunteer: 35, receiver: 10 },
]

const ROUTING_READY_STATES = ['CREATED', 'REQUESTED', 'VOLUNTEER_ASSIGNED']
const RELIABLE_ROUTE_DISTANCE_MARGIN = 0.05

function estimateKg(quantity, unit) {
  const qty = Number(quantity) || 0
  const unitText = (unit || '').toLowerCase()
  if (!qty) return 0
  if (unitText.includes('kg')) return qty
  if (unitText.includes('meal')) return qty * 0.4
  if (unitText.includes('pack')) return qty * 0.5
  return qty
}

function getKarmaForKg(kg) {
  return KARMA_TIERS.find((tier) => kg <= tier.maxKg) || KARMA_TIERS[KARMA_TIERS.length - 1]
}

function isRoutingCandidate(mission) {
  return Boolean(mission?.donation_card) && ROUTING_READY_STATES.includes(mission.state)
}

function formatRoutingError(err) {
  const payload = err?.response?.data
  if (typeof payload === 'string') return payload
  if (Array.isArray(payload)) return payload.filter(Boolean).join(' ')
  if (payload?.detail) return payload.detail
  if (Array.isArray(payload?.detail)) return payload.detail.filter(Boolean).join(' ')
  if (Array.isArray(payload?.volunteer_address)) return payload.volunteer_address.filter(Boolean).join(' ')
  if (Array.isArray(payload?.algorithm)) return payload.algorithm.filter(Boolean).join(' ')
  if (Array.isArray(payload?.donation_ids)) return payload.donation_ids.filter(Boolean).join(' ')
  if (payload?.volunteer_address) return payload.volunteer_address
  if (payload?.algorithm) return payload.algorithm
  if (payload?.donation_ids) return payload.donation_ids
  return 'Unable to generate smart route.'
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDistanceKm(value) {
  return `${toNumber(value).toFixed(2)} km`
}

function formatUrgency(value) {
  return toNumber(value).toFixed(2)
}

function pickRecommendedRoute(routes = []) {
  if (!Array.isArray(routes) || routes.length === 0) return null

  const grouped = new Map()
  for (const route of routes) {
    const key = (route?.ordered_donation_ids || []).join('|')
    const existing = grouped.get(key)
    if (existing) {
      existing.supportCount += 1
      existing.algorithms.add(route.algorithm || 'route-check')
      existing.totalHungerScore = Math.max(existing.totalHungerScore, toNumber(route.total_hunger_score))
      existing.totalDistanceKm = Math.min(existing.totalDistanceKm, toNumber(route.total_distance_km))
    } else {
      grouped.set(key, {
        route,
        supportCount: 1,
        algorithms: new Set([route?.algorithm || 'route-check']),
        totalDistanceKm: toNumber(route?.total_distance_km),
        totalHungerScore: toNumber(route?.total_hunger_score),
      })
    }
  }

  const candidates = [...grouped.values()]
  const shortestDistance = Math.min(...candidates.map((candidate) => candidate.totalDistanceKm))

  candidates.sort((left, right) => {
    if (right.supportCount !== left.supportCount) return right.supportCount - left.supportCount

    const leftCloseToBest = left.totalDistanceKm <= shortestDistance * (1 + RELIABLE_ROUTE_DISTANCE_MARGIN)
    const rightCloseToBest = right.totalDistanceKm <= shortestDistance * (1 + RELIABLE_ROUTE_DISTANCE_MARGIN)
    if (leftCloseToBest !== rightCloseToBest) return rightCloseToBest - leftCloseToBest

    if (left.totalDistanceKm !== right.totalDistanceKm) return left.totalDistanceKm - right.totalDistanceKm
    return right.totalHungerScore - left.totalHungerScore
  })

  const winner = candidates[0]
  if (!winner) return null

  return {
    ...winner.route,
    supportCount: winner.supportCount,
    comparedRouteCount: routes.length,
    agreementRatio: routes.length ? winner.supportCount / routes.length : 0,
    algorithmSupport: [...winner.algorithms],
  }
}

function describeRecommendation(route) {
  if (!route) return ''
  if (route.supportCount === route.comparedRouteCount) {
    return 'Every route check agreed on this pickup order, so this is the most reliable run to follow.'
  }
  if (route.supportCount > 1) {
    return `Most route checks agreed on this order, balancing urgency and travel time for a dependable run.`
  }
  return 'MealBridge selected the strongest route by balancing urgency and travel distance behind the scenes.'
}

function VolunteerMissionsPage() {
  const user = getStoredUser()
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')
  const [selectedMission, setSelectedMission] = useState(null)
  const [showQr, setShowQr] = useState(false)
  const [acceptingId, setAcceptingId] = useState('')
  const [approvingId, setApprovingId] = useState('')
  const [rejectingId, setRejectingId] = useState('')
  const [verifyingId, setVerifyingId] = useState('')
  const [deliveryDecisionId, setDeliveryDecisionId] = useState('')
  const [cancelingId, setCancelingId] = useState('')
  const [confirmMission, setConfirmMission] = useState(null)
  const [removingId, setRemovingId] = useState('')
  const [toast, setToast] = useState('')
  const [selectedRouteMissionIds, setSelectedRouteMissionIds] = useState([])
  const [routingAddress, setRoutingAddress] = useState('')
  const [routingLoading, setRoutingLoading] = useState(false)
  const [routingError, setRoutingError] = useState('')
  const [routingResult, setRoutingResult] = useState(null)
  const [, setTicker] = useState(0)

  useEffect(() => {
    listMissions()
      .then((items) => setMissions(items.filter((item) => item.state !== 'CANCELLED')))
      .catch(() => setError('Unable to load missions.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setTicker((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (user?.role !== 'VOLUNTEER') return
    const availableIds = missions.filter(isRoutingCandidate).map((mission) => mission.id)
    setSelectedRouteMissionIds((prev) => {
      const stillVisible = prev.filter((missionId) => availableIds.includes(missionId))
      if (stillVisible.length) return stillVisible
      return availableIds.slice(0, 4)
    })
    if (!availableIds.length) {
      setRoutingResult(null)
      setRoutingError('')
    }
  }, [missions, user?.role])

  const openModal = async (missionId) => {
    setModalOpen(true)
    setModalLoading(true)
    setModalError('')
    setShowQr(false)
    try {
      const payload = await getMission(missionId)
      setSelectedMission(payload)
    } catch (err) {
      setModalError('Unable to load mission details.')
    } finally {
      setModalLoading(false)
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedMission(null)
    setModalError('')
    setShowQr(false)
  }

  const handleAccept = async (missionId) => {
    if (user?.role !== 'VOLUNTEER') return
    setAcceptingId(missionId)
    try {
      const updated = await acceptMission(missionId)
      setMissions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      if (selectedMission?.id === updated.id) {
        setSelectedMission(updated)
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to accept mission.')
    } finally {
      setAcceptingId('')
    }
  }

  const handleApproveRequest = async (missionId) => {
    setApprovingId(missionId)
    try {
      const updated = await approveVolunteerRequest(missionId)
      setMissions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      if (selectedMission?.id === updated.id) {
        setSelectedMission(updated)
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to approve request.')
    } finally {
      setApprovingId('')
    }
  }

  const handleRejectRequest = async (missionId) => {
    setRejectingId(missionId)
    try {
      const updated = await rejectVolunteerRequest(missionId)
      setMissions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      if (selectedMission?.id === updated.id) {
        setSelectedMission(updated)
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to reject request.')
    } finally {
      setRejectingId('')
    }
  }

  const handleRequestDelivery = async (missionId) => {
    setVerifyingId(missionId)
    try {
      const updated = await requestDeliveryVerification(missionId)
      setMissions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      if (selectedMission?.id === updated.id) {
        setSelectedMission(updated)
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to request delivery verification.')
    } finally {
      setVerifyingId('')
    }
  }

  const handleDeliveryDecision = async (missionId, decision) => {
    setDeliveryDecisionId(missionId)
    try {
      const updated = decision === 'approve' ? await approveDelivery(missionId) : await rejectDelivery(missionId)
      setMissions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      if (selectedMission?.id === updated.id) {
        setSelectedMission(updated)
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to update delivery status.')
    } finally {
      setDeliveryDecisionId('')
    }
  }

  const requestCancel = (mission) => {
    if (user?.id == null || user?.id !== mission.donor_user) return
    setConfirmMission(mission)
  }

  const handleCancel = async () => {
    if (!confirmMission) return
    const missionId = confirmMission.id
    setCancelingId(missionId)
    try {
      await cancelMission(missionId)
      setRemovingId(missionId)
      setTimeout(() => {
        setMissions((prev) => prev.filter((item) => item.id !== missionId))
        if (selectedMission?.id === missionId) {
          setSelectedMission(null)
          setModalOpen(false)
        }
        setToast(`${confirmMission.donation_food_title || 'Mission'} is deleted`)
        setRemovingId('')
      }, 260)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to cancel mission.')
    } finally {
      setCancelingId('')
      setConfirmMission(null)
    }
  }

  const toggleRouteMission = (missionId) => {
    setSelectedRouteMissionIds((prev) =>
      prev.includes(missionId) ? prev.filter((item) => item !== missionId) : [...prev, missionId]
    )
  }

  const selectAllRouteMissions = () => {
    setSelectedRouteMissionIds(missions.filter(isRoutingCandidate).map((mission) => mission.id))
  }

  const clearRouteSelection = () => {
    setSelectedRouteMissionIds([])
    setRoutingResult(null)
    setRoutingError('')
  }

  const runSmartRoute = async () => {
    const selectedMissions = missions.filter((mission) => selectedRouteMissionIds.includes(mission.id))
    const donationIds = [...new Set(selectedMissions.map((mission) => mission.donation_card).filter(Boolean))]

    if (!donationIds.length) {
      setRoutingError('Select at least one mission with a donation card.')
      setRoutingResult(null)
      return
    }

    setRoutingLoading(true)
    setRoutingError('')
    try {
      const payload = {
        algorithm: 'compare',
        donation_ids: donationIds,
      }
      if (routingAddress.trim()) {
        payload.volunteer_address = routingAddress.trim()
      }
      const response = await getAdvancedHungerRoute(payload)
      setRoutingResult(response)
    } catch (err) {
      setRoutingResult(null)
      setRoutingError(formatRoutingError(err))
    } finally {
      setRoutingLoading(false)
    }
  }

  const pickupQrToken = selectedMission?.qr_tokens?.find((token) => token.qr_type === 'PICKUP' && token.is_active)
  const pickupQrUrl = pickupQrToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pickupQrToken.token)}`
    : ''
  const routeCandidates = missions.filter(isRoutingCandidate)
  const recommendedRoute = pickRecommendedRoute(routingResult?.routes)
  const skippedCount = routingResult?.skipped_donations?.length || 0

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Mission Board</h2>
      <p className="text-sm text-slate">
        {getDisplayName(user)}, these are your active and historical missions with real-time expiry countdown.
      </p>

      {user?.role === 'VOLUNTEER' ? (
        <Panel className="overflow-hidden border border-line/80 bg-white">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.18),_transparent_55%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_50%)]" />
            <div className="relative space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate">Hunger-Aware Routing</p>
                  <h3 className="mt-1 text-xl font-semibold text-ink">Plan the next pickup run from the volunteer view</h3>
                  <p className="mt-2 max-w-2xl text-sm text-slate">
                    Pick missions and let MealBridge combine multiple route checks behind the scenes to recommend one reliable pickup plan.
                  </p>
                </div>
                <div className="rounded-soft border border-line/70 bg-cloud/70 px-3 py-2 text-right">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate">Route-ready missions</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{routeCandidates.length}</p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.25fr_0.95fr]">
                <div className="rounded-soft border border-line/70 bg-cloud/55 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">Select missions for this pickup batch</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={selectAllRouteMissions}
                        type="button"
                        className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink"
                      >
                        Select all
                      </button>
                      <button
                        onClick={clearRouteSelection}
                        type="button"
                        className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-slate"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {routeCandidates.length === 0 ? (
                      <p className="rounded-soft border border-dashed border-line bg-white px-4 py-3 text-sm text-slate">
                        No pickup-ready missions yet. Create or request a donation mission first.
                      </p>
                    ) : (
                      routeCandidates.map((mission) => {
                        const checked = selectedRouteMissionIds.includes(mission.id)
                        return (
                          <label
                            key={mission.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-soft border px-3 py-3 transition ${
                              checked ? 'border-accent bg-bloom/60 shadow-card' : 'border-line bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRouteMission(mission.id)}
                              className="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-accent"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-ink">
                                  {mission.donation_food_title || 'Food Mission'}
                                </p>
                                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate">
                                  {formatMissionState(mission.state)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs font-semibold text-accent">
                                Donated by {mission.donor_name || 'Donor'}
                              </p>
                              <p className="mt-1 text-xs text-slate">{mission.pickup_address}</p>
                              <p className="mt-1 text-[11px] text-slate">
                                Receiver: {mission.receiver_name || 'Not assigned yet'}
                              </p>
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-soft border border-line/70 bg-white p-4">
                  <div className="grid gap-3">
                    <div className="rounded-soft border border-line/70 bg-cloud/60 px-4 py-3 text-sm text-slate">
                      MealBridge quietly compares multiple routing strategies and shows one dependable route recommendation here for volunteers.
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-[0.16em] text-slate">Volunteer start address override</label>
                      <input
                        type="text"
                        value={routingAddress}
                        onChange={(event) => setRoutingAddress(event.target.value)}
                        placeholder="Optional, for example Andheri East, Mumbai"
                        className="mt-2 w-full rounded-soft border border-line bg-cloud/70 px-4 py-3 text-sm text-ink outline-none placeholder:text-slate focus:border-accent"
                      />
                      <p className="mt-2 text-xs text-slate">
                        Leave blank to use the volunteer&apos;s saved location. Add an address if that location is missing.
                      </p>
                    </div>

                    <button
                      onClick={runSmartRoute}
                      type="button"
                      disabled={routingLoading || routeCandidates.length === 0}
                      className="rounded-soft bg-gradient-to-r from-accent to-ink px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {routingLoading ? 'Building best route...' : 'Build best pickup plan'}
                    </button>

                    {routingError ? <p className="text-sm font-semibold text-danger">{routingError}</p> : null}
                    {routingResult?.start_location ? (
                      <div className="rounded-soft border border-line/70 bg-cloud/60 px-3 py-3 text-sm text-slate">
                        {routingResult.start_location.source === 'address_override'
                          ? `Starting from ${routingAddress.trim()}.`
                          : 'Using the volunteer’s saved start location.'}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {recommendedRoute ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate">Smart route</p>
                      <h4 className="mt-1 text-lg font-semibold text-ink">Recommended pickup plan</h4>
                      <p className="mt-2 max-w-2xl text-sm text-slate">{describeRecommendation(recommendedRoute)}</p>
                    </div>
                    <p className="text-sm text-slate">
                      {skippedCount ? `${skippedCount} mission(s) skipped because location data was missing.` : 'All selected missions were included.'}
                    </p>
                  </div>

                  <div className="rounded-soft border border-success/40 bg-success/5 p-4 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-success">Best route ready</p>
                        <h5 className="mt-1 text-lg font-semibold text-ink">Follow this pickup order</h5>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-white px-3 py-1 text-slate">
                          Distance {formatDistanceKm(recommendedRoute.total_distance_km)}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-slate">
                          Priority {formatUrgency(recommendedRoute.total_hunger_score)}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-slate">
                          Stops {recommendedRoute.route_steps?.length || 0}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {recommendedRoute.route_steps?.map((step, stepIndex) => {
                        const linkedMission = missions.find((mission) => mission.donation_card === step.donation_id)
                        return (
                          <div key={`${step.donation_id}-${stepIndex}`} className="rounded-soft border border-line/70 bg-white/95 px-3 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                                  {stepIndex + 1}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-ink">{step.food_title || 'Mission pickup'}</p>
                                  <p className="mt-1 text-xs font-semibold text-accent">
                                    Receiver: {step.receiver_name || 'Not assigned yet'}
                                  </p>
                                  <p className="mt-1 text-xs text-slate">
                                    Travel {formatDistanceKm(step.distance_from_previous_km)} from previous stop · total so far{' '}
                                    {formatDistanceKm(step.cumulative_distance_km)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate">Urgency signal {formatUrgency(step.hunger_score)}</p>
                                </div>
                              </div>
                              {linkedMission ? (
                                <Link
                                  to={`/app/missions/${linkedMission.id}`}
                                  className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink"
                                >
                                  Open mission
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </Panel>
      ) : null}

      {loading ? <Panel>Loading missions...</Panel> : null}
      {error ? <Panel>{error}</Panel> : null}
      {!loading && !error && missions.length === 0 ? <Panel>No missions yet. Create a donation to start.</Panel> : null}

      {missions.map((mission) => {
        const isRemoving = removingId === mission.id
        const isPickupDone = [
          'PICKUP_IN_PROGRESS',
          'ON_ROUTE',
          'DELIVERY_PENDING',
          'DELIVERED',
          'DELIVERY_REJECTED',
          'COMPLETED',
        ].includes(mission.state)
        const isDeliveryDone = ['DELIVERED', 'COMPLETED'].includes(mission.state)
        const isRejected = mission.state === 'DELIVERY_REJECTED'
        const progress = isRejected ? 100 : isDeliveryDone ? 100 : isPickupDone ? 50 : 0
        const isCompleted = mission.state === 'COMPLETED'
        const pendingForUser = mission.state === 'REQUESTED' && user?.id && mission.pending_volunteer === user.id
        const pendingVolunteerName = mission.pending_volunteer_name || 'Volunteer'
        const quantityKg = estimateKg(mission.donation_food_quantity, mission.donation_quantity_unit)
        const karma = getKarmaForKg(quantityKg)
        return (
          <div
            key={mission.id}
            className={`transition-all duration-300 ${isRemoving ? 'opacity-0 -translate-y-2' : 'opacity-100'}`}
          >
            <Panel
              className={
                isCompleted
                  ? 'border-success/30 bg-success/5 shadow-[0_0_24px_rgba(16,185,129,0.18)]'
                  : ''
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate">Mission {mission.id.slice(0, 8)}</p>
                  <h3 className="mt-1 text-lg font-semibold">
                    {mission.donation_food_title || mission.requirement_need_title || 'Food Mission'}
                  </h3>
                  <p className="mt-1 text-sm text-slate">
                    {mission.pickup_address} {'->'} {mission.delivery_address}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-accent">
                    Donated by {mission.donor_name || 'Donor'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {user?.id === mission.donor_user ? (
                    <button
                      onClick={() => requestCancel(mission)}
                      disabled={cancelingId === mission.id}
                      className="rounded-full border border-line bg-white p-2 text-danger hover:bg-cloud disabled:cursor-not-allowed disabled:opacity-70"
                      title="Delete mission"
                    >
                      <TrashIcon />
                    </button>
                  ) : null}
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      isCompleted
                        ? 'bg-success/15 text-success'
                        : isRejected
                          ? 'bg-danger/10 text-danger'
                          : 'bg-cloud text-slate'
                    }`}
                  >
                    {formatMissionState(mission.state)}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-soft border border-line/70 bg-cloud/60 p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate">
                  <span>Pickup checkpoint</span>
                  <span>Delivery checkpoint</span>
                </div>
                <div className="relative mt-3 h-2 rounded-full bg-white/90">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      isRejected ? 'bg-danger' : progress === 100 ? 'bg-success' : progress === 50 ? 'bg-accent' : 'bg-line'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                  <div
                    className={`absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                      isPickupDone ? 'border-success bg-success' : 'border-line bg-white'
                    }`}
                  />
                  <div
                    className={`absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 ${
                      isDeliveryDone || isRejected ? 'border-success bg-success' : 'border-line bg-white'
                    }`}
                  />
                </div>
                {isCompleted ? <p className="mt-2 text-xs font-semibold text-success">Mission completed and verified.</p> : null}
                {isRejected ? <p className="mt-2 text-xs font-semibold text-danger">Delivery rejected by receiver.</p> : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase text-slate">Pickup ETA</p>
                  <p className="text-sm font-semibold">
                    {mission.pickup_eta_minutes ? `${mission.pickup_eta_minutes} min` : 'TBD'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate">Delivery ETA</p>
                  <p className="text-sm font-semibold">
                    {mission.delivery_eta_minutes ? `${mission.delivery_eta_minutes} min` : 'TBD'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate">Expiry countdown</p>
                  <p className="text-sm font-semibold text-warning">
                    {formatCountdown(mission.expires_at || mission.donation_expiry_time)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate">Quantity</p>
                  <p className="text-sm font-semibold">
                    {mission.donation_food_quantity ? `${mission.donation_food_quantity} ${mission.donation_quantity_unit || ''}` : '-'}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-soft border border-line/70 bg-white/90 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate">Karma points estimate</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  Estimated size: {quantityKg ? `${quantityKg.toFixed(1)} kg` : 'N/A'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-cloud px-3 py-1 text-slate">Donor +{karma.donor}</span>
                  <span className="rounded-full bg-cloud px-3 py-1 text-slate">Volunteer +{karma.volunteer}</span>
                  <span className="rounded-full bg-cloud px-3 py-1 text-slate">Receiver +{karma.receiver}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => openModal(mission.id)}
                  className="rounded-soft border border-line bg-white px-4 py-2 text-xs font-semibold text-ink"
                >
                  View details
                </button>
                {user?.role === 'VOLUNTEER' && mission.state === 'CREATED' ? (
                  <button
                    onClick={() => handleAccept(mission.id)}
                    disabled={acceptingId === mission.id}
                    className="rounded-soft bg-gradient-to-r from-accent to-ink px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {acceptingId === mission.id ? 'Requesting...' : 'Request to accept'}
                  </button>
                ) : null}
                {user?.role === 'VOLUNTEER' && pendingForUser ? (
                  <span className="rounded-soft border border-line bg-cloud px-4 py-2 text-xs font-semibold text-slate">
                    Request pending
                  </span>
                ) : null}
                {user?.role === 'DONOR' && mission.state === 'REQUESTED' ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleApproveRequest(mission.id)}
                      disabled={approvingId === mission.id}
                      className="rounded-soft bg-ink px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {approvingId === mission.id ? 'Approving...' : `Approve ${pendingVolunteerName}`}
                    </button>
                    <button
                      onClick={() => handleRejectRequest(mission.id)}
                      disabled={rejectingId === mission.id}
                      className="rounded-soft border border-line bg-white px-4 py-2 text-xs font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {rejectingId === mission.id ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>
                ) : null}
                {user?.role === 'VOLUNTEER' && ['VOLUNTEER_ASSIGNED', 'ON_ROUTE'].includes(mission.state) ? (
                  <button
                    onClick={() => handleRequestDelivery(mission.id)}
                    disabled={verifyingId === mission.id}
                    className="rounded-soft bg-ink px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {verifyingId === mission.id ? 'Requesting...' : 'Verify delivery'}
                  </button>
                ) : null}
                {user?.role === 'RECEIVER' && mission.state === 'DELIVERY_PENDING' ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleDeliveryDecision(mission.id, 'approve')}
                      disabled={deliveryDecisionId === mission.id}
                      className="rounded-soft bg-success px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {deliveryDecisionId === mission.id ? 'Saving...' : 'Accept delivery'}
                    </button>
                    <button
                      onClick={() => handleDeliveryDecision(mission.id, 'reject')}
                      disabled={deliveryDecisionId === mission.id}
                      className="rounded-soft border border-line bg-white px-4 py-2 text-xs font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {deliveryDecisionId === mission.id ? 'Saving...' : 'Reject delivery'}
                    </button>
                  </div>
                ) : null}
                <Link
                  to={`/app/missions/${mission.id}`}
                  className="rounded-soft bg-ink px-4 py-2 text-xs font-semibold text-white"
                >
                  Open mission page
                </Link>
              </div>
            </Panel>
          </div>
        )
      })}

      <Modal open={modalOpen} title="Mission Details" onClose={closeModal}>
        {modalLoading ? <p className="text-sm text-slate">Loading...</p> : null}
        {modalError ? <p className="text-sm text-danger">{modalError}</p> : null}
        {selectedMission ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">
                {selectedMission.donation_food_title || selectedMission.requirement_need_title || 'Food Mission'}
              </h3>
              <p className="mt-1 text-sm text-slate">State: {formatMissionState(selectedMission.state)}</p>
              <p className="mt-2 text-sm font-semibold text-accent">
                Donated by {selectedMission.donor_name || 'Donor'}
              </p>
            </div>

            {selectedMission.donation_image_url ? (
              <img
                src={selectedMission.donation_image_url}
                alt="Donation"
                className="h-48 w-full rounded-soft object-cover"
              />
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-slate">Pickup</p>
                <p className="text-sm font-semibold">{selectedMission.pickup_address}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate">Delivery</p>
                <p className="text-sm font-semibold">{selectedMission.delivery_address}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate">Expiry</p>
                <p className="text-sm font-semibold text-warning">
                  {formatCountdown(selectedMission.expires_at || selectedMission.donation_expiry_time)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate">Quantity</p>
                <p className="text-sm font-semibold">
                  {selectedMission.donation_food_quantity
                    ? `${selectedMission.donation_food_quantity} ${selectedMission.donation_quantity_unit || ''}`
                    : '-'}
                </p>
              </div>
            </div>

            {user?.id === selectedMission.donor_user && pickupQrToken ? (
              <div className="rounded-soft border border-line bg-cloud p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Pickup QR (Donor only)</p>
                    <p className="text-xs text-slate">Show this QR to the volunteer during pickup.</p>
                  </div>
                  <button
                    onClick={() => setShowQr((prev) => !prev)}
                    className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold"
                  >
                    {showQr ? 'Hide QR' : 'QR Code'}
                  </button>
                </div>
                {showQr ? (
                  <div className="mt-3 flex flex-col items-center gap-2">
                    <img src={pickupQrUrl} alt="Pickup QR" className="h-40 w-40" />
                    <p className="text-[11px] text-slate">Token: {pickupQrToken.token}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {user?.role === 'VOLUNTEER' && selectedMission.state === 'CREATED' ? (
                <button
                  onClick={() => handleAccept(selectedMission.id)}
                  disabled={acceptingId === selectedMission.id}
                  className="rounded-soft bg-gradient-to-r from-accent to-ink px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {acceptingId === selectedMission.id ? 'Accepting...' : 'Accept mission'}
                </button>
              ) : null}
              <Link
                to={`/app/missions/${selectedMission.id}`}
                className="rounded-soft border border-line bg-white px-4 py-2 text-xs font-semibold text-ink"
              >
                Open full mission page
              </Link>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(confirmMission)} title="Delete mission" onClose={() => setConfirmMission(null)}>
        <p className="text-sm text-slate">Are you sure you want to delete this mission?</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleCancel}
            disabled={cancelingId === confirmMission?.id}
            className="rounded-soft bg-danger px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {cancelingId === confirmMission?.id ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={() => setConfirmMission(null)}
            className="rounded-soft border border-line bg-white px-4 py-2 text-xs font-semibold text-ink"
          >
            Cancel
          </button>
        </div>
      </Modal>

      {toast ? (
        <div className="fixed right-6 top-24 z-50 animate-fade-up rounded-soft border border-line bg-white px-4 py-3 text-sm shadow-panel">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate">Notification</p>
          <p className="mt-1 font-semibold text-ink">
            <span className="text-accent">{toast}</span>
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default VolunteerMissionsPage
