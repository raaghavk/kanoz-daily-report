import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import { Plus, Edit3, Check, X, ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react'

// Configurable assembly lines: input material -> [ordered machines] -> output material.
// Plant-scoped. Writes process_routes + process_route_stages (delete+reinsert stages on edit).
export default function ProcessRoutes({ plantId, orgId }) {
  const [routes, setRoutes] = useState([])
  const [materials, setMaterials] = useState([]) // raw_material_types for this plant
  const [machines, setMachines] = useState([]) // machines for this plant
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)

  // Editing state — null when not editing. { id } present when editing existing route.
  const [form, setForm] = useState(null)
  // form: { id?, name, inputId, outputId, yield, stages: [{ machine_id, machine_name }] }
  const [addMachineId, setAddMachineId] = useState('')

  async function loadAll() {
    if (!plantId) return
    const [routesRes, matRes, machRes] = await Promise.all([
      supabase.from('process_routes').select('*').eq('plant_id', plantId).order('created_at'),
      supabase.from('raw_material_types').select('id, name, is_active').eq('plant_id', plantId).order('name'),
      supabase.from('machines').select('id, name, is_active, sort_order').eq('plant_id', plantId).order('sort_order'),
    ])
    const routeList = routesRes.data || []
    const routeIds = routeList.map(r => r.id)
    let stagesByRoute = {}
    if (routeIds.length) {
      const { data: stages } = await supabase
        .from('process_route_stages')
        .select('*')
        .in('route_id', routeIds)
        .order('seq')
      for (const s of stages || []) {
        if (!stagesByRoute[s.route_id]) stagesByRoute[s.route_id] = []
        stagesByRoute[s.route_id].push(s)
      }
    }
    setRoutes(routeList.map(r => ({ ...r, stages: stagesByRoute[r.id] || [] })))
    setMaterials(matRes.data || [])
    setMachines(machRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    void loadAll() // eslint-disable-line react-hooks/set-state-in-effect -- network fetch; setState runs after await
  }, [plantId]) // eslint-disable-line react-hooks/exhaustive-deps

  function startAdd() {
    setForm({ name: '', inputId: '', outputId: '', yield: '', stages: [] })
    setAddMachineId('')
  }

  function startEdit(route) {
    setForm({
      id: route.id,
      name: route.name || '',
      inputId: route.input_material_type_id || '',
      outputId: route.output_material_type_id || '',
      yield: route.expected_yield_pct ?? '',
      stages: (route.stages || []).map(s => ({ machine_id: s.machine_id, machine_name: s.machine_name })),
    })
    setAddMachineId('')
  }

  function addStage() {
    if (!addMachineId) return
    const m = machines.find(x => x.id === addMachineId)
    if (!m) return
    setForm(f => ({ ...f, stages: [...f.stages, { machine_id: m.id, machine_name: m.name }] }))
    setAddMachineId('')
  }

  function moveStage(idx, dir) {
    setForm(f => {
      const arr = [...f.stages]
      const j = idx + dir
      if (j < 0 || j >= arr.length) return f
      ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
      return { ...f, stages: arr }
    })
  }

  function removeStage(idx) {
    setForm(f => ({ ...f, stages: f.stages.filter((_, i) => i !== idx) }))
  }

  async function saveRoute() {
    if (!form.name.trim()) { showToast('Route name is required', 'error'); return }
    if (busy) return
    setBusy(true)
    const inMat = materials.find(m => m.id === form.inputId)
    const outMat = materials.find(m => m.id === form.outputId)
    const y = parseFloat(form.yield)
    const routePayload = {
      plant_id: plantId,
      org_id: orgId,
      name: form.name.trim(),
      input_material_type_id: form.inputId || null,
      input_material_name: inMat?.name || null,
      output_material_type_id: form.outputId || null,
      output_material_name: outMat?.name || null,
      expected_yield_pct: Number.isNaN(y) ? null : y,
    }
    let routeId = form.id
    if (routeId) {
      const { error } = await supabase.from('process_routes').update(routePayload).eq('id', routeId)
      if (error) { setBusy(false); showToast('Failed to save route: ' + error.message, 'error'); return }
      // delete + reinsert stages
      await supabase.from('process_route_stages').delete().eq('route_id', routeId)
    } else {
      const { data: created, error } = await supabase.from('process_routes').insert(routePayload).select().single()
      if (error || !created) { setBusy(false); showToast('Failed to create route: ' + (error?.message || ''), 'error'); return }
      routeId = created.id
    }
    if (form.stages.length) {
      const stageRows = form.stages.map((s, i) => ({ route_id: routeId, seq: i + 1, machine_id: s.machine_id, machine_name: s.machine_name }))
      const { error: sErr } = await supabase.from('process_route_stages').insert(stageRows)
      if (sErr) { setBusy(false); showToast('Route saved but stages failed: ' + sErr.message, 'error'); return }
    }
    setBusy(false)
    showToast(form.id ? 'Route updated' : 'Route added', 'success')
    setForm(null)
    loadAll()
  }

  async function toggleActive(route) {
    const { error } = await supabase.from('process_routes').update({ is_active: !(route.is_active !== false) }).eq('id', route.id)
    if (error) { showToast('Failed to update', 'error'); return }
    showToast(route.is_active !== false ? 'Deactivated' : 'Activated', 'success')
    loadAll()
  }

  const inputBase = { padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', minWidth: 0, boxSizing: 'border-box', background: '#fefae0' }

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>Process Routes</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a', background: '#fefae0', padding: '2px 8px', borderRadius: 6 }}>
            {routes.filter(r => r.is_active !== false).length}
          </span>
        </div>
        {expanded ? <ChevronUp size={18} color="#8a8d7a" /> : <ChevronDown size={18} color="#8a8d7a" />}
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #f0ebe0' }}>
          <div style={{ padding: '8px 16px 4px', fontSize: 11, color: '#8a8d7a' }}>
            {'Assembly lines: input material -> ordered machines -> output material.'}
          </div>

          {loading ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#595c4a', fontSize: 13 }}>Loading...</div>
          ) : (
            routes.map(route => (
              <div key={route.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f5f0e1', opacity: route.is_active === false ? 0.5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2c' }}>{route.name}</div>
                    <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>
                      {route.input_material_name || '—'}
                      {' -> ['}
                      {(route.stages || []).map(s => s.machine_name).join(' -> ') || 'no machines'}
                      {'] -> '}
                      {route.output_material_name || '—'}
                      {route.expected_yield_pct != null ? ` (${route.expected_yield_pct}% yield)` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => startEdit(route)}
                    style={{ padding: '4px 8px', background: '#fefae0', borderRadius: 6, border: '1px solid #e5ddd0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <Edit3 size={12} color="#595c4a" />
                  </button>
                  <button
                    onClick={() => toggleActive(route)}
                    style={{ padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600, background: route.is_active !== false ? '#DCFCE7' : '#FEE2E2', color: route.is_active !== false ? '#15803D' : '#DC2626' }}
                  >
                    {route.is_active !== false ? 'Active' : 'Enable'}
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Add / Edit form */}
          {form ? (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, background: '#fefae0' }}>
              <input
                type="text"
                placeholder="Route name (e.g. Wood -> Saw Dust)"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
                style={{ ...inputBase, border: '1.5px solid #2d6a4f', background: '#fff' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={form.inputId} onChange={e => setForm(f => ({ ...f, inputId: e.target.value }))} style={{ ...inputBase, flex: 1 }}>
                  <option value="">Input material...</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select value={form.outputId} onChange={e => setForm(f => ({ ...f, outputId: e.target.value }))} style={{ ...inputBase, flex: 1 }}>
                  <option value="">Output material...</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Expected yield %"
                  value={form.yield}
                  onChange={e => setForm(f => ({ ...f, yield: e.target.value }))}
                  style={{ ...inputBase, width: 140 }}
                />
                <span style={{ fontSize: 11, color: '#8a8d7a' }}>% (output / input)</span>
              </div>

              {/* Ordered machine stages */}
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginTop: 2 }}>Machines (in order)</div>
              {form.stages.length === 0 && (
                <div style={{ fontSize: 12, color: '#8a8d7a', fontStyle: 'italic' }}>No machines yet — add stages below.</div>
              )}
              {form.stages.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e5ddd0', borderRadius: 8, padding: '6px 10px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#2d6a4f', minWidth: 18 }}>{idx + 1}.</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#2c2c2c' }}>{s.machine_name}</span>
                  {idx < form.stages.length - 1 && <ArrowRight size={12} color="#8a8d7a" />}
                  <button onClick={() => moveStage(idx, -1)} disabled={idx === 0} style={{ padding: 4, background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}><ArrowUp size={14} color="#595c4a" /></button>
                  <button onClick={() => moveStage(idx, 1)} disabled={idx === form.stages.length - 1} style={{ padding: 4, background: 'none', border: 'none', cursor: idx === form.stages.length - 1 ? 'default' : 'pointer', opacity: idx === form.stages.length - 1 ? 0.3 : 1 }}><ArrowDown size={14} color="#595c4a" /></button>
                  <button onClick={() => removeStage(idx)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14} color="#d32f2f" /></button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={addMachineId} onChange={e => setAddMachineId(e.target.value)} style={{ ...inputBase, flex: 1, background: '#fff' }}>
                  <option value="">Add machine stage...</option>
                  {machines.filter(m => m.is_active !== false).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <button onClick={addStage} disabled={!addMachineId} style={{ padding: '8px 12px', background: '#2d6a4f', color: 'white', borderRadius: 8, border: 'none', cursor: addMachineId ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600, opacity: addMachineId ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={13} /> Add</button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={saveRoute} disabled={busy} style={{ flex: 1, padding: '9px 0', background: '#2d6a4f', color: 'white', borderRadius: 8, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: busy ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Check size={15} /> Save Route</button>
                <button onClick={() => setForm(null)} style={{ padding: '9px 16px', background: '#fefae0', color: '#595c4a', borderRadius: 8, border: '1px solid #e5ddd0', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}><X size={15} /> Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={startAdd}
              style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#fefae0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2d6a4f' }}
            >
              <Plus size={14} /> Add Process Route
            </button>
          )}
        </div>
      )}
    </div>
  )
}
