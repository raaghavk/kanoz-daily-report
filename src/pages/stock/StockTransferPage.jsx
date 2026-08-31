import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import { getLocalDate } from '../../lib/dateUtils'
import { kgToMtStr } from '../../lib/units'
import { balancesByPlot } from '../../lib/plotStock'
import { Loader2 } from 'lucide-react'

export default function StockTransferPage() {
  const { plant, employee } = useAuth()
    const [plots, setPlots] = useState([])
  const [materials, setMaterials] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    from_plot_id: '', to_plot_id: '', raw_material_type_id: '',
    quantity_mt: '', transfer_date: getLocalDate(), vehicle_number: '', notes: '',
  })

  async function load() {
    if (!plant?.id) return
    setLoading(true)
    try {
      const [plotsRes, matRes, purRes, trRes, usageRes] = await Promise.all([
        supabase.from('storage_plots').select('*').eq('plant_id', plant.id).eq('is_active', true).order('is_primary', { ascending: false }),
        supabase.from('raw_material_types').select('id, name, opening_stock_kg').eq('plant_id', plant.id).eq('is_active', true),
        supabase.from('raw_material_purchases').select('plot_id, raw_material_type_id, raw_material_type, quantity_kg').eq('plant_id', plant.id).eq('is_deleted', false),
        supabase.from('stock_transfers').select('*').eq('plant_id', plant.id).eq('is_deleted', false).order('transfer_date', { ascending: false }).limit(50),
        supabase.from('shift_reports').select('id').eq('plant_id', plant.id).eq('is_deleted', false),
      ])
      if (plotsRes.error) throw plotsRes.error
      setPlots(plotsRes.data || [])
      setMaterials(matRes.data || [])
      setTransfers(trRes.data || [])

      const shiftIds = (usageRes.data || []).map(r => r.id)
      let usageByMaterial = {}
      let producedByMaterial = {}
      if (shiftIds.length) {
        const [uRes, pRes] = await Promise.all([
          supabase.from('raw_material_usage').select('raw_material_type_id, quantity_kg').in('shift_report_id', shiftIds),
          supabase.from('processing_runs').select('output_material, output_kg').in('shift_report_id', shiftIds),
        ])
        for (const row of uRes.data || []) {
          usageByMaterial[row.raw_material_type_id] = (usageByMaterial[row.raw_material_type_id] || 0) + Number(row.quantity_kg || 0)
        }
        const byName = {}
        for (const m of matRes.data || []) byName[(m.name || '').toLowerCase()] = m.id
        for (const row of pRes.data || []) {
          const id = byName[(row.output_material || '').toLowerCase()]
          if (id) producedByMaterial[id] = (producedByMaterial[id] || 0) + Number(row.output_kg || 0)
        }
      }
      setBalances(balancesByPlot({
        plots: plotsRes.data || [],
        materials: matRes.data || [],
        purchases: purRes.data || [],
        transfers: trRes.data || [],
        usageByMaterial,
        producedByMaterial,
      }))
      const primary = (plotsRes.data || []).find(p => p.is_primary)
      const other = (plotsRes.data || []).find(p => !p.is_primary)
      setForm(f => ({
        ...f,
        from_plot_id: f.from_plot_id || other?.id || '',
        to_plot_id: f.to_plot_id || primary?.id || '',
        raw_material_type_id: f.raw_material_type_id || (matRes.data || [])[0]?.id || '',
      }))
    } catch (err) {
      showToast(err.message || 'Failed to load', 'error')
    } finally { setLoading(false) }
  }

  const [balances, setBalances] = useState([])
  useEffect(() => { load() }, [plant?.id]) // eslint-disable-line

  async function submit() {
    const qtyKg = (parseFloat(form.quantity_mt) || 0) * 1000
    if (!form.from_plot_id || !form.to_plot_id) { showToast('Pick from and to plots', 'error'); return }
    if (form.from_plot_id === form.to_plot_id) { showToast('Plots must be different', 'error'); return }
    if (!form.raw_material_type_id) { showToast('Pick a material', 'error'); return }
    if (qtyKg <= 0) { showToast('Enter quantity in MT', 'error'); return }
    setSaving(true)
    try {
      const mat = materials.find(m => m.id === form.raw_material_type_id)
      const { error } = await supabase.from('stock_transfers').insert({
        plant_id: plant.id,
        from_plot_id: form.from_plot_id,
        to_plot_id: form.to_plot_id,
        raw_material_type_id: form.raw_material_type_id,
        raw_material_name: mat?.name || null,
        quantity_kg: qtyKg,
        transfer_date: form.transfer_date,
        vehicle_number: form.vehicle_number.trim() || null,
        notes: form.notes.trim() || null,
        created_by: employee?.id || null,
      })
      if (error) throw error
      showToast('Transfer recorded', 'success')
      setForm(f => ({ ...f, quantity_mt: '', vehicle_number: '', notes: '' }))
      load()
    } catch (err) {
      showToast(err.message || 'Failed to save transfer', 'error')
    } finally { setSaving(false) }
  }

  const inp = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Stock transfer" subtitle="Move raw material between plots of this factory" backTo="/stock" />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          <>
            {balances.map(({ plot, rows }) => (
              <div key={plot.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: '#1b4332', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                  {plot.name}{plot.is_primary ? ' · factory' : ''}
                </div>
                {rows.length === 0 ? (
                  <div style={{ padding: 14, fontSize: 12, color: '#8a8d7a' }}>No stock on this plot yet</div>
                ) : rows.map((r, i) => (
                  <div key={r.materialId} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: i ? '1px solid #f0ebe0' : 'none' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1b4332' }}>{kgToMtStr(r.kg)} MT</span>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Record a transfer</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>From plot</label>
                  <select value={form.from_plot_id} onChange={e => setForm(f => ({ ...f, from_plot_id: e.target.value }))} style={inp}>
                    <option value="">Select</option>
                    {plots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>To plot</label>
                  <select value={form.to_plot_id} onChange={e => setForm(f => ({ ...f, to_plot_id: e.target.value }))} style={inp}>
                    <option value="">Select</option>
                    {plots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Material</label>
                <select value={form.raw_material_type_id} onChange={e => setForm(f => ({ ...f, raw_material_type_id: e.target.value }))} style={inp}>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Quantity (MT)</label>
                  <input type="number" step="0.01" value={form.quantity_mt} onChange={e => setForm(f => ({ ...f, quantity_mt: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Date</label>
                  <input type="date" value={form.transfer_date} onChange={e => setForm(f => ({ ...f, transfer_date: e.target.value }))} style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>Vehicle (optional)</label>
                <input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="UP70MT6151" style={inp} />
              </div>
              <button onClick={submit} disabled={saving} style={{ padding: '11px 0', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save transfer'}
              </button>
            </div>

            {transfers.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#8a8d7a' }}>RECENT TRANSFERS</div>
                {transfers.slice(0, 15).map((t) => {
                  const from = plots.find(p => p.id === t.from_plot_id)?.name || 'Plot'
                  const to = plots.find(p => p.id === t.to_plot_id)?.name || 'Plot'
                  return (
                    <div key={t.id} style={{ padding: '10px 14px', borderTop: '1px solid #f0ebe0', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: '#2c2c2c' }}>{t.raw_material_name || 'RM'} · {kgToMtStr(t.quantity_kg)} MT</div>
                      <div style={{ color: '#8a8d7a', marginTop: 2 }}>{t.transfer_date} · {from} → {to}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
