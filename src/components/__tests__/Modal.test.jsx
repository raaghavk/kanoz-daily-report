import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Modal from '../Modal'

describe('Modal', () => {
  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('returns null when isOpen is false', () => {
    const { container } = render(<Modal isOpen={false} onClose={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders dialog with correct aria attributes when open', () => {
    render(<Modal isOpen={true} onClose={() => {}} title="Test" />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Test')
  })

  it('renders title in h3 when provided', () => {
    render(<Modal isOpen={true} onClose={() => {}} title="My Title"><p>content</p></Modal>)
    expect(screen.getByText('My Title').tagName).toBe('H3')
  })

  it('renders children content', () => {
    render(<Modal isOpen={true} onClose={() => {}}><p>Hello World</p></Modal>)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<Modal isOpen={true} onClose={onClose}><p>content</p></Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    render(<Modal isOpen={true} onClose={onClose}><p>content</p></Modal>)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose when inner content is clicked', () => {
    const onClose = vi.fn()
    render(<Modal isOpen={true} onClose={onClose}><p>inner text</p></Modal>)
    fireEvent.click(screen.getByText('inner text'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sets body overflow to hidden when open', () => {
    render(<Modal isOpen={true} onClose={() => {}}><p>x</p></Modal>)
    expect(document.body.style.overflow).toBe('hidden')
  })
})
