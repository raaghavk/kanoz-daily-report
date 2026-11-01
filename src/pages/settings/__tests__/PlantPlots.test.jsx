import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => {
  const supabase = { from: vi.fn() }
  return { supabase }
})

vi.mock('../../../components/Toast', () => ({
  showToast: vi.fn(),
}))

import { supabase } from '../../../lib/supabase'
import PlantPlots from '../PlantPlots'

const PLOT_A = {
  id: 'plot-a',
  name: 'Main factory land plot A',
  is_primary: true,
  is_active: true,
  distance_km: null,
  distance_m: null,
  location_lat: null,
  location_lng: null,
  address: null,
}
const PLOT_C = {
  id: 'plot-c',
  name: 'Plot C',
  is_primary: false,
  is_active: true,
  distance_km: null,
  distance_m: null,
  location_lat: null,
  location_lng: null,
  address: null,
}
const PLOT_B = {
  id: 'plot-b',
  name: 'Ravindra singh plot B',
  is_primary: false,
  is_active: true,
  distance_km: 0.5,
  distance_m: 500,
  location_lat: 25.4358,
  location_lng: 81.8463,
  address: 'Near station',
}

function sortPlots(list) {
  return [...list].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return String(a.name).localeCompare(String(b.name))
  })
}

function mockPlots(initial) {
  let plots = sortPlots(initial)
  const lastUpdate = { payload: null, col: null, id: null }

  supabase.from.mockImplementation((table) => {
    expect(table).toBe('storage_plots')
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn((payload) => {
        lastUpdate.payload = payload
        return {
          eq: vi.fn((_col, id) => {
            lastUpdate.col = _col
            lastUpdate.id = id
            plots = sortPlots(plots.map(p => (p.id === id ? { ...p, ...payload } : p)))
            return Promise.resolve({ data: null, error: null })
          }),
        }
      }),
      then: (resolve, reject) => Promise.resolve({ data: plots, error: null }).then(resolve, reject),
    }
    return chain
  })

  return lastUpdate
}

async function renderLoaded(plots = [PLOT_A, PLOT_C, PLOT_B]) {
  const lastUpdate = mockPlots(plots)
  render(<PlantPlots plantId="plant-1" />)
  await waitFor(() => {
    expect(screen.getByText('Plot C')).toBeInTheDocument()
  })
  return lastUpdate
}

describe('PlantPlots inline edit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pre-fills the edit form with the clicked plot, not a neighbor', async () => {
    await renderLoaded()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Plot C' }))

    expect(screen.getByLabelText('Name *')).toHaveValue('Plot C')
    expect(screen.getByLabelText('Distance from factory (km)')).toHaveValue(null)
    expect(screen.getByLabelText('Latitude')).toHaveValue(null)
    expect(screen.getByLabelText('Longitude')).toHaveValue(null)
    expect(screen.queryByDisplayValue('Ravindra singh plot B')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue(0.5)).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue(25.4358)).not.toBeInTheDocument()
  })

  it('saves to the clicked plot id even after the list re-sorts by name', async () => {
    const lastUpdate = await renderLoaded()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Plot C' }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Plot C' } })
    fireEvent.change(screen.getByLabelText('Distance from factory (km)'), { target: { value: '0.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(lastUpdate.id).toBe('plot-c')
      expect(lastUpdate.col).toBe('id')
    })
    expect(lastUpdate.payload.distance_km).toBe(0.5)
    expect(lastUpdate.payload.name).toBe('Plot C')

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Edit Plot C' })).toBeInTheDocument()
    expect(screen.getByText('0.5 km from factory')).toBeInTheDocument()
    expect(screen.getByText('Ravindra singh plot B')).toBeInTheDocument()
  })

  it('replaces form values when switching from one plot to another', async () => {
    await renderLoaded()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ravindra singh plot B' }))
    expect(screen.getByLabelText('Name *')).toHaveValue('Ravindra singh plot B')
    expect(screen.getByLabelText('Distance from factory (km)')).toHaveValue(0.5)

    fireEvent.click(screen.getByLabelText('Cancel edit'))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Plot C' }))

    expect(screen.getByLabelText('Name *')).toHaveValue('Plot C')
    expect(screen.getByLabelText('Distance from factory (km)')).toHaveValue(null)
    expect(screen.queryByDisplayValue('Ravindra singh plot B')).not.toBeInTheDocument()
  })
})
