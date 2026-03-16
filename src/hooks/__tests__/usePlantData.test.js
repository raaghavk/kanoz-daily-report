import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { usePlantData } from '../usePlantData'

vi.mock('../../lib/supabase', () => {
  const mockChain = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    then: vi.fn(function (resolve) {
      return Promise.resolve({ data: [] }).then(resolve)
    }),
  })

  return {
    supabase: {
      from: vi.fn(() => mockChain()),
    },
  }
})

import { supabase } from '../../lib/supabase'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('usePlantData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is disabled when plantId is falsy', () => {
    const { result } = renderHook(() => usePlantData(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('returns loading state initially', () => {
    // Set up mock to return resolved data for all from() calls
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      then: vi.fn(function (resolve) {
        return Promise.resolve({ data: [] }).then(resolve)
      }),
    }
    supabase.from.mockReturnValue(chain)

    const { result } = renderHook(() => usePlantData('plant-1'), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(true)
  })

  it('returns plant config data on success', async () => {
    const machines = [{ id: 'm1', name: 'Machine 1' }]
    const materials = [{ id: 'r1', name: 'Iron Ore' }]

    let callCount = 0
    supabase.from.mockImplementation(() => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        then: vi.fn(function (resolve) {
          callCount++
          // First 4 calls are for machines, materials, pelletTypes, equipment
          const data = callCount === 1 ? machines
            : callCount === 2 ? materials
            : []
          return Promise.resolve({ data }).then(resolve)
        }),
      }
      return chain
    })

    const { result } = renderHook(() => usePlantData('plant-1'), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data.machines).toEqual(machines)
    expect(result.current.data.materials).toEqual(materials)
  })
})
