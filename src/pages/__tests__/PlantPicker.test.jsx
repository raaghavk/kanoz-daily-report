import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import PlantPicker from '../PlantPicker'

const mockSwitchPlant = vi.fn()
const mockSignOut = vi.fn()

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    employee: { id: 'e1', name: 'Rhaaghav', role: 'admin', org_id: 'o1' },
    switchPlant: (...args) => mockSwitchPlant(...args),
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

  it('lists org plants and selects one on tap', async () => {
    mockSwitchPlant.mockResolvedValue(undefined)
    render(<PlantPicker />)

    await waitFor(() => {
      expect(screen.getByText('Prayagraj')).toBeInTheDocument()
      expect(screen.getByText('Siswa')).toBeInTheDocument()
    })
    expect(screen.getByText('Select plant')).toBeInTheDocument()
    expect(screen.getByText(/Signed in as/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Siswa'))
    await waitFor(() => {
      expect(mockSwitchPlant).toHaveBeenCalledWith('p2')
    })
  })

  it('signs out from the picker', async () => {
    render(<PlantPicker />)
    await waitFor(() => {
      expect(screen.getByText('Prayagraj')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Sign Out'))
    expect(mockSignOut).toHaveBeenCalled()
  })
})
