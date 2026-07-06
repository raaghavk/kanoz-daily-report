import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { Loader2, Send } from 'lucide-react'

const SUGGESTIONS = [
  "Summary today",
  "Purchases yesterday",
  "Pending payments",
  "Dispatches this week",
  "Production this month",
  "All stock",
  "Supplier summary",
  "Customer wise",
  "Average rate",
]

// ── Component ──
export default function DataInsights() {
  const { plant } = useAuth()
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! I'm your AI plant assistant. Ask me anything about your plant data in Hindi or English.\n\nTry: purchases today, dispatch this week, pending payments, production this month, all stock, etc." },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const [userLocation, setUserLocation] = useState(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { timeout: 5000 }
    )
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(text) {
    const question = (text || input).trim()
    if (!question || loading || !plant?.id) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('plant-chat', {
        body: { question, plantId: plant.id, location: userLocation || undefined }
      })
      if (error) throw error
      const answer = data?.answer || 'No response received.'
      setMessages(prev => [...prev, { role: 'bot', text: answer }])
    } catch (err) {
      console.error('Chat error:', err)
      setMessages(prev => [...prev, { role: 'bot', text: 'Could not connect to AI. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: '#fefae0' }}>
      <div style={{ flexShrink: 0 }}>
        <PageHeader title="Data Assistant" subtitle="Ask about your plant data" backTo="/" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{
              maxWidth: '85%', padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? '#2d6a4f' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#2c2c2c',
              border: msg.role === 'bot' ? '1.5px solid #e5ddd0' : 'none',
              fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontWeight: 500,
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ padding: '12px 20px', borderRadius: '14px 14px 14px 4px', background: '#fff', border: '1.5px solid #e5ddd0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={16} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: '#595c4a' }}>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 1 && (
        <div style={{ flexShrink: 0, padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => handleSend(s)} style={{
              padding: '8px 14px', borderRadius: 20, background: '#fff', border: '1.5px solid #e5ddd0',
              fontSize: 12, fontWeight: 600, color: '#2d6a4f', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{
        flexShrink: 0, padding: '12px 16px', background: '#fff', borderTop: '1px solid #e5ddd0',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <input
          type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Ask about purchases, stock, dispatches..."
          disabled={loading}
          style={{ flex: 1, padding: '12px 16px', borderRadius: 24, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', background: '#fefae0', color: '#2c2c2c' }}
        />
        <button onClick={() => handleSend()} disabled={loading || !input.trim()} style={{
          width: 44, height: 44, borderRadius: '50%', background: input.trim() ? '#2d6a4f' : '#e5ddd0',
          border: 'none', cursor: input.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Send size={18} color="#fff" />
        </button>
      </div>
    </div>
  )
}
