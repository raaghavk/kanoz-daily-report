import { memo, useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default memo(function Step4RawMaterial({ data, updateData, plant }) {
  const [purchasesLoaded, setPurchasesLoaded] = useState(false)
  // Track which RM cards are expanded; default all collapsed
  const [expandedIds, setExpandedIds] = useState(new Set())

  function toggleCollapse(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Auto-load purchased quantities from raw_material_purchases
  useEffect(() => {
    if (!plant?.id || !data.shift_start_date || purchasesLoaded) return

    async function loadPurchases() {
      try {
        const { data: purchases } = await supabase
          .from('raw_material_purchases')
          .select('raw_material_type_id, quantity_kg, purchase_time')
          .eq('plant_id', plant.id)
          .eq('is_deleted', false)
          .gte('date', data.shift_start_date)
          .lte('date', data.shift_end_date || data.shift_start_date)

        if (!purchases || purchases.length === 0) {
          setPurchasesLoaded(true)
          return
        }

        // Client-side time filtering if shift times are available
        let filtered = purchases
        if (data.start_time && data.end_time && data.shift_start_date) {
          // Normalize time to HH:MM — DB returns HH:MM:SS, input returns HH:MM
          const normalizeTime = (t) => t ? t.substring(0, 5) : t
          const shiftStart = new Date(`${data.shift_start_date}T${normalizeTime(data.start_time)}:00`)
          const shiftEnd = new Date(`${data.shift_end_date || data.shift_start_date}T${normalizeTime(data.end_time)}:00`)
          filtered = purchases.filter(p => {
            if (!p.purchase_time) return true // include purchases without time
            const pDate = data.shift_start_date
            const pDt = new Date(`${pDate}T${p.purchase_time}`)
            return pDt >= shiftStart && pDt <= shiftEnd
          })
        }

        // Group by raw_material_type_id
        const purchasedByType = {}
        filtered.forEach(p => {
          const typeId = p.raw_material_type_id
          purchasedByType[typeId] = (purchasedByType[typeId] || 0) + (parseFloat(p.quantity_kg) || 0)
        })

        // Update rawMaterials
        const updated = data.rawMaterials.map(rm => {
          const purchased = Math.round(purchasedByType[rm.id] || 0)
          return { ...rm, purchased, closing: rm.opening + purchased - rm.used }
        })
        updateData('rawMaterials', updated)
        setPurchasesLoaded(true)
      } catch (err) {
        console.error('Error loading purchases for shift:', err)
        setPurchasesLoaded(true)
      }
    }

    loadPurchases()
  }, [plant?.id, data.shift_start_date, data.shift_end_date, purchasesLoaded, data, updateData])

  function updateRM(idx, field, value) {
    const mats = [...data.rawMaterials]
    mats[idx] = { ...mats[idx], [field]: parseFloat(value) || 0 }
    // Auto-calculate closing
    mats[idx].closing = mats[idx].opening + mats[idx].purchased - mats[idx].used
    updateData('rawMaterials', mats)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 12, color: '#595c4a' }}>Opening stock auto-carries from previous shift. Purchased auto-fills from Purchase app.</p>

      {data.rawMaterials.map((rm, idx) => {
        const isExpanded = expandedIds.has(rm.id)
        return (
          <div key={rm.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            {/* Card Header — always visible */}
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px',
                borderBottom: isExpanded ? '1.5px solid #e5ddd0' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', margin: 0 }}>{rm.name}</h4>
                {/* Show closing stock badge when collapsed */}
                {!isExpanded && (
                  <div style={{ background: '#e8f0ec', color: '#2d6a4f', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>
                    {rm.closing ?? 0} kg
                  </div>
                )}
              </div>
              <button
                onClick={() => toggleCollapse(rm.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#595c4a', padding: 0 }}
              >
                <ChevronDown
                  size={20}
                  style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
                />
              </button>
            </div>

            {/* Expanded Fields */}
            {isExpanded && (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8a8d7a', marginBottom: 4, textAlign: 'center' }}>OPENING</label>
                    <div style={{ height: 38, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: '#fefae0', border: '1px solid #e5ddd0', fontSize: 12, fontWeight: 500 }}>
                      {rm.opening}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8a8d7a', marginBottom: 4, textAlign: 'center' }}>PURCHASED</label>
                    <div style={{ height: 38, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: '#fefae0', border: '1px solid #e5ddd0', fontSize: 12, fontWeight: 500 }}>
                      {rm.purchased}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8a8d7a', marginBottom: 4, textAlign: 'center' }}>USED</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={rm.used || ''}
                      onChange={e => updateRM(idx, 'used', e.target.value)}
                      placeholder="0"
                      style={{ width: '100%', height: 38, padding: '8px 4px', borderRadius: 8, border: '1px solid #e5ddd0', fontSize: 12, outline: 'none', textAlign: 'center', boxSizing: 'border-box', MozAppearance: 'textfield', WebkitAppearance: 'none', appearance: 'textfield' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#2d6a4f', marginBottom: 4, textAlign: 'center' }}>CLOSING</label>
                    <div style={{ height: 38, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: '#e8f0ec', border: '1px solid #b8d4c4', fontSize: 12, fontWeight: 700, color: '#2d6a4f' }}>
                      {rm.closing}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})
