import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoBanner, DemoShell } from '../DemoBanner'
import DemoMark from '../DemoMark'
import { DEMO_APP_NAME } from '../../lib/demo/mode'

describe('DemoBanner', () => {
  it('renders the persistent sample-data watermark', () => {
    render(<DemoBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('DEMO — sample data only')
  })

  it('wraps children in demo mode (on by default in tests)', () => {
    render(<DemoShell><div>child-content</div></DemoShell>)
    expect(screen.getByText('DEMO — sample data only')).toBeInTheDocument()
    expect(screen.getByText('child-content')).toBeInTheDocument()
  })
})

describe('DemoMark', () => {
  it('renders a neutral pellet mark without Kanoz branding', () => {
    render(<DemoMark />)
    expect(screen.getByRole('img', { name: DEMO_APP_NAME })).toBeInTheDocument()
  })
})
