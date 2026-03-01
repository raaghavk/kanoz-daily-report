export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        background: 'rgba(15,36,24,0.5)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxHeight: '75%',
          overflowY: 'auto',
          background: '#FFFFFF',
          borderRadius: '20px 20px 0 0',
          padding: '20px 16px 30px',
          animation: 'sheetUp 0.3s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div style={{ width: 40, height: 4, borderRadius: 2, margin: '0 auto 16px', background: '#E2E8E4' }} />
        {title && (
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1A1A2E' }}>{title}</h3>
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
