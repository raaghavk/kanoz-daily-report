import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Stepper from '../Stepper'

describe('Stepper', () => {
  it('renders correct number of step buttons', () => {
    render(<Stepper currentStep={1} onStepClick={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(11)
  })

  it('renders custom totalSteps', () => {
    render(<Stepper currentStep={1} totalSteps={5} onStepClick={() => {}} />)
    expect(screen.getAllByRole('tab')).toHaveLength(5)
  })

  it('marks current step with aria-selected', () => {
    render(<Stepper currentStep={3} onStepClick={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onStepClick with step number when clicked', () => {
    const onClick = vi.fn()
    render(<Stepper currentStep={1} onStepClick={onClick} />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[4])
    expect(onClick).toHaveBeenCalledWith(5)
  })

  it('ArrowRight advances step', () => {
    const onClick = vi.fn()
    render(<Stepper currentStep={3} onStepClick={onClick} />)
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(onClick).toHaveBeenCalledWith(4)
  })

  it('ArrowLeft goes back', () => {
    const onClick = vi.fn()
    render(<Stepper currentStep={3} onStepClick={onClick} />)
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' })
    expect(onClick).toHaveBeenCalledWith(2)
  })
})
