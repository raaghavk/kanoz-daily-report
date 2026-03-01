export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={onClose}
      style={{ background: 'rgba(15,36,24,0.5)' }}
    >
      <div
        className="w-full max-h-[75%] overflow-y-auto"
        style={{
          background: '#FFFFFF',
          borderRadius: '20px 20px 0 0',
          padding: '20px 16px 30px',
          animation: 'sheetUp 0.3s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-sm mx-auto mb-4" style={{ background: '#E2E8E4' }} />
        {title && (
          <h3 className="text-[16px] font-bold mb-3" style={{ color: '#1A1A2E' }}>{title}</h3>
        )}
        {children}
      </div>
      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
