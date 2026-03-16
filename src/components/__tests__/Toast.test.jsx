import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from '../Toast'

function TestConsumer() {
  const { showToast } = useToast()
  return (
    <button onClick={() => showToast('Test message', 'success')}>
      Show Toast
    </button>
  )
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not render any alert initially', () => {
    render(<ToastProvider><div /></ToastProvider>)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows toast with message when showToast is called', () => {
    render(<ToastProvider><TestConsumer /></ToastProvider>)
    act(() => {
      screen.getByText('Show Toast').click()
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('auto-dismisses after 2500ms', () => {
    render(<ToastProvider><TestConsumer /></ToastProvider>)
    act(() => {
      screen.getByText('Show Toast').click()
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows toast for error type', () => {
    function ErrorConsumer() {
      const { showToast } = useToast()
      return <button onClick={() => showToast('Error!', 'error')}>Trigger</button>
    }

    render(<ToastProvider><ErrorConsumer /></ToastProvider>)
    act(() => {
      screen.getByText('Trigger').click()
    })
    expect(screen.getByText('Error!')).toBeInTheDocument()
  })
})
