import { memo, useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default memo(function Step4RawMaterial({ data, updateData, plant }) {
  const [purchasesLoaded, setPurchasesLoaded] = useState(false)

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
          const shiftStart = new Date(`${data.shift_start_date}T${data.start_time}:00`)
          const shiftEnd = new Date(`${data.shift_end_date || data.shift_start_date}T${data.end_time}:00`)
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

      {data.rawMaterials.map((rm, idx) => (
        <div key={rm.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#2c2c2c' }}>{rm.name}</div>
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
      ))}
    </div>
  )
})
