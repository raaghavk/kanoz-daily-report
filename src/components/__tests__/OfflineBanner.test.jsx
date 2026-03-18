import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import OfflineBanner from '../OfflineBanner'

// Mock the useOnlineStatus hook
vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}))

import { useOnlineStatus } from '../../hooks/useOnlineStatus'

describe('OfflineBanner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when online', () => {
    useOnlineStatus.mockReturnValue(true)
    const { container } = render(<OfflineBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('renders offline message when offline', () => {
    useOnlineStatus.mockReturnValue(false)
    render(<OfflineBanner />)
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument()
  })

  it('has role="status" for accessibility', () => {
    useOnlineStatus.mockReturnValue(false)
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
