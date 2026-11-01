import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'
import { activePlantStorageKey } from '../../lib/plantStorage'

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
const FOREIGN_PLANT = { id: 'p9', name: 'Other Org', org_id: 'o2', is_active: true }

function TestConsumer() {
  const { user, employee, plant, loading, noEmployeeRecord, accountInactive } = useAuth()
  if (loading) return <div>Loading...</div>
  if (accountInactive) return <div>Account deactivated</div>
  if (noEmployeeRecord) return <div>No employee record</div>
  if (user) return <div>User: {employee?.name || 'unknown'}, Plant: {plant?.name || 'none'}</div>
  return <div>Not authenticated</div>
}

function mockTables({ employee, plants = [] }) {
  supabase.from.mockImplementation((table) => {
    if (table === 'plants') {
      let lastId = null
      let lastOrgId = null
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col, val) => {
          if (col === 'id') lastId = val
          if (col === 'org_id') lastOrgId = val
          return chain
        }),
        order: vi.fn().mockResolvedValue({ data: plants }),
        single: vi.fn().mockImplementation(async () => {
          const row = plants.find(p =>
            (!lastId || p.id === lastId) && (!lastOrgId || p.org_id === lastOrgId)
          )
          return { data: row || null, error: row ? null : { message: 'not found' } }
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
      expect(screen.getByText('User: John, Plant: Plant A')).toBeInTheDocument()
    })
  })

  it('restores the last selected plant for an admin instead of the home plant', async () => {
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
      expect(screen.getByText('User: Admin, Plant: Plant B')).toBeInTheDocument()
    })
  })

  it('falls back to the home plant when the saved plant id is invalid', async () => {
    localStorage.setItem(activePlantStorageKey('u1'), 'p-missing')
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    mockTables({
      employee: { id: 'e1', name: 'Admin', role: 'admin', org_id: 'o1', plants: PLANT_A },
      plants: [PLANT_A, PLANT_B],
    })

    render(<AuthProvider><TestConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('User: Admin, Plant: Plant A')).toBeInTheDocument()
    })
  })

  it('falls back to the home plant when the saved plant belongs to another org', async () => {
    localStorage.setItem(activePlantStorageKey('u1'), 'p9')
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    mockTables({
      employee: { id: 'e1', name: 'Admin', role: 'admin', org_id: 'o1', plants: PLANT_A },
      plants: [PLANT_A, PLANT_B, FOREIGN_PLANT],
    })

    render(<AuthProvider><TestConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('User: Admin, Plant: Plant A')).toBeInTheDocument()
    })
  })

  it('ignores a saved plant id for non-admin users', async () => {
    localStorage.setItem(activePlantStorageKey('u1'), 'p2')
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    })

    mockTables({
      employee: { id: 'e1', name: 'Jane', role: 'supervisor', org_id: 'o1', plants: PLANT_A },
      plants: [PLANT_A, PLANT_B],
    })

    render(<AuthProvider><TestConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('User: Jane, Plant: Plant A')).toBeInTheDocument()
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

  it('switchPlant writes the plant id to localStorage keyed by user', async () => {
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

  it('refreshPlant after a switch reloads the switched plant, not the home plant', async () => {
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
})
