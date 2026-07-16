import { memo, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

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

  function setDidNotRun(idx, didNotRun) {
    const machines = [...data.machines]
    machines[idx] = { ...machines[idx], did_not_run: didNotRun }
    if (didNotRun) {
      machines[idx].from_time = ''
      machines[idx].to_time = ''
      machines[idx].total_hours = 0
      machines[idx].production_hours = 0
      machines[idx].breakdown_hrs = 0
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

  // Group machines by machine_type, preserving each machine's original index
  // (used by the handlers) and its existing sort_order within the group.
  const groups = useMemo(() => {
    const map = new Map()
    ;(data.machines || []).forEach((m, idx) => {
      const key = (m.machine_type && String(m.machine_type).trim()) || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push({ m, idx })
    })
    return Array.from(map.entries()).map(([type, items]) => ({ type, items }))
  }, [data.machines])

  // Collapsed state keyed by type name. Default: all groups expanded on first
  // open; the header chevron lets the user collapse to condense the list.
  const [collapsed, setCollapsed] = useState({})
  const toggleGroup = (type) =>
    setCollapsed(prev => ({ ...prev, [type]: !prev[type] }))

  if (!data.machines.length) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <AlertCircle size={32} style={{ margin: '0 auto', color: '#b5b8a8', marginBottom: 8 }} />
        <p style={{ fontSize: 14, color: '#595c4a' }}>No machines found for this plant.</p>
        <p style={{ fontSize: 12, color: '#b5b8a8', marginTop: 4 }}>Ask admin to add machines in Settings.</p>
      </div>
    )
  }

  function renderMachine(m, idx) {
    const totalHrs = m.total_hours || 0
    const showWarning = totalHrs > 12

    return (
      <div key={m.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '16px 16px 18px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: 'rgba(198, 246, 213, 0.5)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d6a4f', fontSize: 12, fontWeight: 800 }}>
            {idx + 1}
          </div>
          {m.name}
        </div>

        <p style={{ fontSize: 11, color: '#595c4a', margin: '0 0 10px 0' }}>
          Only Running machines with From/To times will appear in Step 4.
        </p>

        <div
          role="group"
          aria-label={`${m.name} production status`}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            aria-pressed={!m.did_not_run}
            onClick={() => setDidNotRun(idx, false)}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              border: !m.did_not_run ? '2px solid #14532D' : '1.5px solid #cdd5d1',
              background: !m.did_not_run ? '#14532D' : '#ffffff',
              color: !m.did_not_run ? '#FFFFFF' : '#374151',
              cursor: 'pointer',
            }}
          >
            Running
          </button>
          <button
            type="button"
            aria-pressed={m.did_not_run}
            onClick={() => setDidNotRun(idx, true)}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              border: m.did_not_run ? '2px solid #991B1B' : '1.5px solid #cdd5d1',
              background: m.did_not_run ? '#991B1B' : '#ffffff',
              color: m.did_not_run ? '#FFFFFF' : '#374151',
              cursor: 'pointer',
            }}
          >
            No Production
          </button>
        </div>
        {!m.did_not_run && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: 6 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', paddingLeft: 2 }}>FROM</label>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', paddingLeft: 14 }}>TO</label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1.5px solid #e5ddd0', borderRadius: 8, overflow: 'hidden' }}>
            <input
              type="time"
              value={m.from_time}
              onInput={e => updateMachine(idx, 'from_time', e.target.value)}
              onChange={e => updateMachine(idx, 'from_time', e.target.value)}
              onBlur={e => updateMachine(idx, 'from_time', e.target.value)}
              style={{ ...inputStyle, border: 'none', borderRight: '1px solid #e5ddd0', borderRadius: 0 }}
            />
            <input
              type="time"
              value={m.to_time}
              onInput={e => updateMachine(idx, 'to_time', e.target.value)}
              onChange={e => updateMachine(idx, 'to_time', e.target.value)}
              onBlur={e => updateMachine(idx, 'to_time', e.target.value)}
              style={{ ...inputStyle, border: 'none', borderRadius: 0 }}
            />
          </div>
        </div>
        )}

        {!m.did_not_run && (
        <>
        {showWarning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#fefae0', border: '1px solid #e9c46a', borderRadius: 8, marginBottom: 12 }}>
            <AlertTriangle size={14} color="#d4a373" />
            <span style={{ fontSize: 11, color: '#92400E' }}>Total hours ({totalHrs}) exceeds 12 &mdash; please verify times</span>
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
              style={{ width: '100%', height: 44, padding: '0 10px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
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
        </>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 12, color: '#595c4a', margin: 0 }}>Enter runtime for each machine this shift.</p>
      {groups.map(({ type, items }) => {
        const isCollapsed = !!collapsed[type]
        const runningCount = items.filter(({ m }) => !m.did_not_run).length
        return (
          <div key={type} style={{ background: '#fefae0', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() => toggleGroup(type)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '14px 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#2c2c2c' }}>{type}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#8a8d7a' }}>
                  &middot; {items.length} &middot; {runningCount} running
                </span>
              </div>
              {isCollapsed
                ? <ChevronDown size={18} color="#2d6a4f" />
                : <ChevronUp size={18} color="#2d6a4f" />}
            </button>
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 12px 14px' }}>
                {items.map(({ m, idx }) => renderMachine(m, idx))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})
