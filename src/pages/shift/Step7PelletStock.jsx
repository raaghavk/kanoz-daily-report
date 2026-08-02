import { useEffect, memo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import { averagePellets, ensurePelletType, gradeForGcv } from '../../lib/pelletGrading'

// Semantic match: exact / case-insensitive names, plus legacy "Non-Sample" vs
// "N Sample" variants so pre-existing pellet types keep working unchanged.
function normPellet(s) {
  return (s || '').toLowerCase().replace(/[\s\-_]/g, '')
}
function isNonSampleVariant(s) {
  const n = normPellet(s)
  return n.includes('non') || (n.startsWith('n') && n.includes('sample'))
}
function pelletTypeMatches(mixType, pelletName) {
  if (!mixType || !pelletName) return false
  if (mixType === pelletName) return true
  if (normPellet(mixType) === normPellet(pelletName)) return true
  if (isNonSampleVariant(mixType) && isNonSampleVariant(pelletName)) return true
  return false
}

// Derived pellet name a mix contributes under (older drafts fall back to mix.type)
function mixPelletName(mix) {
  return mix?.derived_pellet_name || mix?.type || null
}

// Pellet name for one production entry: the mix contributing the most kg wins.
// Falls back to the shift's single mix name when mix_usages aren't set.
function entryPelletName(entry, mixes) {
  const kgByName = {}
  ;(entry.mix_usages || []).forEach(mu => {
    const name = mixPelletName(mixes.find(m => m.local_id === mu.mix_local_id))
    if (!name) return
    kgByName[name] = (kgByName[name] || 0) + (parseFloat(mu.quantity_kg) || 0)
  })
  const names = Object.keys(kgByName)
  if (names.length > 0) {
    return names.reduce((a, b) => (kgByName[b] > kgByName[a] ? b : a))
  }
  const allNames = [...new Set(mixes.map(mixPelletName).filter(Boolean))]
  return allNames.length === 1 ? allNames[0] : null
}

export default memo(function Step7PelletStock({ data, updateData, plant }) {
  // Resolve this shift's derived pellet names to real pellet_types rows.
  // Production is grouped by derived pellet name; per name the GCV is the
  // kg-weighted average over contributing mix usages (averagePellets). Names
  // without a matching stock row get one created via ensurePelletType — legacy
  // rows (e.g. Sample / N Sample) are kept as-is, never deleted or migrated.
  const resolvedKeyRef = useRef(null)

  // First (transition) report only: pull each pellet's opening from its settings
  // opening_stock_mt, so a pellet opening set after the report was created still shows.
  useEffect(() => {
    let cancelled = false
    if (!plant?.id || !(data.pelletStock || []).length) return
    ;(async () => {
      const { count } = await supabase
        .from('shift_reports')
        .select('id', { count: 'exact', head: true })
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
      if (cancelled || (count || 0) !== 0) return
      const { data: types } = await supabase
        .from('pellet_types')
        .select('id, name, opening_stock_mt')
        .eq('plant_id', plant.id)
      if (cancelled || !types) return
      const norm = (x) => (x || '').toString().trim().toLowerCase()
      const byId = {}, byName = {}
      for (const t of types) { const v = parseFloat(t.opening_stock_mt) || 0; byId[t.id] = v; byName[norm(t.name)] = v }
      let changed = false
      const stock = (data.pelletStock || []).map(ps => {
        const nextOpen = (byId[ps.id] != null) ? byId[ps.id] : (byName[norm(ps.name)] || 0)
        if ((parseFloat(ps.opening) || 0) !== nextOpen) {
          changed = true
          return { ...ps, opening: nextOpen, closing: nextOpen + (ps.production || 0) - (ps.dispatch || 0) - (ps.wastage || 0) }
        }
        return ps
      })
      if (changed) updateData('pelletStock', stock)
    })()
    return () => { cancelled = true }
  }, [plant?.id, (data.pelletStock || []).length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!plant?.id) return
    const mixes = data.mixes || []

    // Group mix-usage contributions by derived pellet name
    const contributions = {}
    ;(data.production || []).forEach(p => {
      const owner = entryPelletName(p, mixes)
      ;(p.mix_usages || []).forEach(mu => {
        const mix = mixes.find(m => m.local_id === mu.mix_local_id)
        const name = mixPelletName(mix)
        if (!name) return
        if (!contributions[name]) contributions[name] = []
        contributions[name].push({ name, gcv: mix?.derived_gcv ?? null, kg: parseFloat(mu.quantity_kg) || 0 })
      })
      // No usages recorded: attribute to the entry's fallback name so the row still exists
      if ((p.mix_usages || []).length === 0 && owner) {
        const mix = mixes.find(m => mixPelletName(m) === owner)
        if (!contributions[owner]) contributions[owner] = []
        contributions[owner].push({ name: owner, gcv: mix?.derived_gcv ?? null, kg: parseFloat(p.quantity) || 0 })
      }
    })

    const groups = Object.keys(contributions).map(name => {
      const avg = averagePellets(contributions[name])
      return { name, gcv: avg?.gcv ?? null }
    })
    if (groups.length === 0) return

    const key = JSON.stringify(groups.map(g => [g.name, g.gcv == null ? null : Math.round(g.gcv)]).sort())
    if (resolvedKeyRef.current === key) return
    resolvedKeyRef.current = key

    let cancelled = false
    ;(async () => {
      const threshold = plant?.gcv_grade_threshold ?? 3200
      const newRows = []
      let failed = 0
      for (const g of groups) {
        const pt = await ensurePelletType(supabase, plant.id, {
          name: g.name,
          gcv: g.gcv,
          grade: gradeForGcv(g.gcv, threshold),
        })
        if (!pt) { failed++; continue }
        const exists = (data.pelletStock || []).some(ps => ps.id === pt.id || pelletTypeMatches(g.name, ps.name))
        if (!exists) {
          newRows.push({ id: pt.id, name: pt.name, opening: 0, production: 0, dispatch: 0, wastage: 0, closing: 0 })
        }
      }
      if (!cancelled && newRows.length > 0) {
        updateData('pelletStock', [...(data.pelletStock || []), ...newRows])
      }
      if (!cancelled && failed > 0) {
        showToast('Could not register pellet type(s) — check your connection and revisit this step', 'error')
      }
    })()
    return () => { cancelled = true }
  }, [data.production, data.mixes, plant?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate production from Step 3/4 and dispatch from Step 6
  useEffect(() => {
    if (!data.pelletStock || data.pelletStock.length === 0) return

    const dispatchTotals = data.dispatchTotals || {}
    const mixes = data.mixes || []

    const stock = data.pelletStock.map(ps => {
      // Sum production entries whose derived pellet name matches this stock row
      const prodTotal = (data.production || [])
        .filter(p => pelletTypeMatches(entryPelletName(p, mixes), ps.name))
        .reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)

      // Dispatch total from Step 6 — semantic match so "Non-Sample" maps to "N Sample" etc.
      const dispTotal = Object.entries(dispatchTotals).reduce((sum, [key, val]) => {
        return pelletTypeMatches(key, ps.name) ? sum + (parseFloat(val) || 0) : sum
      }, 0)

      return {
        ...ps,
        production: prodTotal,
        dispatch: dispTotal,
        closing: (ps.opening || 0) + prodTotal - dispTotal - (ps.wastage || 0),
      }
    })

    // Only update if production or dispatch values actually changed
    const hasChanged = stock.some((s, i) =>
      s.production !== data.pelletStock[i].production ||
      s.dispatch !== data.pelletStock[i].dispatch
    )
    if (hasChanged) {
      updateData('pelletStock', stock)
    }
  }, [data.production, data.dispatchTotals, data.pelletStock, data.mixes]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateStock(idx, field, value) {
    const stock = [...data.pelletStock]
    stock[idx] = { ...stock[idx], [field]: parseFloat(value) || 0 }
    stock[idx].closing = stock[idx].opening + stock[idx].production - stock[idx].dispatch - stock[idx].wastage
    updateData('pelletStock', stock)
  }

  const totalProduction = data.pelletStock.reduce((sum, ps) => sum + (ps.production || 0), 0)
  const totalDispatch = data.pelletStock.reduce((sum, ps) => sum + (ps.dispatch || 0), 0)
  const netChange = totalProduction - totalDispatch

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Table Container */}
      <div style={{ overflowX: 'auto', marginBottom: 10, borderRadius: 10, border: '1px solid #e5ddd0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit' }}>
          <thead>
            <tr style={{ background: '#fefae0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#2c2c2c', textTransform: 'uppercase', borderBottom: '1px solid #e5ddd0' }}>Pellet</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#2c2c2c', textTransform: 'uppercase', borderBottom: '1px solid #e5ddd0' }}>Open</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#2c2c2c', textTransform: 'uppercase', borderBottom: '1px solid #e5ddd0' }}>Prod</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#2c2c2c', textTransform: 'uppercase', borderBottom: '1px solid #e5ddd0' }}>Disp</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#2c2c2c', textTransform: 'uppercase', borderBottom: '1px solid #e5ddd0' }}>Waste</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', borderBottom: '1px solid #e5ddd0' }}>Close</th>
            </tr>
          </thead>
          <tbody>
            {data.pelletStock.map((ps, idx) => (
              <tr key={ps.id} style={{ borderBottom: '1px solid #e5ddd0' }}>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#2c2c2c', fontWeight: 500 }}>{ps.name || 'Unknown type'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#2d6a4f', background: '#e8f0ec' }}>
                  {(ps.opening || 0).toFixed(1)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#2d6a4f', background: '#e8f0ec' }}>
                  {(ps.production || 0).toFixed(1)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#d4a373', background: '#fefae0', fontWeight: 600 }}>
                  {(ps.dispatch || 0).toFixed(1)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <input
                    type="number"
                    step="0.1"
                    value={ps.wastage || ''}
                    onChange={e => updateStock(idx, 'wastage', e.target.value)}
                    placeholder="0"
                    style={{ width: '100%', maxWidth: 70, padding: '6px 8px', borderRadius: 4, border: '1px solid #e5ddd0', textAlign: 'center', fontSize: 12, outline: 'none', background: '#ffffff' }}
                  />
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#2d6a4f', fontWeight: 700, background: '#e8f0ec' }}>
                  {(ps.closing || 0).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div style={{ background: '#e8f0ec', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#2d6a4f', lineHeight: 1.6 }}>
        <b>Prod auto-fills from Step 4. Dispatch auto-fills from Step 6.</b> Close = Open + Prod - Disp - Waste
      </div>

      {/* Summary Card */}
      <div style={{ background: '#fefae0', borderRadius: 8, marginTop: 8, padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid #e5ddd0' }}>
          <span style={{ fontSize: 13, color: '#595c4a', fontWeight: 500 }}>Total Production</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#2d6a4f' }}>{totalProduction.toFixed(1)} MT</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingBottom: 12, borderBottom: '1px solid #e5ddd0' }}>
          <span style={{ fontSize: 13, color: '#595c4a', fontWeight: 500 }}>Total Dispatch</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#d4a373' }}>{totalDispatch.toFixed(1)} MT</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
          <span style={{ fontSize: 13, color: '#595c4a', fontWeight: 500 }}>Net Change</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: netChange < 0 ? '#d32f2f' : '#2d6a4f' }}>
            {(netChange >= 0 ? '+' : '') + netChange.toFixed(1)} MT
          </span>
        </div>
      </div>
    </div>
  )
})
