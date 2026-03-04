import { createClient } from '@supabase/supabase-js'

// Use Vercel proxy to bypass Supabase ISP block in India
// Requests go: Browser → Vercel (not blocked) → Supabase (server-side)
const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost'

const supabaseUrl = isProduction
  ? (window.location.origin + '/supabase')  // Vercel proxy
  : import.meta.env.VITE_SUPABASE_URL

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable. See .env.example for required variables.')
}
if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable. See .env.example for required variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
