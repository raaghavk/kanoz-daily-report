import { memo } from 'react'
import { Clock, AlertCircle } from 'lucide-react'

export default memo(function Step2Machines({ data, updateData }) {
  function updateMachine(idx, field, value) {
    const machines = [...data.machines]
    machines[idx] = { ...machines[idx], [field]: value }
    // Auto-calculate production hours
    if (field === 'from_time' || field === 'to_time' || field === 'breakdown_min') {
      const from = machines[idx].from_time
      const to = machines[idx].to_time
      if (from && to) {
        const [fh, fm] = from.split(':').map(Number)
        const [th, tm] = to.split(':').map(Number)
        let totalMin = (th * 60 + tm) - (fh * 60 + fm)
        if (totalMin < 0) totalMin += 24 * 60 // overnight
        const prodHrs = Math.max(0, (totalMin - (parseInt(machines[idx].breakdown_min) || 0)) / 60)
        machines[idx].production_hours = Math.round(prodHrs * 100) / 100
      }
    }
    // Handle remarks field
    if (field === 'remarks') {
      machines[idx].remarks = value
    }
    updateData('machines', machines)
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 8,
    border: '1.5px solid #E2E8E4',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  }

  if (!data.machines.length) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <AlertCircle size={32} style={{ margin: '0 auto', color: '#C5CFC8', marginBottom: 8 }} />
        <p style={{ fontSize: 14, color: '#5A6B62' }}>No machines found for this plant.</p>
        <p style={{ fontSize: 12, color: '#C5CFC8', marginTop: 4 }}>Ask admin to add machines in Settings.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 12, color: '#5A6B62', margin: 0 }}>Enter runtime for each machine this shift.</p>
      {data.machines.map((m, idx) => (
        <div key={m.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: '16px 16px 18px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, background: 'rgba(198, 246, 213, 0.5)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1B7A45', fontSize: 12, fontWeight: 800 }}>
              {idx + 1}
            </div>
            {m.name}
            <span style={{ background: '#E8F5EE', color: '#1B7A45', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginLeft: 'auto' }}>Active</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>FROM</label>
              <input
                type="time"
                value={m.from_time}
                onChange={e => updateMachine(idx, 'from_time', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>TO</label>
              <input
                type="time"
                value={m.to_time}
                onChange={e => updateMachine(idx, 'to_time', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>BREAKDOWN (min)</label>
              <input
                type="number"
                value={m.breakdown_min || ''}
                onChange={e => updateMachine(idx, 'breakdown_min', e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>PROD. HOURS</label>
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(198, 246, 213, 0.2)', border: '1.5px solid #C6F6D5', fontSize: 14, fontWeight: 700, color: '#1B7A45' }}>
                {m.production_hours || 0} hrs
              </div>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>REMARKS</label>
            <input
              type="text"
              value={m.remarks || ''}
              onChange={e => updateMachine(idx, 'remarks', e.target.value)}
              placeholder="Notes..."
              style={inputStyle}
            />
          </div>
        </div>
      ))}
    </div>
  )
})
