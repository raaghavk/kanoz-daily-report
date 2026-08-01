import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import Step2Machines from '../Step2Machines'

const baseMachine = {
  id: 'm1',
  name: 'Machine 1',
  did_not_run: false,
  from_time: '08:00',
  to_time: '12:00',
  total_hours: 4,
  production_hours: 3.5,
  breakdown_hrs: 0.5,
  remarks: 'ok',
}

function Harness({ machine = baseMachine, onWrite = () => {} }) {
  const [data, setData] = useState({ machines: [machine] })
  const updateData = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }))
    onWrite(field, value)
  }

  return <Step2Machines data={data} updateData={updateData} />
}

// Machine groups start collapsed by default; expand them to reach the controls.
function expandGroups() {
  document.querySelectorAll('button[aria-expanded="false"]').forEach(b => fireEvent.click(b))
}

describe('Step2Machines', () => {
  it('toggling to No Production removes timing fields', () => {
    render(<Harness />)
    expandGroups()

    expect(screen.getAllByDisplayValue(/\d{2}:\d{2}/)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'No Production' }))

    expect(screen.queryByDisplayValue('08:00')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('12:00')).not.toBeInTheDocument()
  })

  it('toggling back to Running allows timing entry', () => {
    render(<Harness machine={{ ...baseMachine, did_not_run: true, from_time: '', to_time: '' }} />)
    expandGroups()

    fireEvent.click(screen.getByRole('button', { name: 'Running' }))

    const timeInputs = screen.getAllByDisplayValue('')
    expect(timeInputs.length).toBeGreaterThanOrEqual(2)
    fireEvent.change(timeInputs[0], { target: { value: '09:30' } })
    expect(screen.getByDisplayValue('09:30')).toBeInTheDocument()
  })

  it('writes did_not_run correctly', () => {
    const writes = []
    render(<Harness onWrite={(_, value) => writes.push(value[0].did_not_run)} />)
    expandGroups()

    fireEvent.click(screen.getByRole('button', { name: 'No Production' }))
    fireEvent.click(screen.getByRole('button', { name: 'Running' }))

    expect(writes).toContain(true)
    expect(writes).toContain(false)
  })
})
