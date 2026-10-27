import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth, activePlantStorageKey } from '../AuthContext'

// Mock supabase module
vi.mock('../../lib/supabase', () => {
  const mockSupabase = {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  }
  return { supabase: mockSupabase }
})

import { supabase } from '../../lib/supabase'

const PLANT_A = { id: 'p1', name: 'Plant A', org_id: 'o1', is_active: true }
const PLANT_B = { id: 'p2', name: 'Plant B', org_id: 'o1', is_active: true }

function TestConsumer() {
  const { user, employee, plant, plantConfirmed, loading, noEmployeeRecord, accountInactive } = useAuth()
  if (loading) return <div>Loading...</div>
  if (accountInactive) return <div>Account deactivated</div>
  if (noEmployeeRecord) return <div>No employee record</div>
  if (user) {
    return (
      <div>
        User: {employee?.name || 'unknown'}, Plant: {plant?.name || 'none'}, Confirmed: {plantConfirmed ? 'yes' : 'no'}
      </div>
    )
  }
  return <div>Not authenticated</div>
}

function mockTables({ employee, plants = [] }) {
  supabase.from.mockImplementation((table) => {
    if (table === 'plants') {
      let lastId = null
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col, val) => {
          if (col === 'id') lastId = val
          return chain
        }),
        order: vi.fn().mockResolvedValue({ data: plants }),
        single: vi.fn().mockImplementation(async () => {
          const row = plants.find(p => p.id === lastId) || plants[0] || null
          return { data: row, error: row ? null : { message: 'not found' } }
        }),
      }
      return chain
    }
    if (table === 'roles') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [] }),
      }
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: employee }),
      single: vi.fn().mockResolvedValue({ data: employee }),
    }
  })
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('shows loading initially then resolves to no user', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    render(<AuthProvider><TestConsumer /></AuthProvider>)
    // After session resolves, loading should end
    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument()
    })
  })

  it('resolves to user/employee/plant when session exists', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    mockTables({
      employee: { id: 'e1', name: 'John', role: 'supervisor', org_id: 'o1', plants: PLANT_A },
    })

    render(<AuthProvider><TestConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('User: John, Plant: Plant A, Confirmed: yes')).toBeInTheDocument()
    })
  })

  it('suggests the home plant for admins but does not confirm it', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    mockTables({
      employee: { id: 'e1', name: 'Admin', role: 'admin', org_id: 'o1', plants: PLANT_A },
      plants: [PLANT_A, PLANT_B],
    })

    render(<AuthProvider><TestConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('User: Admin, Plant: Plant A, Confirmed: no')).toBeInTheDocument()
    })
  })

  it('restores the last selected plant as the reminder, still unconfirmed', async () => {
    localStorage.setItem(activePlantStorageKey('u1'), 'p2')
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    mockTables({
      employee: { id: 'e1', name: 'Admin', role: 'admin', org_id: 'o1', plants: PLANT_A },
      plants: [PLANT_A, PLANT_B],
    })

    render(<AuthProvider><TestConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('User: Admin, Plant: Plant B, Confirmed: no')).toBeInTheDocument()
    })
  })

  it('auto-selects the only active plant for an admin', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    mockTables({
      employee: { id: 'e1', name: 'Admin', role: 'admin', org_id: 'o1', plants: PLANT_A },
      plants: [PLANT_A],
    })

    render(<AuthProvider><TestConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('User: Admin, Plant: Plant A, Confirmed: yes')).toBeInTheDocument()
    })
  })

  it('treats an inactive employee as blocked, not signed in', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'e1', name: 'Inactive Pat', role: 'supervisor', is_active: false, plants: { id: 'p1', name: 'Plant A' } },
      }),
    }
    supabase.from.mockReturnValue(mockChain)

    render(<AuthProvider><TestConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('Account deactivated')).toBeInTheDocument()
    })
    expect(screen.queryByText(/User: Inactive Pat/)).not.toBeInTheDocument()
  })

  it('sets noEmployeeRecord when employee lookup returns null', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    }
    supabase.from.mockReturnValue(mockChain)

    render(<AuthProvider><TestConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('No employee record')).toBeInTheDocument()
    })
  })

  it('signOut clears user state', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'e1', name: 'Jane', role: 'supervisor', plants: { id: 'p1', name: 'Plant B' } },
      }),
    }
    supabase.from.mockReturnValue(mockChain)
    supabase.auth.signOut.mockResolvedValue({ error: null })

    function SignOutConsumer() {
      const { user, signOut, loading } = useAuth()
      if (loading) return <div>Loading...</div>
      return (
        <div>
          <span>{user ? 'Logged in' : 'Logged out'}</span>
          <button onClick={signOut}>Sign Out</button>
        </div>
      )
    }

    render(<AuthProvider><SignOutConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('Logged in')).toBeInTheDocument()
    })

    await act(async () => {
      screen.getByText('Sign Out').click()
    })

    expect(screen.getByText('Logged out')).toBeInTheDocument()
  })

  it('switchPlant only works for admin role', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    mockTables({
      employee: { id: 'e1', name: 'Admin', role: 'admin', org_id: 'o1', plants: PLANT_A },
      plants: [PLANT_A, PLANT_B],
    })

    function SwitchConsumer() {
      const { plant, switchPlant, loading } = useAuth()
      if (loading) return <div>Loading...</div>
      return (
        <div>
          <span>Plant: {plant?.name || 'none'}</span>
          <button onClick={() => switchPlant('p2')}>Switch</button>
        </div>
      )
    }

    render(<AuthProvider><SwitchConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('Plant: Plant A')).toBeInTheDocument()
    })

    supabase.from.mockImplementation((table) => {
      if (table === 'plants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [PLANT_A, PLANT_B] }),
          single: vi.fn().mockResolvedValue({ data: PLANT_B, error: null }),
        }
      }
      if (table === 'roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'e1', name: 'Admin', role: 'admin', org_id: 'o1', plants: PLANT_A },
        }),
      }
    })

    await act(async () => {
      screen.getByText('Switch').click()
    })

    await waitFor(() => {
      expect(screen.getByText('Plant: Plant B')).toBeInTheDocument()
    })
    expect(localStorage.getItem(activePlantStorageKey('u1'))).toBe('p2')
  })

  it('refreshPlant reloads the chosen plant and does not snap back when none is chosen', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    mockTables({
      employee: { id: 'e1', name: 'Admin', role: 'admin', org_id: 'o1', plants: PLANT_A },
      plants: [PLANT_A, PLANT_B],
    })

    function RefreshConsumer() {
      const { plant, switchPlant, refreshPlant, loading } = useAuth()
      if (loading) return <div>Loading...</div>
      return (
        <div>
          <span>Plant: {plant?.name || 'none'}</span>
          <button onClick={() => switchPlant('p2')}>Switch</button>
          <button onClick={() => refreshPlant()}>Refresh</button>
        </div>
      )
    }

    render(<AuthProvider><RefreshConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('Plant: Plant A')).toBeInTheDocument()
    })

    supabase.from.mockClear()
    await act(async () => {
      screen.getByText('Refresh').click()
    })
    expect(supabase.from).toHaveBeenCalled()

    supabase.from.mockImplementation((table) => {
      if (table === 'plants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [PLANT_A, PLANT_B] }),
          single: vi.fn().mockResolvedValue({
            data: { ...PLANT_B, location_lat: 26.1 },
            error: null,
          }),
        }
      }
      if (table === 'roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'e1', name: 'Admin', role: 'admin', org_id: 'o1', plants: PLANT_A },
        }),
      }
    })

    await act(async () => {
      screen.getByText('Switch').click()
    })
    await waitFor(() => {
      expect(screen.getByText('Plant: Plant B')).toBeInTheDocument()
    })

    await act(async () => {
      screen.getByText('Refresh').click()
    })
    await waitFor(() => {
      expect(screen.getByText('Plant: Plant B')).toBeInTheDocument()
    })
  })

  it('keeps the chosen plant across a session re-fetch', async () => {
    let authCb
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      authCb = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    mockTables({
      employee: { id: 'e1', name: 'Admin', role: 'admin', org_id: 'o1', plants: PLANT_A },
      plants: [PLANT_A, PLANT_B],
    })

    function SwitchConsumer() {
      const { plant, switchPlant, loading } = useAuth()
      if (loading) return <div>Loading...</div>
      return (
        <div>
          <span>Plant: {plant?.name || 'none'}</span>
          <button onClick={() => switchPlant('p2')}>Switch</button>
        </div>
      )
    }

    render(<AuthProvider><SwitchConsumer /></AuthProvider>)
    await waitFor(() => {
      expect(screen.getByText('Plant: Plant A')).toBeInTheDocument()
    })

    supabase.from.mockImplementation((table) => {
      if (table === 'plants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [PLANT_A, PLANT_B] }),
          single: vi.fn().mockResolvedValue({ data: PLANT_B, error: null }),
        }
      }
      if (table === 'roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'e1', name: 'Admin', role: 'admin', org_id: 'o1', plants: PLANT_A },
        }),
      }
    })

    await act(async () => {
      screen.getByText('Switch').click()
    })
    await waitFor(() => {
      expect(screen.getByText('Plant: Plant B')).toBeInTheDocument()
    })

    await act(async () => {
      authCb('TOKEN_REFRESHED', { user: { id: 'u1' } })
    })
    await waitFor(() => {
      expect(screen.getByText('Plant: Plant B')).toBeInTheDocument()
    })
  })
})
