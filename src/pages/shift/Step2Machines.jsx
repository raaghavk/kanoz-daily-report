import { memo } from 'react'
import { AlertCircle, AlertTriangle } from 'lucide-react'

export default memo(function Step2Machines({ data, updateData }) {
  function updateMachine(idx, field, value) {
    const machines = [...data.machines]
    machines[idx] = { ...machines[idx], [field]: value }
    // Auto-calculate total hours and production hours
    if (field === 'from_time' || field === 'to_time' || field === 'breakdown_hrs') {
      const from = machines[idx].from_time
      const to = machines[idx].to_time
      if (from && to) {
        const [fh, fm] = from.split(':').map(Number)
        const [th, tm] = to.split(':').map(Number)
        let totalMin = (th * 60 + tm) - (fh * 60 + fm)
        if (totalMin < 0) totalMin += 24 * 60 // overnight
        const totalHrs = Math.round((totalMin / 60) * 100) / 100
        const breakdownHrs = parseFloat(machines[idx].breakdown_hrs) || 0
        const prodHrs = Math.max(0, totalHrs - breakdownHrs)
        machines[idx].total_hours = totalHrs
        machines[idx].production_hours = Math.round(prodHrs * 100) / 100
      }
    }
    // Legacy: convert breakdown_min to breakdown_hrs for backwards compat
    if (field === 'breakdown_min') {
      machines[idx].breakdown_hrs = value
    }
    if (field === 'remarks') {
      machines[idx].remarks = value
    }
    updateData('machines', machines)
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 8,
    border: '1.5px solid #e5ddd0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  }

  if (!data.machines.length) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <AlertCircle size={32} style={{ margin: '0 auto', color: '#b5b8a8', marginBottom: 8 }} />
        <p style={{ fontSize: 14, color: '#595c4a' }}>No machines found for this plant.</p>
        <p style={{ fontSize: 12, color: '#b5b8a8', marginTop: 4 }}>Ask admin to add machines in Settings.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 12, color: '#595c4a', margin: 0 }}>Enter runtime for each machine this shift.</p>
      {data.machines.map((m, idx) => {
        const totalHrs = m.total_hours || 0
        const showWarning = totalHrs > 12

        return (
          <div key={m.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '16px 16px 18px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, background: 'rgba(198, 246, 213, 0.5)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d6a4f', fontSize: 12, fontWeight: 800 }}>
                {idx + 1}
              </div>
              {m.name}
              <span style={{ background: '#e8f0ec', color: '#2d6a4f', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginLeft: 'auto' }}>Active</span>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: 6 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', paddingLeft: 2 }}>FROM</label>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', paddingLeft: 14 }}>TO</label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1.5px solid #e5ddd0', borderRadius: 8, overflow: 'hidden' }}>
                <input
                  type="time"
                  value={m.from_time}
                  onChange={e => updateMachine(idx, 'from_time', e.target.value)}
                  style={{ ...inputStyle, border: 'none', borderRight: '1px solid #e5ddd0', borderRadius: 0 }}
                />
                <input
                  type="time"
                  value={m.to_time}
                  onChange={e => updateMachine(idx, 'to_time', e.target.value)}
                  style={{ ...inputStyle, border: 'none', borderRadius: 0 }}
                />
              </div>
            </div>

            {showWarning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#fefae0', border: '1px solid #e9c46a', borderRadius: 8, marginBottom: 12 }}>
                <AlertTriangle size={14} color="#d4a373" />
                <span style={{ fontSize: 11, color: '#92400E' }}>Total hours ({totalHrs}) exceeds 12 — please verify times</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>TOTAL HRS</label>
                <div style={{ height: 44, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: '#fefae0', border: '1.5px solid #e5ddd0', fontSize: 13, fontWeight: 600, color: '#595c4a' }}>
                  {totalHrs}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>BREAKDOWN (hrs)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={m.breakdown_hrs || ''}
                  onChange={e => updateMachine(idx, 'breakdown_hrs', e.target.value)}
                  placeholder="0"
                  style={{ ...inputStyle, height: 44, textAlign: 'center' }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>PROD. HRS</label>
                <div style={{ height: 44, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(198, 246, 213, 0.2)', border: '1.5px solid #b8d4c4', fontSize: 13, fontWeight: 700, color: '#2d6a4f' }}>
                  {m.production_hours || 0}
                </div>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>REMARKS</label>
              <input
                type="text"
                value={m.remarks || ''}
                onChange={e => updateMachine(idx, 'remarks', e.target.value)}
                placeholder="Notes..."
                style={inputStyle}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
})
