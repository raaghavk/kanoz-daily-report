import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

/**
 * Render a component wrapped in commonly needed providers for tests.
 */
export function renderWithProviders(ui, { queryClient, route = '/', ...renderOptions } = {}) {
  const testQueryClient = queryClient || new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={[route]}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient: testQueryClient,
  }
}
