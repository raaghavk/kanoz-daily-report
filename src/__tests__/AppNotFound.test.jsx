import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('@vercel/speed-insights/react', () => ({ SpeedInsights: () => null }))

vi.mock('../pages/Login', () => ({ default: () => <div>Login Screen</div> }))
vi.mock('../pages/Home', () => ({ default: () => <div>Home Screen</div> }))
vi.mock('../pages/shift/ShiftWizard', () => ({ default: () => <div>Shift Wizard</div> }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    employee: { id: 'e1', name: 'Pat', role: 'admin' },
    plant: { id: 'p1', name: 'Plant' },
    loading: false,
    noEmployeeRecord: false,
    accountInactive: false,
    signOut: vi.fn(),
  }),
}))

import App from '../App'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('unknown app routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the not-found page for /diesel instead of a blank outlet', async () => {
    renderAt('/diesel')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('shows the not-found page for other unknown paths', async () => {
    renderAt('/this-page-does-not-exist')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('still renders login and home on real routes', async () => {
    renderAt('/login')
    expect(await screen.findByText('Login Screen')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument()

    renderAt('/')
    expect(await screen.findByText('Home Screen')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument()
  })

  it('does not steal /shift/new for the catch-all', async () => {
    renderAt('/shift/new')
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Shift Wizard')).toBeInTheDocument()
  })
})

describe('App.jsx catch-all wiring', () => {
  const src = readFileSync(resolve('src/App.jsx'), 'utf8')

  it('lazy-loads NotFound and mounts it on a splat route', () => {
    expect(src).toMatch(/lazy\(\(\) => import\('\.\/pages\/NotFound'\)\)/)
    expect(src).toMatch(/path="\*"\s+element=\{<NotFound\s*\/>\}/)
  })
})
