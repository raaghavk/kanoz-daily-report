import { vi } from 'vitest'

/**
 * Creates a chainable mock that mimics the Supabase query builder.
 * Configure the resolved value with mockResolvedData/mockResolvedError before calling.
 */
export function createMockSupabase() {
  // Store configurable responses per table
  const tableResponses = {}
  const authState = {
    session: null,
    onAuthCallback: null,
  }

  function setTableResponse(table, response) {
    tableResponses[table] = response
  }

  function createChain(table) {
    const response = () => tableResponses[table] || { data: null, error: null }
    const chain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => Promise.resolve(response())),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(response())),
      then: vi.fn().mockImplementation((resolve) => Promise.resolve(response()).then(resolve)),
    }
    // Make the chain itself thenable (for await supabase.from('x').select())
    chain[Symbol.for('thennable')] = true
    return chain
  }

  const supabase = {
    from: vi.fn((table) => createChain(table)),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: authState.session } }),
      onAuthStateChange: vi.fn((callback) => {
        authState.onAuthCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    _setTableResponse: setTableResponse,
    _authState: authState,
  }

  return supabase
}
