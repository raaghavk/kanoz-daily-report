import Modal from './Modal'

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger' }) {
  const confirmColor = variant === 'danger' ? '#d32f2f' : '#2d6a4f'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p style={{ fontSize: 14, color: '#595c4a', marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 14, border: '1.5px solid #e5ddd0',
            background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); onClose() }}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 14, border: 'none',
            background: confirmColor, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
