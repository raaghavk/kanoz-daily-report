import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useShiftReport } from '../useShiftReport'

vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
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

describe('useShiftReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is disabled when editId is falsy', () => {
    const { result } = renderHook(() => useShiftReport(null, 'p1'), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('is disabled when plantId is falsy', () => {
    const { result } = renderHook(() => useShiftReport('r1', null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('returns loading state initially', () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
      maybeSingle: vi.fn().mockReturnValue(new Promise(() => {})),
      then: vi.fn(() => new Promise(() => {})),
    }
    supabase.from.mockReturnValue(chain)

    const { result } = renderHook(() => useShiftReport('r1', 'p1'), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(true)
  })

  it('returns full report with child data on success', async () => {
    const report = { id: 'r1', date: '2025-01-15', shift: 1 }

    // First call: shift_reports.select().eq().single()
    // Subsequent calls: child tables
    supabase.from.mockImplementation(() => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: report, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        then: vi.fn(function (resolve) {
          return Promise.resolve({ data: [] }).then(resolve)
        }),
      }
      return chain
    })

    const { result } = renderHook(() => useShiftReport('r1', 'p1'), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data.report).toEqual(report)
    expect(result.current.data.machineProduction).toEqual([])
  })
})
