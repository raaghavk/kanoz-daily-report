import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../../hooks/useAdjacentRecord', () => ({
  useAdjacentRecord: () => ({ newerId: null, olderId: null, position: 1, total: 1, loading: false }),
}))

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ employee: { id: 'e1', role: 'admin' }, plant: { id: 'p1', name: 'Prayagraj' } }),
}))

vi.mock('../../../components/DeleteRequestButton', () => ({
  default: () => null,
}))

vi.mock('../../../lib/supabase', () => {
  const supabase = { from: vi.fn() }
  return { supabase }
})

import { supabase } from '../../../lib/supabase'
import PurchaseDetail from '../PurchaseDetail'

function chain(result) {
  const c = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    order: vi.fn(() => c),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return c
}

const basePurchase = {
  id: 'pur-1',
  plant_id: 'p1',
  date: '2026-10-27',
  purchase_time: '10:30:00',
  quantity_kg: 1000,
  rate_per_kg: 5,
  total_amount: 5000,
  total_rm_amount: 5000,
  payment_status: 'Pending',
  vehicle_number: 'UP32AB1234',
  serial_no: '8501',
  suppliers: { id: 's1', name: 'Test Supplier', mobile: '999' },
  raw_material_types: { id: 'rm1', name: 'Bhusa' },
  transporters: null,
}

function mockPurchase(purchase) {
  supabase.from.mockImplementation((table) => {
    if (table === 'raw_material_purchases') return chain({ data: purchase, error: null })
    if (table === 'employees') return chain({ data: { name: 'Pat' }, error: null })
    return chain({ data: null, error: null })
  })
}

function renderDetail() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/purchase/pur-1']}>
        <Routes>
          <Route path="/purchase/:id" element={<PurchaseDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PurchaseDetail unload plot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows Unloaded at Plot B without a Main badge', async () => {
    mockPurchase({
      ...basePurchase,
      storage_plots: { id: 'b', name: 'Ravindra singh plot B', is_primary: false },
    })
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('Unloaded at')).toBeInTheDocument()
    })
    expect(screen.getByText('Ravindra singh plot B')).toBeInTheDocument()
    expect(screen.queryByText('Main')).not.toBeInTheDocument()
  })

  it('shows Unloaded at Plot C without a Main badge', async () => {
    mockPurchase({
      ...basePurchase,
      storage_plots: { id: 'c', name: 'plot C', is_primary: false },
    })
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('Unloaded at')).toBeInTheDocument()
    })
    expect(screen.getByText('plot C')).toBeInTheDocument()
    expect(screen.queryByText('Main')).not.toBeInTheDocument()
  })

  it('shows Unloaded at the primary plot with a Main badge', async () => {
    mockPurchase({
      ...basePurchase,
      storage_plots: { id: 'main', name: 'Main factory land plot A', is_primary: true },
    })
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('Unloaded at')).toBeInTheDocument()
    })
    expect(screen.getByText('Main factory land plot A')).toBeInTheDocument()
    expect(screen.getByText('Main')).toBeInTheDocument()
  })

  it('hides Unloaded at when the purchase has no plot', async () => {
    mockPurchase({ ...basePurchase, storage_plots: null })
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('Purchase Info')).toBeInTheDocument()
    })
    expect(screen.queryByText('Unloaded at')).not.toBeInTheDocument()
  })
})
