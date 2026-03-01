import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://coguzmhpfmjkxmuasuoj.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ3V6bWhwZm1qa3htdWFzdW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNTU0MzYsImV4cCI6MjA4NzgzMTQzNn0.3udEtLfgOEWaRmPRWTywpSwEAc0lLkCdj86Eg_ZBhwo'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
