import { memo } from 'react'
import { Plus, Trash2, Factory, AlertCircle } from 'lucide-react'

const C = {
  cream: '#fefae0',
  green: '#2d6a4f',
  darkGreen: '#1b4332',
  border: '#e5ddd0',
  muted: '#8a8d7a',
  text: '#2c2c2c',
  card: '#fff',
}

// Compute per-material stock deltas from processing runs.
//  - output material (Saw Dust) gains `produced` kg
//  - input material (Wood Log) is consumed -> added to `used`
// Matching is done by material id when the run stores one, else by name.
// Exported so ShiftWizard / Step3 can keep rawMaterials in sync.
export function computeProcessingDeltas(processing, rawMaterials) {
  const producedById = {}
  const usedById = {}
  const producedByName = {}
  const usedByName = {}
  ;(processing || []).forEach(run => {
    const inKg = parseFloat(run.input_kg) || 0
    const outKg = parseFloat(run.output_kg) || 0
    if (run.input_material_id) usedById[run.input_material_id] = (usedById[run.input_material_id] || 0) + inKg
    else if (run.input_material) usedByName[run.input_material] = (usedByName[run.input_material] || 0) + inKg
    if (run.output_material_id) producedById[run.output_material_id] = (producedById[run.output_material_id] || 0) + outKg
    else if (run.output_material) producedByName[run.output_material] = (producedByName[run.output_material] || 0) + outKg
  })
  const perMaterial = {}
  ;(rawMaterials || []).forEach(rm => {
    const produced = (producedById[rm.id] || 0) + (producedByName[rm.name] || 0)
    const procUsed = (usedById[rm.id] || 0) + (usedByName[rm.name] || 0)
    perMaterial[rm.id] = { produced, procUsed }
  })
  return perMaterial
}

export default memo(function StepProcessing({ data, updateData }) {
  const processing = data.processing || []
  const rawMaterials = data.rawMaterials || []

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

  const defaultInput = () => {
    const wood = rawMaterials.find(rm => /wood\s*log|log/i.test(rm.name || ''))
    return wood ? { input_material: wood.name, input_material_id: wood.id } : { input_material: 'Wood Log', input_material_id: null }
  }
  const defaultOutput = () => {
    const sd = rawMaterials.find(rm => /saw\s*dust/i.test(rm.name || ''))
    return sd ? { output_material: sd.name, output_material_id: sd.id } : { output_material: 'Saw Dust', output_material_id: null }
  }

  function addRun() {
    const run = {
      local_id: 'proc_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      ...defaultInput(),
      input_kg: '',
      ...defaultOutput(),
      output_kg: '',
      log_eater_hours: '',
      hammer_mill_hours: '',
      note: '',
    }
    updateData('processing', [...processing, run])
  }

  function updateRun(idx, patch) {
    const next = processing.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    updateData('processing', next)
  }

  function removeRun(idx) {
    updateData('processing', processing.filter((_, i) => i !== idx))
  }

  function onInputMaterialChange(idx, name) {
    const rm = rawMaterials.find(r => r.name === name)
    updateRun(idx, { input_material: name, input_material_id: rm ? rm.id : null })
  }
  function onOutputMaterialChange(idx, name) {
    const rm = rawMaterials.find(r => r.name === name)
    updateRun(idx, { output_material: name, output_material_id: rm ? rm.id : null })
  }

  const yieldOf = (r) => {
    const inKg = parseFloat(r.input_kg) || 0
    const outKg = parseFloat(r.output_kg) || 0
    return inKg > 0 ? (outKg / inKg) * 100 : 0
  }

  const totalSawDust = processing.reduce((s, r) => s + (parseFloat(r.output_kg) || 0), 0)
  const totalWoodLog = processing.reduce((s, r) => s + (parseFloat(r.input_kg) || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
        Record saw dust made in-house this shift: wood log to Log Eater to Hammer Mill to saw dust.
        Leave empty if no saw dust was produced.
      </p>

      {processing.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <Factory size={32} style={{ margin: '0 auto', color: '#b5b8a8', marginBottom: 8 }} />
          <p style={{ fontSize: 14, color: '#595c4a', margin: 0 }}>No in-house saw dust made this shift</p>
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
            const overYield = y > 100
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Input Material</label>
                    {rawMaterials.length > 0 ? (
                      <select
                        value={r.input_material || ''}
                        onChange={e => onInputMaterialChange(idx, e.target.value)}
                        style={inputStyle}
                      >
                        {!rawMaterials.some(rm => rm.name === r.input_material) && r.input_material && (
                          <option value={r.input_material}>{r.input_material}</option>
                        )}
                        {rawMaterials.map(rm => (
                          <option key={rm.id} value={rm.name}>{rm.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" value={r.input_material || ''} onChange={e => onInputMaterialChange(idx, e.target.value)} style={inputStyle} />
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Input kg</label>
                    <input
                      type="number" min="0" step="1" inputMode="decimal"
                      value={r.input_kg}
                      onChange={e => updateRun(idx, { input_kg: e.target.value })}
                      placeholder="0"
                      style={{ ...inputStyle, textAlign: 'right' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Output Material</label>
                    {rawMaterials.length > 0 ? (
                      <select
                        value={r.output_material || ''}
                        onChange={e => onOutputMaterialChange(idx, e.target.value)}
                        style={inputStyle}
                      >
                        {!rawMaterials.some(rm => rm.name === r.output_material) && r.output_material && (
                          <option value={r.output_material}>{r.output_material}</option>
                        )}
                        {rawMaterials.map(rm => (
                          <option key={rm.id} value={rm.name}>{rm.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" value={r.output_material || ''} onChange={e => onOutputMaterialChange(idx, e.target.value)} style={inputStyle} />
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Output kg (saw dust)</label>
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
                  <label style={labelStyle}>Yield %</label>
                  <div style={{ height: 42, boxSizing: 'border-box', display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: 8, background: overYield ? '#fef2f2' : 'rgba(198, 246, 213, 0.2)', border: '1.5px solid ' + (overYield ? '#fca5a5' : '#b8d4c4'), fontSize: 13, fontWeight: 700, color: overYield ? '#b91c1c' : C.green }}>
                    {y.toFixed(1)}%
                  </div>
                  {overYield && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <AlertCircle size={13} color="#b91c1c" />
                      <span style={{ fontSize: 11, color: '#b91c1c' }}>Output exceeds input - please verify weights</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Log Eater hrs</label>
                    <input
                      type="number" min="0" step="0.5" inputMode="decimal"
                      value={r.log_eater_hours}
                      onChange={e => updateRun(idx, { log_eater_hours: e.target.value })}
                      placeholder="0"
                      style={{ ...inputStyle, textAlign: 'right' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Hammer Mill hrs</label>
                    <input
                      type="number" min="0" step="0.5" inputMode="decimal"
                      value={r.hammer_mill_hours}
                      onChange={e => updateRun(idx, { hammer_mill_hours: e.target.value })}
                      placeholder="0"
                      style={{ ...inputStyle, textAlign: 'right' }}
                    />
                  </div>
                </div>

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
            <div>Saw Dust produced: <strong>{Math.round(totalSawDust)} kg</strong></div>
            <div>Wood Log consumed: <strong>{Math.round(totalWoodLog)} kg</strong></div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Reflected in Raw Material stock (Step 3): saw dust added to Produced, wood log added to Used.</div>
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
