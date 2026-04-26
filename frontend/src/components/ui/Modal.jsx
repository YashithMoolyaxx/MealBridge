function Modal({ open, title, onClose, children }) {
  if (!open) return null

  const onBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={onBackdropClick}
    >
      <div className="w-full max-w-2xl rounded-soft bg-white shadow-panel">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-slate hover:bg-cloud"
          >
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export default Modal
