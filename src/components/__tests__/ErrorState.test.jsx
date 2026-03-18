import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorState from '../ErrorState'

describe('ErrorState', () => {
  it('renders error message', () => {
    render(<ErrorState message="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows Try Again button when onRetry is provided', () => {
    const onRetry = vi.fn()
    render(<ErrorState message="Error" onRetry={onRetry} />)
    const btn = screen.getByText('Try Again')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('does not show button when onRetry is not provided', () => {
    render(<ErrorState message="Error" />)
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument()
  })
})
