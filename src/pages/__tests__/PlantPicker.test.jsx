import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import PlantPicker from '../PlantPicker'

const mockSwitchPlant = vi.fn()
const mockConfirmPlant = vi.fn()
const mockSignOut = vi.fn()
const authState = {
  employee: { id: 'e1', name: 'Rhaaghav', role: 'admin', org_id: 'o1' },
  plant: { id: 'p1', name: 'Prayagraj' },
}

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    employee: authState.employee,
    plant: authState.plant,
    switchPlant: (...args) => mockSwitchPlant(...args),
    confirmPlant: (...args) => mockConfirmPlant(...args),
    signOut: (...args) => mockSignOut(...args),
  }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../../lib/supabase'

describe('PlantPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.plant = { id: 'p1', name: 'Prayagraj' }
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 'p1', name: 'Prayagraj' },
          { id: 'p2', name: 'Siswa' },
        ],
      }),
    }
    supabase.from.mockReturnValue(chain)
  })

  it('reminds the current plant and confirms it on continue', async () => {
    render(<PlantPicker />)

    await waitFor(() => {
      expect(screen.getByText('Continue at Prayagraj')).toBeInTheDocument()
      expect(screen.getByText('Siswa')).toBeInTheDocument()
    })
    expect(screen.getByText('Confirm plant')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Continue at Prayagraj'))
    expect(mockConfirmPlant).toHaveBeenCalled()
    expect(mockSwitchPlant).not.toHaveBeenCalled()
  })

  it('switches plant from the reminder list', async () => {
    mockSwitchPlant.mockResolvedValue(undefined)
    render(<PlantPicker />)

    await waitFor(() => {
      expect(screen.getByText('Siswa')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Siswa'))
    await waitFor(() => {
      expect(mockSwitchPlant).toHaveBeenCalledWith('p2')
    })
  })

  it('signs out from the picker', async () => {
    render(<PlantPicker />)
    await waitFor(() => {
      expect(screen.getByText('Continue at Prayagraj')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Sign Out'))
    expect(mockSignOut).toHaveBeenCalled()
  })
})
