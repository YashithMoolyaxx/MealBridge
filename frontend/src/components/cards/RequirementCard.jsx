function RequirementCard({ ngo, need, urgency, location, before }) {
  return (
    <article className="rounded-soft border border-line bg-white p-5 shadow-card">
      <p className="text-sm font-semibold">{ngo}</p>
      <h3 className="mt-1 text-lg font-bold">Need: {need}</h3>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-cloud px-3 py-1">{location}</span>
        <span className="rounded-full bg-cloud px-3 py-1">Urgency: {urgency}</span>
        <span className="rounded-full bg-cloud px-3 py-1">Before {before}</span>
      </div>
    </article>
  )
}

export default RequirementCard