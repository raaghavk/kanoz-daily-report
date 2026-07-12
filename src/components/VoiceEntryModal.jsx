import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { showToast } from './Toast'
import { X, Mic, MicOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function VoiceEntryModal({ onClose }) {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [phase, setPhase] = useState('idle') // idle | listening | processing | review | error
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const recognitionRef = useRef(null)
  const accumulatedRef = useRef('')
  const latestTranscriptRef = useRef('')

  // Load plant master data for context
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-voice', plant?.id],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('id, name').eq('plant_id', plant.id).eq('is_active', true)
      return data || []
    },
    enabled: !!plant?.id,
  })
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-voice', plant?.org_id],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('id, name').eq('org_id', plant.org_id).eq('is_active', true)
      return data || []
    },
    enabled: !!plant?.org_id,
  })
  const { data: transporters = [] } = useQuery({
    queryKey: ['transporters-voice', plant?.org_id],
    queryFn: async () => {
      const { data } = await supabase.from('transporters').select('id, name').eq('org_id', plant.org_id).eq('is_active', true)
      return data || []
    },
    enabled: !!plant?.org_id,
  })
  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['rawMaterials-voice', plant?.id],
    queryFn: async () => {
      const { data } = await supabase.from('raw_material_types').select('id, name').eq('plant_id', plant.id).eq('is_active', true)
      return data || []
    },
    enabled: !!plant?.id,
  })
  const { data: pelletTypes = [] } = useQuery({
    queryKey: ['pelletTypes-voice', plant?.id],
    queryFn: async () => {
      const { data } = await supabase.from('pellet_types').select('id, name').eq('plant_id', plant.id).eq('is_active', true)
      return data || []
    },
    enabled: !!plant?.id,
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
      }
    }
  }, [])

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setErrorMsg('Voice input requires Chrome or a Chromium-based browser.')
      setPhase('error')
      return
    }

    const recognition = new SR()
    recognitionRef.current = recognition
    recognition.lang = 'hi-IN'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setPhase('listening')
      setTranscript('')
      setInterimText('')
      accumulatedRef.current = ''
      latestTranscriptRef.current = ''
    }

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          accumulatedRef.current += t
          setTranscript(accumulatedRef.current)
        } else {
          interim += t
        }
      }
      setInterimText(interim)
      latestTranscriptRef.current = accumulatedRef.current + interim
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        setErrorMsg('No speech detected. Please try again.')
      } else if (event.error === 'not-allowed') {
        setErrorMsg('Microphone access denied. Please allow microphone in browser settings.')
      } else {
        setErrorMsg('Voice error: ' + event.error)
      }
      setPhase('error')
    }

    recognition.onend = () => {
      setInterimText('')
      const finalText = latestTranscriptRef.current.trim()
      if (finalText) {
        processTranscript(finalText)
      } else {
        setPhase('idle')
      }
    }

    recognition.start()
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  async function processTranscript(text) {
    setPhase('processing')
    try {
      const { data, error } = await supabase.functions.invoke('parse-voice-entry', {
        body: {
          transcript: text,
          context: { suppliers, customers, transporters, rawMaterials, pelletTypes },
        }
      })
      if (error || !data?.success) throw new Error(error?.message || 'Parse failed')
      setResult(data.result)
      setPhase('review')
    } catch (err) {
      console.error('Voice parse error:', err)
      setErrorMsg('Could not understand. Please try again.')
      setPhase('error')
    }
  }

  function handleConfirm() {
    if (!result) return
    const { type, fields } = result

    if (type === 'purchase') {
      navigate('/purchase/new', { state: { prefill: fields } })
      onClose()
    } else if (type === 'dispatch') {
      navigate('/dispatch', { state: { showForm: true, prefill: fields } })
      onClose()
    } else if (type === 'issue') {
      showToast('Issue noted — add it in your shift report', 'success')
      onClose()
    } else {
      setPhase('error')
      setErrorMsg("Couldn't determine entry type. Try being more specific.")
    }
  }

  function reset() {
    setPhase('idle')
    setTranscript('')
    setInterimText('')
    setResult(null)
    setErrorMsg('')
  }

  const displayTranscript = transcript + interimText

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Close button */}
      <button onClick={onClose} style={{
        position: 'absolute', top: 20, right: 20,
        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 20,
        width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'white',
      }}>
        <X size={20} />
      </button>

      <div style={{
        width: '100%', maxWidth: 400,
        background: '#1a2e22', borderRadius: 20,
        padding: 28, textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>

        {/* IDLE */}
        {phase === 'idle' && (
          <>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
              Speak to create a new Purchase or Dispatch entry
            </div>
            <button onClick={startListening} style={{
              width: 96, height: 96, borderRadius: '50%',
              background: '#2d6a4f', border: '3px solid #40916c',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              cursor: 'pointer', transition: 'transform 0.1s',
            }}>
              <Mic size={40} color="white" />
            </button>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Tap to speak</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8, lineHeight: 1.5 }}>
              Hindi or English<br/>
              "Ram ji se 500 kg husk liya, 8 rupaye kilo"
            </div>
          </>
        )}

        {/* LISTENING */}
        {phase === 'listening' && (
          <>
            <div style={{ fontSize: 13, color: '#74c69d', marginBottom: 24, fontWeight: 600 }}>
              🎙️ Listening...
            </div>
            <button onClick={stopListening} style={{
              width: 96, height: 96, borderRadius: '50%',
              background: '#d62828', border: '3px solid #e63946',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              cursor: 'pointer',
              animation: 'pulse 1.5s infinite',
            }}>
              <MicOff size={40} color="white" />
            </button>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Tap to stop</div>
            {displayTranscript && (
              <div style={{
                marginTop: 16, padding: '12px 16px',
                background: 'rgba(255,255,255,0.06)', borderRadius: 12,
                fontSize: 14, color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.6, textAlign: 'left', minHeight: 40,
              }}>
                {displayTranscript}
              </div>
            )}
          </>
        )}

        {/* PROCESSING */}
        {phase === 'processing' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <Loader2 size={48} color="#74c69d" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Understanding...</div>
            {transcript && (
              <div style={{
                marginTop: 16, padding: '12px 16px',
                background: 'rgba(255,255,255,0.06)', borderRadius: 12,
                fontSize: 13, color: 'rgba(255,255,255,0.5)',
                textAlign: 'left', fontStyle: 'italic',
              }}>
                "{transcript}"
              </div>
            )}
          </>
        )}

        {/* REVIEW */}
        {phase === 'review' && result && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
              <CheckCircle size={20} color="#74c69d" />
              <span style={{ fontSize: 13, color: '#74c69d', fontWeight: 700 }}>
                {result.type === 'purchase' ? '🛒 New Purchase' : result.type === 'dispatch' ? '🚛 New Dispatch' : '⚠️ Issue'}
              </span>
              {result.confidence === 'low' && (
                <span style={{ fontSize: 10, background: 'rgba(255,200,0,0.2)', color: '#ffd60a', padding: '2px 8px', borderRadius: 20 }}>Low confidence</span>
              )}
            </div>

            {/* Summary line */}
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16, fontStyle: 'italic' }}>
              "{result.summary}"
            </div>

            {/* Fields preview */}
            <div style={{
              background: 'rgba(255,255,255,0.06)', borderRadius: 12,
              padding: '12px 16px', marginBottom: 20,
              textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {result.type === 'purchase' && (
                <>
                  {result.fields?.supplier_name && <Row label="Supplier" value={result.fields.supplier_name} matched={!!result.fields.supplier_id} />}
                  {result.fields?.raw_material_name && <Row label="Material" value={result.fields.raw_material_name} matched={!!result.fields.raw_material_type_id} />}
                  {result.fields?.net_weight && <Row label="Weight" value={`${result.fields.net_weight} kg`} />}
                  {result.fields?.rate_per_kg && <Row label="Rate" value={`₹${result.fields.rate_per_kg}/kg`} />}
                  {result.fields?.net_weight && result.fields?.rate_per_kg && (
                    <Row label="~Amount" value={`₹${(result.fields.net_weight * result.fields.rate_per_kg).toLocaleString('en-IN')}`} highlight />
                  )}
                  {result.fields?.vehicle_number && <Row label="Vehicle" value={result.fields.vehicle_number} />}
                  {result.fields?.serial_no && <Row label="Parchi No" value={result.fields.serial_no} />}
                </>
              )}
              {result.type === 'dispatch' && (
                <>
                  {result.fields?.customer_name && <Row label="Customer" value={result.fields.customer_name} matched={!!result.fields.customer_id} />}
                  {result.fields?.pellet_type_name && <Row label="Pellet" value={result.fields.pellet_type_name} matched={!!result.fields.pellet_type_id} />}
                  {result.fields?.quantity_mt && <Row label="Quantity" value={`${result.fields.quantity_mt} MT`} />}
                  {result.fields?.truck_number && <Row label="Truck" value={result.fields.truck_number} />}
                  {result.fields?.transporter_name && <Row label="Transporter" value={result.fields.transporter_name} matched={!!result.fields.transporter_id} />}
                </>
              )}
              {result.type === 'issue' && (
                <Row label="Issue" value={result.fields?.description || 'No description'} />
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={reset} style={{
                flex: 1, padding: '11px 0', borderRadius: 12,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Try Again</button>
              <button onClick={handleConfirm} style={{
                flex: 2, padding: '11px 0', borderRadius: 12,
                background: '#2d6a4f', border: 'none',
                color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>Fill Form →</button>
            </div>
          </>
        )}

        {/* ERROR */}
        {phase === 'error' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <AlertCircle size={48} color="#e63946" />
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 20 }}>{errorMsg}</div>
            <button onClick={reset} style={{
              width: '100%', padding: '12px 0', borderRadius: 12,
              background: '#2d6a4f', border: 'none',
              color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>Try Again</button>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(214,40,40,0.4); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 12px rgba(214,40,40,0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function Row({ label, value, matched, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: highlight ? 700 : 600,
        color: highlight ? '#74c69d' : matched === false ? '#ffd60a' : 'rgba(255,255,255,0.85)',
      }}>
        {value}
        {matched === false && <span style={{ fontSize: 10, marginLeft: 4, color: '#ffd60a' }}>⚠ unmatched</span>}
      </span>
    </div>
  )
}
