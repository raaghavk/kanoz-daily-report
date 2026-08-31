import { memo } from 'react'
import { Plus, Trash2, Factory, AlertCircle, ArrowRight } from 'lucide-react'
import { newProcessingRunId } from '../../lib/processingDeltas'

const C = {
  cream: '#fefae0',
  green: '#2d6a4f',
  darkGreen: '#1b4332',
  border: '#e5ddd0',
  muted: '#8a8d7a',
  text: '#2c2c2c',
  card: '#fff',
}

// Ordered stages for a route (each { seq, machine_id, machine_name }).
function routeStages(route) {
  const stages = route?.process_route_stages || route?.stages || []
  return [...stages].sort((a, b) => (a.seq || 0) - (b.seq || 0))
}

function routeLabel(route) {
  const machines = routeStages(route).map(s => s.machine_name).filter(Boolean).join(' → ')
  const inName = route?.input_material_name || 'Input'
  const outName = route?.output_material_name || 'Output'
  return machines
    ? inName + ' → [' + machines + '] → ' + outName
    : inName + ' → ' + outName
}

export default memo(function StepProcessing({ data, updateData, routes }) {
  const processing = data.processing || []
  const activeRoutes = routes || []

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1.5px solid ' + C.border,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
  }
  const labelStyle = { display: 'block', fontSize: 10, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }

  // Build a run from a selected route. Materials come straight off the route so
  // they line up with the raw_material_types the stock accounting matches on.
  function runFromRoute(route) {
    const stages = routeStages(route)
    return {
      local_id: newProcessingRunId(),
      route_id: route.id,
      route_name: route.name,
      input_material: route.input_material_name || '',
      input_material_id: route.input_material_type_id || null,
      input_material_type_id: route.input_material_type_id || null,
      output_material: route.output_material_name || '',
      output_material_id: route.output_material_type_id || null,
      output_material_type_id: route.output_material_type_id || null,
      expected_yield_pct: route.expected_yield_pct != null ? parseFloat(route.expected_yield_pct) : null,
      stages: stages.map(s => ({ seq: s.seq, machine_id: s.machine_id, machine_name: s.machine_name })),
      machine_hours: {},
      input_kg: '',
      output_kg: '',
      note: '',
    }
  }

  function addRun() {
    const route = activeRoutes[0]
    if (!route) return
    updateData('processing', [...processing, runFromRoute(route)])
  }

  function updateRun(idx, patch) {
    const next = processing.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    updateData('processing', next)
  }

  function removeRun(idx) {
    updateData('processing', processing.filter((_, i) => i !== idx))
  }

  // Re-pick the route for an existing run: reset materials + stages, keep qty/note.
  function onRouteChange(idx, routeId) {
    const route = activeRoutes.find(r => r.id === routeId)
    if (!route) return
    const cur = processing[idx] || {}
    const fresh = runFromRoute(route)
    updateRun(idx, {
      ...fresh,
      local_id: cur.local_id || fresh.local_id,
      db_id: cur.db_id,
      input_kg: cur.input_kg != null ? cur.input_kg : '',
      output_kg: cur.output_kg != null ? cur.output_kg : '',
      note: cur.note != null ? cur.note : '',
      machine_hours: {},
    })
  }

  function updateMachineHours(idx, machineId, value) {
    const cur = processing[idx] || {}
    const mh = { ...(cur.machine_hours || {}) }
    if (value === '' || value == null) delete mh[machineId]
    else mh[machineId] = value
    updateRun(idx, { machine_hours: mh })
  }

  const yieldOf = (r) => {
    const inKg = parseFloat(r.input_kg) || 0
    const outKg = parseFloat(r.output_kg) || 0
    return inKg > 0 ? (outKg / inKg) * 100 : 0
  }
  // "Wildly off" = more output than input, or actual yield deviates from the
  // route's expected yield by more than 20 percentage points.
  const yieldFlag = (r) => {
    const y = yieldOf(r)
    if ((parseFloat(r.input_kg) || 0) <= 0) return false
    if (y > 100) return true
    const exp = r.expected_yield_pct
    if (exp != null && !Number.isNaN(exp) && Math.abs(y - exp) > 20) return true
    return false
  }

  const totalOutput = processing.reduce((s, r) => s + (parseFloat(r.output_kg) || 0), 0)
  const totalInput = processing.reduce((s, r) => s + (parseFloat(r.input_kg) || 0), 0)

  // ---- Empty state: no routes configured for this plant ----
  if (activeRoutes.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
          Record material converted in-house this shift (e.g. wood log to saw dust).
        </p>
        <div style={{ textAlign: 'center', padding: '28px 16px', background: C.card, borderRadius: 14, border: '1.5px solid ' + C.border }}>
          <Factory size={32} style={{ margin: '0 auto', color: '#b5b8a8', marginBottom: 10 }} />
          <p style={{ fontSize: 14, color: '#595c4a', margin: 0, fontWeight: 600 }}>No process routes set up.</p>
          <p style={{ fontSize: 12, color: C.muted, margin: '6px 0 0' }}>
            Configure them in Settings {'→'} Process Routes.
          </p>
          <p style={{ fontSize: 11, color: C.muted, margin: '10px 0 0' }}>
            You can skip this step {'—'} no processing will be recorded.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
        Record each in-house conversion done this shift. Pick a route, enter how much
        went in and came out, and log hours per machine. Leave empty if nothing was processed.
      </p>

      {processing.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <Factory size={32} style={{ margin: '0 auto', color: '#b5b8a8', marginBottom: 8 }} />
          <p style={{ fontSize: 14, color: '#595c4a', margin: 0 }}>No in-house processing this shift</p>
          <button
            onClick={addRun}
            style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <Plus size={15} /> Add Processing Run
          </button>
        </div>
      ) : (
        <>
          {processing.map((r, idx) => {
            const y = yieldOf(r)
            const flag = yieldFlag(r)
            const stages = r.stages || []
            const mh = r.machine_hours || {}
            return (
              <div key={r.local_id || idx} style={{ background: C.card, borderRadius: 14, border: '1.5px solid ' + C.border, padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, color: C.text }}>
                    <div style={{ width: 30, height: 30, background: 'rgba(198, 246, 213, 0.5)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green, fontSize: 12, fontWeight: 800 }}>
                      {idx + 1}
                    </div>
                    Processing Run
                  </div>
                  <button
                    onClick={() => removeRun(idx)}
                    aria-label="Remove run"
                    style={{ width: 32, height: 32, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#b91c1c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Route</label>
                  <select
                    value={r.route_id || ''}
                    onChange={e => onRouteChange(idx, e.target.value)}
                    style={inputStyle}
                  >
                    {!activeRoutes.some(rt => rt.id === r.route_id) && r.route_id && (
                      <option value={r.route_id}>{routeLabel(r)}</option>
                    )}
                    {activeRoutes.map(rt => (
                      <option key={rt.id} value={rt.id}>{routeLabel(rt)}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: C.darkGreen, flexWrap: 'wrap' }}>
                    <strong>{r.input_material || 'Input'}</strong>
                    <ArrowRight size={13} color={C.muted} />
                    <span style={{ color: C.muted }}>{stages.map(s => s.machine_name).filter(Boolean).join(' → ') || 'no machines'}</span>
                    <ArrowRight size={13} color={C.muted} />
                    <strong>{r.output_material || 'Output'}</strong>
                    {r.expected_yield_pct != null && !Number.isNaN(r.expected_yield_pct) && (
                      <span style={{ color: C.muted }}>{'·'} expected {r.expected_yield_pct}%</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Input kg ({r.input_material || 'input'})</label>
                    <input
                      type="number" min="0" step="1" inputMode="decimal"
                      value={r.input_kg}
                      onChange={e => updateRun(idx, { input_kg: e.target.value })}
                      placeholder="0"
                      style={{ ...inputStyle, textAlign: 'right' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Output kg ({r.output_material || 'output'})</label>
                    <input
                      type="number" min="0" step="1" inputMode="decimal"
                      value={r.output_kg}
                      onChange={e => updateRun(idx, { output_kg: e.target.value })}
                      placeholder="0"
                      style={{ ...inputStyle, textAlign: 'right' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Actual Yield %</label>
                  <div style={{ height: 42, boxSizing: 'border-box', display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: 8, background: flag ? '#fef2f2' : 'rgba(198, 246, 213, 0.2)', border: '1.5px solid ' + (flag ? '#fca5a5' : '#b8d4c4'), fontSize: 13, fontWeight: 700, color: flag ? '#b91c1c' : C.green }}>
                    {y.toFixed(1)}%
                  </div>
                  {flag && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <AlertCircle size={13} color="#b91c1c" />
                      <span style={{ fontSize: 11, color: '#b91c1c' }}>
                        {y > 100 ? 'Output exceeds input — please verify weights' : 'Yield far from expected — please verify weights'}
                      </span>
                    </div>
                  )}
                </div>

                {stages.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Machine hours</label>
                    <div style={{ display: 'grid', gridTemplateColumns: stages.length > 1 ? '1fr 1fr' : '1fr', gap: 10 }}>
                      {stages.map((s, si) => (
                        <div key={s.machine_id || si}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{s.machine_name || 'Machine ' + (si + 1)}</div>
                          <input
                            type="number" min="0" step="0.5" inputMode="decimal"
                            value={mh[s.machine_id] != null ? mh[s.machine_id] : ''}
                            onChange={e => updateMachineHours(idx, s.machine_id, e.target.value)}
                            placeholder="0"
                            style={{ ...inputStyle, textAlign: 'right' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Note (optional)</label>
                  <input
                    type="text"
                    value={r.note || ''}
                    onChange={e => updateRun(idx, { note: e.target.value })}
                    placeholder="Notes..."
                    style={inputStyle}
                  />
                </div>
              </div>
            )
          })}

          <div style={{ background: 'rgba(198, 246, 213, 0.25)', border: '1.5px solid #b8d4c4', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: C.darkGreen }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>This shift (in-house)</div>
            <div>Total output produced: <strong>{Math.round(totalOutput)} kg</strong></div>
            <div>Total input consumed: <strong>{Math.round(totalInput)} kg</strong></div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Reflected in Raw Material stock (Step 3): each output added to Produced, each input added to Used.</div>
          </div>

          <button
            onClick={addRun}
            style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6, padding: '9px 16px', background: C.green, color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            <Plus size={14} /> Add Another Run
          </button>
        </>
      )}
    </div>
  )
})
