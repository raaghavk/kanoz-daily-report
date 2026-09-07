import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useState } from 'react'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn(),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  },
}))

import Step8Issues from '../Step8Issues'

function Harness({ issue }) {
  const [data, setData] = useState({
    machines: [{ id: 'm1', name: 'Hammer Mill' }],
    issues: [issue],
  })
  const updateData = (field, value) => setData(prev => ({ ...prev, [field]: value }))
  return <Step8Issues data={data} updateData={updateData} />
}

describe('Step8Issues photo preview', () => {
  it('shows the saved issue photo when editing a report', () => {
    render(<Harness issue={{
      id: 'iss-1',
      type: 'Machine',
      description: 'Belt snapped',
      severity: 'high',
      photo_url: 'https://example.com/issues/belt.jpg',
      machine_id: 'm1',
    }} />)

    const img = screen.getByAltText('Upload')
    expect(img).toHaveAttribute('src', 'https://example.com/issues/belt.jpg')
  })

  it('shows the camera picker when there is no photo yet', () => {
    render(<Harness issue={{
      id: 'iss-2',
      type: 'Labour',
      description: 'Short staffed',
      severity: 'medium',
      photo_url: null,
      machine_id: null,
    }} />)

    expect(screen.queryByAltText('Upload')).not.toBeInTheDocument()
    expect(screen.getByText('Take Photo')).toBeInTheDocument()
  })
})
