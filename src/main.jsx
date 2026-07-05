import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { supabase } from './lib/supabase'

// Silence debug logging in production builds (keep console.error — errors matter)
if (import.meta.env.PROD) {
  console.log = () => {}
  console.debug = () => {}
}

// Warm up Supabase connection immediately on app load to avoid cold-start delay
// This lightweight ping fires before any UI renders
supabase.from('plants').select('id').limit(1).then(() => {})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min — avoid refetch on every nav
      gcTime: 10 * 60 * 1000,     // 10 min — keep data in cache
      retry: 1,
    },
  },
})

// PWA auto-update: register SW and auto-reload when new version is available
const updateSW = registerSW({
  onNeedRefresh() {
    // New content available — update immediately without prompting
    updateSW(true)
  },
  onOfflineReady() {
    console.log('Kanoz: App ready for offline use')
  },
  // Check for updates every 10 minutes
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      setInterval(() => { registration.update() }, 10 * 60 * 1000)
    }
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)
