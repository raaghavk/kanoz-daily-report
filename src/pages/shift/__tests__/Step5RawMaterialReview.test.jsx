import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import Step5RawMaterialReview from '../Step5RawMaterialReview'

function Harness({ mix, onWrite = () => {} }) {
  const [data, setData] = useState({
    rawMaterials: [],
    mixes: [mix],
    production: [],
  })
  const updateData = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }))
    onWrite(field, value)
  }
  return <Step5RawMaterialReview data={data} updateData={updateData} />
}

const mix500kg = {
  local_id: 'mix1',
  name: 'Mix A',
  opening_kg: 0,
  prepared_kg: 2000,
  used_kg: 500,
}

describe('Step5RawMaterialReview mix Used', () => {
  it('shows mix Used in MT like Opening/Prepared, not raw kg', () => {
    render(<Harness mix={mix500kg} />)
    expect(screen.getByDisplayValue('0.5')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('500')).not.toBeInTheDocument()
  })

  it('treats Used edits as MT and stores kg (not kg*1000)', () => {
    let written
    render(<Harness mix={mix500kg} onWrite={(_field, value) => { written = value }} />)
    fireEvent.change(screen.getByLabelText('Mix A used (MT)'), { target: { value: '0.4' } })
    expect(written[0].used_kg).toBe(400)
  })
})
