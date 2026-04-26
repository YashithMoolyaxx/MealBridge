function MissionCard({ title, subtitle, meta = [], className = '' }) {
  return (
    <article className={`rounded-soft border border-line bg-white p-5 shadow-card ${className}`.trim()}>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate">{subtitle}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {meta.map((item) => (
          <span key={item} className="rounded-full bg-cloud px-3 py-1 text-xs font-medium text-slate">
            {item}
          </span>
        ))}
      </div>
    </article>
  )
}

export default MissionCard
