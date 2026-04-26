import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import MissionTimeline from '../../components/missions/MissionTimeline'
import MapPlaceholder from '../../components/maps/MapPlaceholder'
import Panel from '../../components/ui/Panel'
import Modal from '../../components/ui/Modal'
import { getStoredUser } from '../../hooks/useAuth'
import { acceptMission, getMission, scanDelivery, scanPickup } from '../../services/missionService'
import { formatCountdown, formatMissionState } from '../../utils/formatters'

function MissionDetailPage() {
  const { missionId } = useParams()
  const user = getStoredUser()
  const [mission, setMission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pickupToken, setPickupToken] = useState('')
  const [deliveryToken, setDeliveryToken] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionInfo, setActionInfo] = useState('')
  const [qrOpen, setQrOpen] = useState(false)
  const [scanMode, setScanMode] = useState('')
  const [scanError, setScanError] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [, setTicker] = useState(0)

  useEffect(() => {
    getMission(missionId)
      .then((payload) => setMission(payload))
      .catch(() => setError('Unable to load mission details.'))
      .finally(() => setLoading(false))
  }, [missionId])

  useEffect(() => {
    const timer = setInterval(() => setTicker((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!scanMode) return undefined
    let stop = false

    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }

    const startScan = async () => {
      setScanError('')
      if (!('BarcodeDetector' in window)) {
        setScanError('Camera scanning is not supported in this browser. Use manual token input.')
        setScanMode('')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        const detector = new BarcodeDetector({ formats: ['qr_code'] })

        const scanLoop = async () => {
          if (stop || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              const value = codes[0].rawValue
              if (scanMode === 'pickup') setPickupToken(value)
              if (scanMode === 'delivery') setDeliveryToken(value)
              setScanMode('')
              stopStream()
              return
            }
          } catch (err) {
            setScanError('Unable to read QR code. Try again.')
          }
          requestAnimationFrame(scanLoop)
        }

        scanLoop()
      } catch (err) {
        setScanError('Camera access denied. Allow camera to scan QR codes.')
        setScanMode('')
        stopStream()
      }
    }

    startScan()

    return () => {
      stop = true
      stopStream()
    }
  }, [scanMode])

  const refreshMission = async () => {
    const payload = await getMission(missionId)
    setMission(payload)
  }

  const handleAccept = async () => {
    setActionError('')
    setActionInfo('')
    try {
      const updated = await acceptMission(missionId)
      setMission(updated)
      setActionInfo('Request sent to donor. Waiting for approval.')
    } catch (err) {
      setActionError(err?.response?.data?.detail || 'Unable to request mission.')
    }
  }

  const handlePickupScan = async () => {
    setActionError('')
    setActionInfo('')
    try {
      await scanPickup(missionId, pickupToken)
      setPickupToken('')
      await refreshMission()
      setActionInfo('Pickup confirmed.')
    } catch (err) {
      setActionError(err?.response?.data?.detail || 'Pickup scan failed.')
    }
  }

  const handleDeliveryScan = async () => {
    setActionError('')
    setActionInfo('')
    try {
      await scanDelivery(missionId, deliveryToken)
      setDeliveryToken('')
      await refreshMission()
      setActionInfo('Delivery confirmed.')
    } catch (err) {
      setActionError(err?.response?.data?.detail || 'Delivery scan failed.')
    }
  }

  if (loading) return <Panel>Loading mission...</Panel>
  if (error) return <Panel>{error}</Panel>
  if (!mission) return <Panel>Mission not found.</Panel>

  const isVolunteer = user?.role === 'VOLUNTEER'
  const isDonor = user?.id === mission.donor_user
  const isAssignedVolunteer = mission.volunteer_user && mission.volunteer_user === user?.id
  const pickupQrToken = mission.qr_tokens?.find((token) => token.qr_type === 'PICKUP' && token.is_active)
  const pickupQrUrl = pickupQrToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pickupQrToken.token)}`
    : ''

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Panel>
        <p className="text-xs uppercase tracking-[0.2em] text-slate">Mission {mission.id}</p>
        <h2 className="mt-2 text-2xl font-bold">
          {mission.donation_food_title || mission.requirement_need_title || 'Food Mission'}
        </h2>
        <p className="mt-1 text-sm text-slate">State: {formatMissionState(mission.state)}</p>
        <p className="mt-2 text-sm font-semibold text-accent">Donated by {mission.donor_name || 'Donor'}</p>

        {mission.donation_image_url ? (
          <img src={mission.donation_image_url} alt="Donation" className="mt-4 h-56 w-full rounded-soft object-cover" />
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate">Pickup ETA</p>
            <p className="text-lg font-semibold">{mission.pickup_eta_minutes ? `${mission.pickup_eta_minutes} min` : 'TBD'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate">Delivery ETA</p>
            <p className="text-lg font-semibold">{mission.delivery_eta_minutes ? `${mission.delivery_eta_minutes} min` : 'TBD'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate">Expiry Countdown</p>
            <p className="text-lg font-semibold text-warning">{formatCountdown(mission.expires_at || mission.donation_expiry_time)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate">Quantity</p>
            <p className="text-lg font-semibold">
              {mission.donation_food_quantity ? `${mission.donation_food_quantity} ${mission.donation_quantity_unit || ''}` : '-'}
            </p>
          </div>
        </div>

        {mission.donation_notes ? (
          <div className="mt-4 rounded-soft border border-line bg-cloud p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate">Donation notes</p>
            <p className="mt-2 text-sm text-slate">{mission.donation_notes}</p>
          </div>
        ) : null}

        <MissionTimeline events={mission.events || []} />
      </Panel>

      <div className="space-y-4">
        <MapPlaceholder />
        <Panel>
          <h3 className="text-base font-semibold">Route and Verification</h3>
          <p className="mt-2 text-sm text-slate">Pickup: {mission.pickup_address}</p>
          <p className="mt-1 text-sm text-slate">Delivery: {mission.delivery_address}</p>
          <p className="mt-3 text-sm text-slate">Pickup and delivery each require QR scan checkpoints.</p>
        </Panel>

        <Panel>
          <h3 className="text-base font-semibold">Volunteer Actions</h3>
          {actionError ? <p className="mt-2 text-sm text-danger">{actionError}</p> : null}
          {actionInfo ? <p className="mt-2 text-sm text-success">{actionInfo}</p> : null}

          {scanError ? <p className="mt-2 text-xs text-danger">{scanError}</p> : null}
          {scanMode ? (
            <div className="mt-3 rounded-soft border border-line bg-cloud p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate">Camera Scanner</p>
              <video ref={videoRef} className="mt-3 h-48 w-full rounded-soft object-cover" muted />
              <button
                onClick={() => setScanMode('')}
                className="mt-3 rounded-soft border border-line bg-white px-4 py-2 text-xs font-semibold"
              >
                Stop camera
              </button>
            </div>
          ) : null}

          {isVolunteer && mission.state === 'CREATED' ? (
            <button
              onClick={handleAccept}
              className="mt-3 rounded-soft bg-gradient-to-r from-accent to-ink px-4 py-2 text-xs font-semibold text-white"
            >
              Request to accept
            </button>
          ) : null}

          {isVolunteer && isAssignedVolunteer && mission.state === 'VOLUNTEER_ASSIGNED' ? (
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate">Pickup QR token</label>
              <input
                value={pickupToken}
                onChange={(event) => setPickupToken(event.target.value)}
                className="w-full rounded-soft border border-line px-3 py-2 text-sm"
                placeholder="Paste scanned pickup QR token"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePickupScan}
                  className="rounded-soft bg-ink px-4 py-2 text-xs font-semibold text-white"
                >
                  Confirm pickup scan
                </button>
                <button
                  onClick={() => setScanMode('pickup')}
                  className="rounded-soft border border-line bg-white px-4 py-2 text-xs font-semibold"
                >
                  Scan with camera
                </button>
              </div>
            </div>
          ) : null}

          {isVolunteer && isAssignedVolunteer && ['VOLUNTEER_ASSIGNED', 'ON_ROUTE'].includes(mission.state) ? (
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate">Delivery QR token</label>
              <input
                value={deliveryToken}
                onChange={(event) => setDeliveryToken(event.target.value)}
                className="w-full rounded-soft border border-line px-3 py-2 text-sm"
                placeholder="Paste scanned delivery QR token"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDeliveryScan}
                  className="rounded-soft bg-ink px-4 py-2 text-xs font-semibold text-white"
                >
                  Confirm delivery scan
                </button>
                <button
                  onClick={() => setScanMode('delivery')}
                  className="rounded-soft border border-line bg-white px-4 py-2 text-xs font-semibold"
                >
                  Scan with camera
                </button>
              </div>
            </div>
          ) : null}
        </Panel>

        {isDonor && pickupQrToken ? (
          <Panel>
            <h3 className="text-base font-semibold">Donor Pickup QR</h3>
            <p className="mt-2 text-sm text-slate">Show this code to the volunteer for pickup.</p>
            <button
              onClick={() => setQrOpen(true)}
              className="mt-3 rounded-soft border border-line bg-white px-4 py-2 text-xs font-semibold"
            >
              QR Code
            </button>
          </Panel>
        ) : null}
      </div>

      <Modal open={qrOpen} title="Pickup QR" onClose={() => setQrOpen(false)}>
        {pickupQrToken ? (
          <div className="flex flex-col items-center gap-3">
            <img src={pickupQrUrl} alt="Pickup QR" className="h-52 w-52" />
            <p className="text-xs text-slate">Token: {pickupQrToken.token}</p>
          </div>
        ) : (
          <p className="text-sm text-slate">Pickup QR is no longer active.</p>
        )}
      </Modal>
    </div>
  )
}

export default MissionDetailPage
