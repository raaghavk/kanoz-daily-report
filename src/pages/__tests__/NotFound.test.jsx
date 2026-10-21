import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NotFound from '../NotFound'

describe('NotFound', () => {
  it('explains the page is missing and offers a home button', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByText(/not a screen in the app/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument()
  })

  it('navigates home when Go home is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/diesel']}>
        <Routes>
          <Route path="/" element={<div>Home Screen</div>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))
    expect(screen.getByText('Home Screen')).toBeInTheDocument()
  })
})
