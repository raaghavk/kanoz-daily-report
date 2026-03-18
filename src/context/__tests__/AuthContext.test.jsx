import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'

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

function TestConsumer() {
  const { user, employee, plant, loading, noEmployeeRecord } = useAuth()
  if (loading) return <div>Loading...</div>
  if (noEmployeeRecord) return <div>No employee record</div>
  if (user) return <div>User: {employee?.name || 'unknown'}, Plant: {plant?.name || 'none'}</div>
  return <div>Not authenticated</div>
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'e1', name: 'John', role: 'admin', plants: { id: 'p1', name: 'Plant A' } },
      }),
    }
    supabase.from.mockReturnValue(mockChain)

    render(<AuthProvider><TestConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('User: John, Plant: Plant A')).toBeInTheDocument()
    })
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

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'e1', name: 'Admin', role: 'admin', plants: { id: 'p1', name: 'Plant A' } },
      }),
    }
    supabase.from.mockReturnValue(mockChain)

    function SwitchConsumer() {
      const { plant, switchPlant, loading } = useAuth()
      if (loading) return <div>Loading...</div>
      return (
        <div>
          <span>Plant: {plant?.name}</span>
          <button onClick={() => switchPlant('p2')}>Switch</button>
        </div>
      )
    }

    render(<AuthProvider><SwitchConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('Plant: Plant A')).toBeInTheDocument()
    })

    // Mock the plant fetch for switchPlant
    const switchChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'p2', name: 'Plant B' },
        error: null,
      }),
    }
    supabase.from.mockReturnValue(switchChain)

    await act(async () => {
      screen.getByText('Switch').click()
    })

    await waitFor(() => {
      expect(screen.getByText('Plant: Plant B')).toBeInTheDocument()
    })
  })
})
