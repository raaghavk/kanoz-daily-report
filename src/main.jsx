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

// Warm the /supabase proxy before React paints. Table reads as anon were
// revoked (#76), so ping Auth instead of `plants` — that still works
// without a session and no longer 401s on every login-page load.
supabase.auth.getSession().then(() => {})

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
      // Also check for a new version every time the app returns to the foreground,
      // so a reopened app picks up the latest build immediately (no stale bundles).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update()
      })
      window.addEventListener('focus', () => registration.update())
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
