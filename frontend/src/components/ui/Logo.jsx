function Logo({ tone = 'dark', showText = true, className = '' }) {
  const textTone = tone === 'light' ? 'text-white' : 'text-ink'
  const subTone = tone === 'light' ? 'text-white/70' : 'text-slate'

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-ink shadow-card">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 15c3-4 6-6 9-6s6 2 9 6" />
          <path d="M5 15v4" />
          <path d="M12 9v10" />
          <path d="M19 15v4" />
          <path d="M4 19h16" />
        </svg>
      </span>
      {showText ? (
        <div>
          <p className={`text-[10px] uppercase tracking-[0.28em] ${subTone}`}>MealBridge</p>
          <p className={`text-sm font-semibold ${textTone}`}>MealBridge</p>
        </div>
      ) : null}
    </div>
  )
}

export default Logo
