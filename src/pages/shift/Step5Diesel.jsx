import { memo, useEffect, useState, useRef } from 'react'
import { ChevronDown, ChevronUp, Plus, X, Camera, Sparkles } from 'lucide-react'
import PhotoUpload from '../../components/PhotoUpload'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import { equipCode } from '../../lib/units'

// Helper: format number for display, strip leading zeros, allow empty
function numVal(v) {
  if (v === '' || v === null || v === undefined) return ''
  const n = parseFloat(v)
  return isNaN(n) ? '' : n
}

export default memo(function Step5Diesel({ data, updateData, plant }) {
  const [scanningIdx, setScanningIdx] = useState(null)
  const [collapsedCats, setCollapsedCats] = useState({})

  // Initialize diesel_stock if not exists (via useEffect, not during render)
  useEffect(() => {
    if (!data.diesel_stock) {
      updateData('diesel_stock', { opening: 0, purchases: [], closing: 0 })
    } else if (!data.diesel_stock.purchases) {
      updateData('diesel_stock', { ...data.diesel_stock, purchases: [] })
    }
  }, [data.diesel_stock, updateData])

  // Later reports: each equipment's opening = its CLOSING in the shift immediately
  // before this one (matched by equipment name). Finds the latest non-deleted report
  // starting strictly before this shift's start, so it's correct in-order, out-of-order,
  // and on edit. No earlier report => first report: leave openings (seeded from the
  // equipment's settings tank opening elsewhere). Recomputes when the shift window changes.
  const prevDieselWindowRef = useRef(null)
  useEffect(() => {
    if (!plant?.id || !data.shift_start_date || !(data.diesel || []).length) return
    const winKey = `${data.shift_start_date}|${data.start_time || ''}`
    if (prevDieselWindowRef.current === winKey) return
    let cancelled = false
    ;(async () => {
      const thisStart = new Date(`${data.shift_start_date}T${(data.start_time || '00:00').substring(0, 5)}:00`)
      const { data: reps } = await supabase
        .from('shift_reports')
        .select('id, shift_start_date, start_time')
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
        .lte('shift_start_date', data.shift_start_date)
        .order('shift_start_date', { ascending: false })
        .order('start_time', { ascending: false })
      if (cancelled) return
      const prev = (reps || []).find(r => {
        const rs = new Date(`${r.shift_start_date}T${(r.start_time || '00:00:00').substring(0, 8)}`)
        return rs < thisStart
      })
      if (!prev) { prevDieselWindowRef.current = winKey; return } // first report
      const { data: prevLog } = await supabase
        .from('equipment_diesel_log')
        .select('equipment_id, equipment_name, closing_litres')
        .eq('shift_report_id', prev.id)
      if (cancelled) return
      prevDieselWindowRef.current = winKey
      const norm = (x) => (x || '').toString().trim().toLowerCase()
      const closeById = {}, closeByName = {}
      for (const d of (prevLog || [])) {
        const c = parseFloat(d.closing_litres) || 0
        if (d.equipment_id) closeById[d.equipment_id] = c
        else closeByName[norm(d.equipment_name)] = c
      }
      let changed = false
      const diesel = (data.diesel || []).map(eq => {
        // Prefer a stable equipment_id match; fall back to name for older rows.
        const hasId = eq.id != null && eq.id in closeById
        const nameKey = norm(eq.equipment_name)
        if (!hasId && !(nameKey in closeByName)) return eq
        const nextOpen = hasId ? closeById[eq.id] : closeByName[nameKey]
        if ((parseFloat(eq.opening) || 0) === nextOpen) return eq
        changed = true
        // Preserve what the user entered for `used`; closing follows from the chain.
        // An untouched row (used 0) becomes closing = opening (0 consumed), never
        // "all used".
        const added = parseFloat(eq.added) || 0
        const used = parseFloat(eq.used) || 0
        return { ...eq, opening: nextOpen, closing: nextOpen + added - used }
      })
      if (!cancelled && changed) updateData('diesel', diesel)
    })()
    return () => { cancelled = true }
  }, [plant?.id, data.shift_start_date, data.start_time, (data.diesel || []).length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function scanDieselReceipt(idx, receiptUrl) {
    if (!receiptUrl) return
    try {
      setScanningIdx(idx)
      const { data: result, error } = await supabase.functions.invoke('extract-receipt', {
        body: { imageUrl: receiptUrl, type: 'diesel_receipt' }
      })

      if (error) {
        showToast('Could not extract data from receipt', 'error')
        return
      }

      if (result?.success) {
        if (result.data?.litres || result.data?.cost_per_litre || result.data?.time) {
          const stock = { ...data.diesel_stock }
          const purchases = [...(stock.purchases || [])]
          if (result.data?.litres) {
            purchases[idx] = { ...purchases[idx], litres: result.data.litres }
          }
          if (result.data?.cost_per_litre) {
            purchases[idx] = { ...purchases[idx], cost_per_litre: result.data.cost_per_litre }
          }
          if (result.data?.time) {
            purchases[idx] = { ...purchases[idx], purchase_time: result.data.time }
          }
          stock.purchases = purchases
          // Recalculate totals
          const tp = purchases.reduce((sum, p) => sum + (parseFloat(p.litres) || 0), 0)
          stock.purchased = tp
          const totalUsed = (data.diesel || []).reduce((sum, eq) => sum + (parseFloat(eq.used) || 0), 0)
          stock.closing = (parseFloat(stock.opening) || 0) + tp - totalUsed
          updateData('diesel_stock', stock)
          showToast('Fields auto-filled from receipt', 'success')
        }
      } else {
        showToast('Could not extract data from receipt', 'error')
      }
    } catch (err) {
      console.error('Error scanning receipt:', err)
      showToast('Could not extract data from receipt', 'error')
    } finally {
      setScanningIdx(null)
    }
  }

  // Equipment list is loaded from Supabase in ShiftWizard
  if (!data.diesel || data.diesel.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#595c4a' }}>Loading equipment...</div>
  }

  // Calculate totals from purchases
  const purchases = data.diesel_stock.purchases || []
  const totalPurchased = purchases.reduce((sum, p) => sum + (parseFloat(p.litres) || 0), 0)
  const totalCost = purchases.reduce((sum, p) => {
    const l = parseFloat(p.litres) || 0
    const c = parseFloat(p.cost_per_litre) || 0
    return sum + (l * c)
  }, 0)

  // Calculate total added to equipment (this is what's issued from stock tank)
  const totalAddedToEquipment = (data.diesel || []).reduce((sum, eq) => sum + (parseFloat(eq.added) || 0), 0)

  // Closing stock: opening + purchased - issued to equipment
  const opening = parseFloat(data.diesel_stock?.opening) || 0
  const closingStock = opening + totalPurchased - totalAddedToEquipment

  function addPurchase() {
    const stock = { ...data.diesel_stock }
    stock.purchases = [...(stock.purchases || []), { litres: '', cost_per_litre: '', purchase_time: '', receipt_url: null }]
    updateData('diesel_stock', stock)
  }

  function updatePurchase(idx, field, value) {
    const stock = { ...data.diesel_stock }
    const purchases = [...(stock.purchases || [])]
    purchases[idx] = { ...purchases[idx], [field]: value }
    stock.purchases = purchases
    // Recalculate total purchased and closing
    const tp = purchases.reduce((sum, p) => sum + (parseFloat(p.litres) || 0), 0)
    stock.purchased = tp
    stock.closing = (parseFloat(stock.opening) || 0) + tp - totalAddedToEquipment
    updateData('diesel_stock', stock)
  }

  function removePurchase(idx) {
    const stock = { ...data.diesel_stock }
    stock.purchases = (stock.purchases || []).filter((_, i) => i !== idx)
    const tp = stock.purchases.reduce((sum, p) => sum + (parseFloat(p.litres) || 0), 0)
    stock.purchased = tp
    stock.closing = (parseFloat(stock.opening) || 0) + tp - totalAddedToEquipment
    updateData('diesel_stock', stock)
  }

  function updateEntry(idx, field, value) {
    const entries = [...data.diesel]
    // Store raw string so user can clear the field; parse for calculations
    entries[idx] = { ...entries[idx], [field]: value }
    const num = (f) => parseFloat(entries[idx][f]) || 0

    // Auto-calculate closing: opening + added - used
    if (field === 'opening' || field === 'added' || field === 'used') {
      entries[idx].closing = num('opening') + num('added') - num('used')
    }

    // Auto-calculate avg_per_hr
    if (field === 'used' || field === 'hours') {
      entries[idx].avg_per_hr = num('hours') > 0 ? num('used') / num('hours') : 0
    }

    updateData('diesel', entries)

    // Recalculate closing stock (total added to equipment may have changed)
    if (field === 'added') {
      const newTotalAddedToEquipment = entries.reduce((sum, eq) => sum + (parseFloat(eq.added) || 0), 0)
      const stock = { ...data.diesel_stock }
      const tp = (stock.purchases || []).reduce((sum, p) => sum + (parseFloat(p.litres) || 0), 0)
      stock.closing = (parseFloat(stock.opening) || 0) + tp - newTotalAddedToEquipment
      updateData('diesel_stock', stock)
    }
  }

  function toggleCollapse(idx) {
    const entries = [...data.diesel]
    entries[idx] = { ...entries[idx], collapsed: !entries[idx].collapsed }
    updateData('diesel', entries)
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', background: '#fff'
  }
  const readOnlyStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #e5ddd0', fontSize: 12, background: '#fefae0',
    color: '#2c2c2c', fontWeight: 600
  }
  const labelStyle = { display: 'block', fontSize: 10, fontWeight: 600, color: '#595c4a', marginBottom: 6 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Diesel Stock Summary Card */}
      <div style={{
        background: '#fefae0', borderRadius: 14, border: '1.5px solid #e9c46a', padding: 16
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#d4a373', margin: 0 }}>DIESEL STOCK</h3>
          <div style={{ background: '#d4a373', color: '#fff', fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: 4 }}>
            Tank
          </div>
        </div>

        {/* Big Numbers Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 10, color: '#595c4a', fontWeight: 600, marginBottom: 4 }}>Open L</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2c2c2c' }}>{opening}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 10, color: '#595c4a', fontWeight: 600, marginBottom: 4 }}>+Purch L</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2d6a4f' }}>{totalPurchased}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 10, color: '#595c4a', fontWeight: 600, marginBottom: 4 }}>-Used L</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#d32f2f' }}>{totalAddedToEquipment}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 10, color: '#595c4a', fontWeight: 600, marginBottom: 4 }}>Close L</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#d4a373' }}>{closingStock}</div>
          </div>
        </div>

        {totalCost > 0 && (
          <div style={{ textAlign: 'center', padding: '6px 0', background: '#FEF3C7', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#92400E' }}>
            Total Purchase Cost: ₹{totalCost.toLocaleString('en-IN')}
          </div>
        )}
      </div>

      {/* Diesel Purchases Section */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', margin: 0 }}>Diesel Purchases</h3>
          <button
            onClick={addPurchase}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              background: '#e8f0ec', color: '#2d6a4f', border: 'none', borderRadius: 8,
              fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {purchases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#999', fontSize: 12 }}>
            No diesel purchased this shift. Tap "Add" to log a purchase.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {purchases.map((p, idx) => (
              <div key={idx} style={{
                background: '#FAFAFA', borderRadius: 10, border: '1px solid #E8E8E8', padding: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#595c4a' }}>Purchase #{idx + 1}</span>
                  <button onClick={() => removePurchase(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                    <X size={16} color="#d32f2f" />
                  </button>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>Time of Purchase</label>
                  <input
                    type="time"
                    value={p.purchase_time || ''}
                    onChange={e => updatePurchase(idx, 'purchase_time', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={labelStyle}>Litres</label>
                    <input
                      type="number" inputMode="decimal" step="any"
                      value={numVal(p.litres)}
                      onChange={e => updatePurchase(idx, 'litres', e.target.value)}
                      placeholder="0"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Cost per Litre (₹)</label>
                    <input
                      type="number" inputMode="decimal" step="any"
                      value={numVal(p.cost_per_litre)}
                      onChange={e => updatePurchase(idx, 'cost_per_litre', e.target.value)}
                      placeholder="0"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>Total Cost (₹)</label>
                  <div style={readOnlyStyle}>
                    ₹{((parseFloat(p.litres) || 0) * (parseFloat(p.cost_per_litre) || 0)).toLocaleString('en-IN')}
                  </div>
                </div>
                <PhotoUpload
                  label="Receipt Photo"
                  value={p.receipt_url}
                  onChange={url => { updatePurchase(idx, 'receipt_url', url); if (url) scanDieselReceipt(idx, url) }}
                  bucket="photos"
                />
                {p.receipt_url && (
                  <button
                    type="button"
                    onClick={() => scanDieselReceipt(idx, p.receipt_url)}
                    disabled={scanningIdx === idx}
                    style={{
                      marginTop: 12,
                      width: '100%',
                      padding: '12px 16px',
                      background: '#FEF3C7',
                      color: '#92400E',
                      border: '1.5px solid #F59E0B',
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: scanningIdx === idx ? 'not-allowed' : 'pointer',
                      opacity: scanningIdx === idx ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Sparkles size={16} />
                    {scanningIdx === idx ? 'Scanning...' : '✨ Auto-fill from Receipt'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Equipment — collapsible category groups (alphabetical, collapsed by default) */}
      {(() => {
        const groups = {}
        data.diesel.forEach((entry, idx) => {
          const key = (entry.equipment_type && String(entry.equipment_type).trim()) || 'Other'
          if (!groups[key]) groups[key] = []
          groups[key].push({ entry, idx })
        })
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([type, items]) => {
          const catCollapsed = collapsedCats[type] ?? true
          return (
          <div key={type} style={{ background: '#fefae0', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            <button type="button" aria-expanded={!catCollapsed} onClick={() => setCollapsedCats(prev => ({ ...prev, [type]: !(prev[type] ?? true) }))} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#2c2c2c' }}>{type}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#8a8d7a' }}>&middot; {items.length}</span>
              </div>
              {catCollapsed ? <ChevronDown size={18} color="#2d6a4f" /> : <ChevronUp size={18} color="#2d6a4f" />}
            </button>
            {!catCollapsed && (
              <div style={{ borderTop: '1px solid #f0ebe0', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map(({ entry, idx }) => (
        <div key={entry.id} style={{
          background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden'
        }}>
          {/* Equipment Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px',
            borderBottom: entry.collapsed ? 'none' : '1.5px solid #e5ddd0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', margin: 0 }}>{entry.equipment_name}{equipCode(entry.identifier) ? ` · ${equipCode(entry.identifier)}` : ''}</h4>
                {(entry.owner || entry.company) && <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 1 }}>{[entry.owner, entry.company].filter(Boolean).join(' · ')}</div>}
              </div>
            </div>
            <button onClick={() => toggleCollapse(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#595c4a', padding: 0 }}>
              <ChevronDown size={20} style={{ transform: entry.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>
          </div>

          {!entry.collapsed && (
            <div style={{ padding: 16 }}>
              {/* Row 1: Opening | Added */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>OPENING (L)</label>
                  <div style={readOnlyStyle}>{entry.opening || 0}</div>
                </div>
                <div>
                  <label style={labelStyle}>ADDED (L)</label>
                  <input type="number" inputMode="decimal" step="any"
                    value={numVal(entry.added)} onChange={e => updateEntry(idx, 'added', e.target.value)}
                    placeholder="0" style={inputStyle} />
                </div>
              </div>
              {/* Row 2: Used | Closing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>USED (L)</label>
                  <input type="number" inputMode="decimal" step="any"
                    value={numVal(entry.used)} onChange={e => updateEntry(idx, 'used', e.target.value)}
                    placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>CLOSING (L)</label>
                  <div style={readOnlyStyle}>{entry.closing || 0}</div>
                </div>
              </div>
              {/* Row 3: Hrs Worked | Avg L/Hr */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>HRS WORKED</label>
                  <input type="number" inputMode="decimal" step="any"
                    value={numVal(entry.hours)} onChange={e => updateEntry(idx, 'hours', e.target.value)}
                    placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>AVG L/HR</label>
                  <div style={readOnlyStyle}>{entry.avg_per_hr ? entry.avg_per_hr.toFixed(2) : '0.00'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
            ))}
              </div>
            )}
          </div>
          )
        })
      })()}
    </div>
  )
})
