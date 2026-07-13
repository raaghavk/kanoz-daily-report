import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import { Package, Boxes, FlaskConical, Loader2, AlertCircle, Plus, Info } from 'lucide-react'

const num = v => Number(v) || 0

// Include rows where is_deleted is null OR false
const live = q => q.or('is_deleted.is.null,is_deleted.eq.false')

// Pull the current raw material + pellet stock and known recipes for a plant.
async function loadStock(plant) {
  // Latest non-deleted shift report for this plant (most recent date, then shift)
  const latestRes = await live(
    supabase
      .from('shift_reports')
      .select('id, date, shift')
      .eq('plant_id', plant.id)
      .order('date', { ascending: false })
      .order('shift', { ascending: false })
      .limit(1)
  )
  const latest = (latestRes.data && latestRes.data[0]) || null

  // Raw material types (names + fallback opening stock + gcv)
  const rmTypesRes = await supabase
    .from('raw_material_types')
    .select('id, name, unit, opening_stock_kg, gcv_kcal_kg, is_active')
    .eq('plant_id', plant.id)
    .eq('is_active', true)
  const rmTypes = rmTypesRes.data || []

  let rawMaterials = []
  let rmAsOf = null

  if (latest) {
    const rmuRes = await supabase
      .from('raw_material_usage')
      .select('raw_material_type_id, closing_kg, raw_material_types(name, unit)')
      .eq('shift_report_id', latest.id)
    const rmu = rmuRes.data || []
    if (rmu.length) {
      rmAsOf = { date: latest.date, shift: latest.shift }
      const closingByType = {}
      for (const r of rmu) closingByType[r.raw_material_type_id] = r
      // Prefer material types (stable ordering); fall back to whatever the usage rows carry.
      if (rmTypes.length) {
        rawMaterials = rmTypes.map(t => {
          const row = closingByType[t.id]
          return {
            id: t.id,
            name: t.name,
            unit: t.unit || 'kg',
            kg: row ? num(row.closing_kg) : num(t.opening_stock_kg),
            fromReport: !!row,
          }
        })
      } else {
        rawMaterials = rmu.map(r => ({
          id: r.raw_material_type_id,
          name: r.raw_material_types?.name || 'Unknown material',
          unit: r.raw_material_types?.unit || 'kg',
          kg: num(r.closing_kg),
          fromReport: true,
        }))
      }
    }
  }

  // Fall back to opening stock when no shift report / usage rows exist yet.
  if (!rawMaterials.length) {
    rawMaterials = rmTypes.map(t => ({
      id: t.id,
      name: t.name,
      unit: t.unit || 'kg',
      kg: num(t.opening_stock_kg),
      fromReport: false,
    }))
  }

  // Pellet stock from the latest shift report
  let pellets = []
  let pelletAsOf = null
  if (latest) {
    const psRes = await supabase
      .from('pellet_stock')
      .select('pellet_type_id, closing_mt, pellet_types(name, grade, gcv_kcal_kg)')
      .eq('shift_report_id', latest.id)
    const ps = psRes.data || []
    if (ps.length) {
      pelletAsOf = { date: latest.date, shift: latest.shift }
      pellets = ps.map(p => ({
        id: p.pellet_type_id,
        name: p.pellet_types?.name || 'Unknown type',
        mt: num(p.closing_mt),
        grade: p.pellet_types?.grade || null,
        gcv: p.pellet_types?.gcv_kcal_kg != null ? num(p.pellet_types.gcv_kcal_kg) : null,
      }))
    }
  }

  // Recipes / mixes: most recent shift_mix per derived_pellet_name for this plant
  const mixRes = await supabase
    .from('shift_mixes')
    .select('id, name, type, derived_pellet_name, derived_gcv, derived_grade, created_at, shift_mix_compositions(raw_material_name, quantity_kg)')
    .eq('plant_id', plant.id)
    .order('created_at', { ascending: false })
  const allMixes = mixRes.data || []
  const seen = new Set()
  const recipes = []
  for (const m of allMixes) {
    const label = m.derived_pellet_name || m.name || m.type || 'Mix'
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const comps = (m.shift_mix_compositions || []).filter(c => num(c.quantity_kg) > 0)
    const total = comps.reduce((s, c) => s + num(c.quantity_kg), 0)
    const ingredients = comps
      .map(c => ({
        name: c.raw_material_name || 'Material',
        kg: num(c.quantity_kg),
        pct: total > 0 ? Math.round((num(c.quantity_kg) / total) * 100) : 0,
      }))
      .sort((a, b) => b.kg - a.kg)
    recipes.push({
      id: m.id,
      label,
      grade: m.derived_grade || null,
      gcv: m.derived_gcv != null ? num(m.derived_gcv) : null,
      ingredients,
    })
  }

  return { rawMaterials, rmAsOf, pellets, pelletAsOf, recipes }
}

function fmtKg(v) {
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function AsOf({ info, fallbackText }) {
  const text = info ? `as of ${info.date} · Shift ${info.shift}` : fallbackText
  if (!text) return null
  return <span style={{ fontSize: 11, color: '#8a8d7a' }}>{text}</span>
}

export default function StockHome() {
  const { plant } = useAuth()
  const navigate = useNavigate()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['stock-recipes', plant?.id],
    enabled: !!plant?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => loadStock(plant),
  })

  const cardStyle = { background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }
  const sectionTitle = { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#8a8d7a', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Stock & Recipes" subtitle={`${plant?.name || 'Plant'} · Current material, pellets & mixes`} onBack={() => navigate('/')} />

      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {isError && !isLoading && (
          <div style={{ ...cardStyle, borderColor: '#fca5a5', padding: '16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle size={18} style={{ color: '#b91c1c', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>Couldn't load stock</div>
              <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 2 }}>{error?.message || 'Please pull to refresh and try again.'}</div>
            </div>
          </div>
        )}

        {!isLoading && !isError && data && (
          <>
            {/* Raw material stock */}
            <div>
              <div style={sectionTitle}><Package size={13} /> Current Raw Material Stock</div>
              {data.rawMaterials.length === 0 ? (
                <div style={{ ...cardStyle, padding: '16px', fontSize: 13, color: '#8a8d7a' }}>
                  No raw materials set up for this plant yet.
                </div>
              ) : (
                <div style={cardStyle}>
                  {data.rawMaterials.map((m, idx) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#2c2c2c' }}>{m.name}</div>
                        <AsOf info={m.fromReport ? data.rmAsOf : null} fallbackText="opening stock" />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1b4332', flexShrink: 0, marginLeft: 12 }}>
                        {fmtKg(m.kg)} <span style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a' }}>{m.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pellet stock */}
            <div>
              <div style={sectionTitle}><Boxes size={13} /> Current Pellet Stock</div>
              {data.pellets.length === 0 ? (
                <div style={{ ...cardStyle, padding: '16px', fontSize: 13, color: '#8a8d7a' }}>
                  No pellet stock recorded yet. It appears here once a shift report logs closing stock.
                </div>
              ) : (
                <div style={cardStyle}>
                  {data.pellets.map((p, idx) => (
                    <div key={p.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#2c2c2c' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#8a8d7a', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {p.grade && <span>{p.grade}</span>}
                          {p.gcv != null && <span>GCV {fmtKg(p.gcv)}</span>}
                          <AsOf info={data.pelletAsOf} />
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1b4332', flexShrink: 0, marginLeft: 12 }}>
                        {p.mt.toLocaleString('en-IN', { maximumFractionDigits: 3 })} <span style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a' }}>MT</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recipes / mixes */}
            <div>
              <div style={sectionTitle}><FlaskConical size={13} /> Recipes / Mixes</div>
              {data.recipes.length === 0 ? (
                <div style={{ ...cardStyle, padding: '16px', fontSize: 13, color: '#8a8d7a' }}>
                  No mixes recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.recipes.map(r => (
                    <div key={r.id} style={{ ...cardStyle, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>{r.label}</div>
                        {(r.grade || r.gcv != null) && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#2d6a4f', flexShrink: 0 }}>
                            {r.gcv != null && `GCV ${fmtKg(r.gcv)}`}{r.gcv != null && r.grade ? ' · ' : ''}{r.grade}
                          </div>
                        )}
                      </div>
                      {r.ingredients.length > 0 ? (
                        <div style={{ fontSize: 12, color: '#595c4a', marginTop: 4, lineHeight: 1.5 }}>
                          {r.ingredients.map((ing, i) => (
                            <span key={i}>
                              {i > 0 && <span style={{ color: '#b5b8a8' }}> · </span>}
                              {ing.name} <span style={{ fontWeight: 700, color: '#1b4332' }}>{ing.pct}%</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 4 }}>No composition recorded</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Helper: mixes are created in a shift report */}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#e8f0ec', borderRadius: 12 }}>
                <Info size={15} style={{ color: '#2d6a4f', flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 12, color: '#2d6a4f' }}>Mixes are created inside a Shift Report.</div>
                <button
                  onClick={() => navigate('/shift/new')}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                >
                  <Plus size={13} /> New Shift
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
