function formatEventTime(timestamp) {
  if (!timestamp) return '--:--'
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function MissionTimeline({ events = [] }) {
  if (!events.length) {
    return (
      <div className="mt-6 rounded-soft border border-line bg-cloud px-4 py-3 text-sm text-slate">
        Mission timeline updates will appear here as actions are completed.
      </div>
    )
  }

  return (
    <ol className="mt-6 space-y-2">
      {events.map((event) => (
        <li key={event.id} className="rounded-soft border border-line bg-cloud px-4 py-3 text-sm">
          {formatEventTime(event.created_at)} - {event.message}
        </li>
      ))}
    </ol>
  )
}

export default MissionTimeline
