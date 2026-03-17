import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { Loader2, Send } from 'lucide-react'

const SUGGESTIONS = [
  "How much raw material purchased today?",
  "Total pending payments?",
  "How many trucks dispatched this week?",
  "What's the current diesel stock?",
  "Supplier-wise purchase summary this month",
  "Total production this month?",
  "Pellet stock levels?",
]

export default function DataInsights() {
  const { plant } = useAuth()
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! I'm your plant data assistant. Ask me anything about your purchases, dispatches, production, stock levels, payments — in any language.\n\nTry tapping a suggestion below or type your own question." },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

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
      const { data: result, error } = await supabase.functions.invoke('data-chat', {
        body: {
          question,
          plantId: plant.id,
          orgId: plant.org_id,
        },
      })

      if (error) {
        setMessages(prev => [...prev, { role: 'bot', text: 'Something went wrong. Please try again.' }])
        return
      }

      if (result?.success) {
        setMessages(prev => [...prev, { role: 'bot', text: result.answer }])
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: result?.error || 'Something went wrong. Please try again.' }])
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages(prev => [...prev, { role: 'bot', text: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fefae0' }}>
      <PageHeader title="Data Assistant" subtitle="Ask about your plant data" backTo="/" />

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
            }}
          >
            <div style={{
              maxWidth: '85%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? '#2d6a4f' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#2c2c2c',
              border: msg.role === 'bot' ? '1.5px solid #e5ddd0' : 'none',
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              fontWeight: 500,
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{
              padding: '12px 20px', borderRadius: '14px 14px 14px 4px',
              background: '#fff', border: '1.5px solid #e5ddd0',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Loader2 size={16} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: '#595c4a' }}>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions (show only at start) */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSend(s)}
              style={{
                padding: '8px 14px', borderRadius: 20,
                background: '#fff', border: '1.5px solid #e5ddd0',
                fontSize: 12, fontWeight: 600, color: '#2d6a4f',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div style={{
        flexShrink: 0, padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        background: '#fff', borderTop: '1px solid #e5ddd0',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your data..."
          disabled={loading}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 24,
            border: '1.5px solid #e5ddd0', fontSize: 14,
            outline: 'none', background: '#fefae0', color: '#2c2c2c',
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: input.trim() ? '#2d6a4f' : '#e5ddd0',
            border: 'none', cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s',
          }}
        >
          <Send size={18} color="#fff" />
        </button>
      </div>
    </div>
  )
}
