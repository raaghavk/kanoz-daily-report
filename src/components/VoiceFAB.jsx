import { useState } from 'react'
import { Mic } from 'lucide-react'
import VoiceEntryModal from './VoiceEntryModal'

export default function VoiceFAB() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 16px)',
          right: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#2d6a4f',
          border: '2px solid #40916c',
          boxShadow: '0 4px 16px rgba(45,106,79,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 100,
          transition: 'transform 0.15s',
        }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.93)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.93)' }}
        onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)' }}
        aria-label="Voice entry"
      >
        <Mic size={24} color="white" />
      </button>

      {open && <VoiceEntryModal onClose={() => setOpen(false)} />}
    </>
  )
}
