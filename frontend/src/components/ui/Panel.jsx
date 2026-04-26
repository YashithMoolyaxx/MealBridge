function Panel({ children, className = '' }) {
  return (
    <section className={`rounded-soft border border-line bg-white p-5 shadow-card ${className}`.trim()}>
      {children}
    </section>
  )
}

export default Panel
