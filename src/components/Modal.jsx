import { useEffect, useRef } from 'react'

export default function Modal({ isOpen, onClose, title, children }) {
  const modalRef = useRef()

  useEffect(() => {
    if (!isOpen) return

    // Focus the modal on open
    modalRef.current?.focus()

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Focus trap
      if (e.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
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
        ref={modalRef}
        tabIndex={-1}
        style={{
          width: '100%',
          maxHeight: '75%',
          overflowY: 'auto',
          background: '#FFFFFF',
          borderRadius: '20px 20px 0 0',
          padding: '20px 16px 30px',
          animation: 'sheetUp 0.3s ease',
          outline: 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div style={{ width: 40, height: 4, borderRadius: 2, margin: '0 auto 16px', background: '#e5ddd0' }} />
        {title && (
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#2c2c2c' }}>{title}</h3>
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
