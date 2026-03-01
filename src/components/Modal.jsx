export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-kanoz-card rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-kanoz-border rounded-full mx-auto mb-4" />
        {title && (
          <h3 className="text-base font-bold text-kanoz-text mb-3">{title}</h3>
        )}
        {children}
      </div>
    </div>
  )
}
