import { memo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocalDate } from '../../lib/dateUtils'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import { Plus, Trash2, X, Edit2, Lock, ShoppingCart } from 'lucide-react'
import { deriveMixPellet, gradeForGcv } from '../../lib/pelletGrading'
import { computeProcessingDeltas } from '../../lib/processingDeltas'
import { kgToMtStr } from '../../lib/units'

const C = {
  green: '#2d6a4f',
  text: '#2c2c2c',
  muted: '#595c4a',
  dim: '#8a8d7a',
  bg: '#fefae0',
  border: '#e5ddd0',
  card: '#fff',
}

function formatGcv(gcv) {
  return `${Math.round(gcv).toLocaleString('en-IN')} kcal/kg`
}

// Grade badge: High GCV (solid green), Low GCV (amber), or grey when no
// ingredient has a GCV configured yet.
function GradeBadge({ grade, small }) {
  const style = grade === 'High GCV'
    ? { background: '#2d6a4f', color: '#fff' }
    : grade === 'Low GCV'
      ? { background: '#fef3c7', color: '#b45309' }
      : { background: '#f0efe9', color: '#8a8d7a' }
  return (
    <span style={{ ...style, fontSize: small ? 9 : 10, fontWeight: 700, borderRadius: 6, padding: small ? '2px 6px' : '3px 8px', whiteSpace: 'nowrap' }}>
      {grade || 'Set GCV in Settings'}
    </span>
  )
}

export default memo(function Step3RawMaterialMix({ data, updateData, plant, saveWizardState }) {
  const navigate = useNavigate()

  // Opening/Purchased are DERIVED (settings opening + purchases ledger). Recompute them
  // from source so they never show stale values from an old saved draft.
  // - First report (no prior shift report yet = paper->app transition): opening =
  //   settings opening + purchases dated (>= as-of AND < report date); purchased =
  //   purchases dated == report date. Purchases before the plant's stock as-of date are
  //   already inside the opening figure and are excluded.
  // - Later reports: opening comes from the previous shift's closing (left untouched);
  //   we only refresh the current day's purchased so Add-Purchase reflects immediately.
  useEffect(() => {
    let cancelled = false
    const shiftDate = data.shift_start_date || data.date
    if (!plant?.id || !shiftDate || !(data.rawMaterials || []).length) return
    ;(async () => {
      const { count } = await supabase
        .from('shift_reports')
        .select('id', { count: 'exact', head: true })
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
      if (cancelled) return
      const isFirstReport = (count || 0) === 0
      const stockAsOf = plant.stock_opening_date || null

      // Settings opening baselines (only needed for the first-report recompute)
      const openingBase = {}
      if (isFirstReport) {
        const { data: types } = await supabase
          .from('raw_material_types')
          .select('id, opening_stock_kg')
          .eq('plant_id', plant.id)
        if (cancelled) return
        for (const t of (types || [])) openingBase[t.id] = parseFloat(t.opening_stock_kg) || 0
      }

      // Ledger purchases up to the report date (bounded below by the stock as-of date)
      let pq = supabase
        .from('raw_material_purchases')
        .select('raw_material_type_id, raw_material_type, date, quantity_kg')
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
        .lte('date', shiftDate)
      if (stockAsOf) pq = pq.gte('date', stockAsOf)
      const { data: purch } = await pq
      if (cancelled || !purch) return

      const norm = (x) => (x || '').toString().trim().toLowerCase()
      const idByName = {}
      ;(data.rawMaterials || []).forEach(rm => { idByName[norm(rm.name)] = rm.id })
      const openAdd = {}, purchOn = {}
      for (const p of purch) {
        const id = p.raw_material_type_id || idByName[norm(p.raw_material_type)]
        if (!id) continue
        const q = parseFloat(p.quantity_kg) || 0
        if (p.date < shiftDate) openAdd[id] = (openAdd[id] || 0) + q
        else purchOn[id] = (purchOn[id] || 0) + q
      }

      // For later reports, only refresh purchased for a current-day report.
      const refreshPurchased = isFirstReport || shiftDate === getLocalDate()
      let changed = false
      const updated = (data.rawMaterials || []).map(rm => {
        const next = { ...rm }
        let diff = false
        if (refreshPurchased) {
          const nextPurch = purchOn[rm.id] || 0
          if ((parseFloat(rm.purchased) || 0) !== nextPurch) { next.purchased = nextPurch; diff = true }
        }
        if (isFirstReport) {
          const nextOpen = (openingBase[rm.id] || 0) + (openAdd[rm.id] || 0)
          if ((parseFloat(rm.opening) || 0) !== nextOpen) { next.opening = nextOpen; diff = true }
        }
        if (diff) changed = true
        return next
      })
      if (changed) updateData('rawMaterials', updated)
    })()
    return () => { cancelled = true }
  }, [plant?.id, data.shift_start_date, data.date, (data.rawMaterials || []).length]) // eslint-disable-line react-hooks/exhaustive-deps

  function goAddPurchase() {
    if (saveWizardState) saveWizardState()
    navigate('/purchase/new', { state: { returnToShift: true, returnToStep: 3 } })
  }

  const loadedWindowRef = useRef(null)
  const [slideOpen, setSlideOpen] = useState(false)
  const [editingMix, setEditingMix] = useState(null)
  const [preparingMix, setPreparingMix] = useState(null)
  const [prepareOpen, setPrepareOpen] = useState(false)

  const mixes = data.mixes || []
  const gcvThreshold = plant?.gcv_grade_threshold ?? 3200

  // Auto-load purchased quantities. Reloads whenever the shift window (dates or
  // times) changes — a new report mounts with a default date, so we must recompute
  // once the user picks the real shift date, otherwise that day's purchases never
  // appear. Keyed by the window so it runs once per distinct window, not on every render.
  useEffect(() => {
    if (!plant?.id || !data.shift_start_date) return
    const winKey = `${data.shift_start_date}|${data.shift_end_date || ''}|${data.start_time || ''}|${data.end_time || ''}`
    if (loadedWindowRef.current === winKey) return
    let cancelled = false
    async function loadPurchases() {
      try {
        const { data: purchases } = await supabase
          .from('raw_material_purchases')
          .select('raw_material_type_id, quantity_kg, purchase_time, date')
          .eq('plant_id', plant.id)
          .eq('is_deleted', false)
          .gte('date', data.shift_start_date)
          .lte('date', data.shift_end_date || data.shift_start_date)
        if (cancelled) return
        loadedWindowRef.current = winKey

        let filtered = purchases || []
        if (data.start_time && data.end_time && data.shift_start_date) {
          const norm = t => t ? t.substring(0, 5) : t
          const shiftStart = new Date(`${data.shift_start_date}T${norm(data.start_time)}:00`)
          const shiftEnd = new Date(`${data.shift_end_date || data.shift_start_date}T${norm(data.end_time)}:00`)
          filtered = filtered.filter(p => {
            if (!p.purchase_time) return true
            // Use the purchase's OWN date so overnight purchases land in the right
            // shift; start-inclusive / end-exclusive so a purchase exactly on the
            // 8pm/8am handover counts for exactly one shift (never both).
            const pDt = new Date(`${p.date || data.shift_start_date}T${p.purchase_time}`)
            return pDt >= shiftStart && pDt < shiftEnd
          })
        }

        const purchasedByType = {}
        filtered.forEach(p => {
          purchasedByType[p.raw_material_type_id] = (purchasedByType[p.raw_material_type_id] || 0) + (parseFloat(p.quantity_kg) || 0)
        })

        // Opening = closing of the shift immediately BEFORE this one (the previous
        // shift's carry-out). Find the latest non-deleted report whose start is
        // strictly before this shift's start — that automatically excludes the report
        // being edited (same start) and works even if reports were entered out of order.
        // If there is no earlier report, this is the first report: leave opening as-is
        // (the first-report effect seeds it from the settings opening stock).
        let prevClosings = null
        let openingBeforeByType = null
        {
          const thisStart = new Date(`${data.shift_start_date}T${(data.start_time || '00:00').substring(0,5)}:00`)
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
            const rs = new Date(`${r.shift_start_date}T${(r.start_time || '00:00:00').substring(0,8)}`)
            return rs < thisStart
          })
          if (prev) {
            const { data: usage } = await supabase
              .from('raw_material_usage')
              .select('raw_material_type_id, closing_kg')
              .eq('shift_report_id', prev.id)
            if (cancelled) return
            prevClosings = {}
            for (const u of (usage || [])) prevClosings[u.raw_material_type_id] = parseFloat(u.closing_kg) || 0
          } else {
            // No earlier report — this is the chain's FIRST report (even if later
            // reports already exist, e.g. a back-dated start). Seed opening from the
            // settings opening stock plus any purchases dated before this shift
            // (on/after the stock-opening date), which are already part of that stock.
            const stockAsOf = plant?.stock_opening_date || null
            let bq = supabase.from('raw_material_purchases')
              .select('raw_material_type_id, quantity_kg, date')
              .eq('plant_id', plant.id).eq('is_deleted', false)
              .lt('date', data.shift_start_date)
            if (stockAsOf) bq = bq.gte('date', stockAsOf)
            const { data: before } = await bq
            if (cancelled) return
            openingBeforeByType = {}
            for (const p of (before || [])) openingBeforeByType[p.raw_material_type_id] = (openingBeforeByType[p.raw_material_type_id] || 0) + (parseFloat(p.quantity_kg) || 0)
          }
        }

        // Update rawMaterials — preserve existing used (from mixes), and fold
        // in-house processing (produced + processing input) into closing.
        const procDeltas = computeProcessingDeltas(data.processing, data.rawMaterials)
        const updated = data.rawMaterials.map(rm => {
          const purchased = Math.round(purchasedByType[rm.id] || 0)
          const used = rm.used || 0
          const d = procDeltas[rm.id] || { produced: 0, procUsed: 0 }
          const opening = prevClosings
            ? (prevClosings[rm.id] || 0)
            : ((parseFloat(rm.opening_stock_kg) || 0) + ((openingBeforeByType && openingBeforeByType[rm.id]) || 0))
          return { ...rm, opening, purchased, produced: d.produced, closing: opening + purchased + d.produced - used - d.procUsed }
        })
        if (!cancelled) updateData('rawMaterials', updated)
      } catch (err) {
        console.error('Error loading purchases:', err)
      }
    }
    loadPurchases()
    return () => { cancelled = true }
  }, [plant?.id, data.shift_start_date, data.shift_end_date, data.start_time, data.end_time]) // eslint-disable-line react-hooks/exhaustive-deps

  // This-shift RM consumption for a mix. Carried-over mixes keep their recipe
  // in `ingredients`, but raw material is only consumed for batches prepared
  // THIS shift — tracked in `consumed_ingredients`. Falls back gracefully for
  // drafts saved before consumed_ingredients existed.
  function getConsumedIngredients(mix) {
    if (Array.isArray(mix.consumed_ingredients)) return mix.consumed_ingredients
    if (mix.isCarryForward) return (parseFloat(mix.prepared_kg) || 0) > 0 ? (mix.ingredients || []) : []
    return mix.ingredients || []
  }

  // Sync rawMaterials.used from this-shift mix consumption, then save both.
  // Returns true if saved successfully, false if blocked by negative stock.
  function syncAndSave(newMixes) {
    const rmUsed = {}
    newMixes.forEach(mix => {
      getConsumedIngredients(mix).forEach(ing => {
        if (ing.raw_material_type_id) {
          rmUsed[ing.raw_material_type_id] = (rmUsed[ing.raw_material_type_id] || 0) + (parseFloat(ing.quantity_kg) || 0)
        }
      })
    })
    const procDeltas = computeProcessingDeltas(data.processing, data.rawMaterials)
    const updatedRM = data.rawMaterials.map(rm => {
      const used = rmUsed[rm.id] || 0
      const d = procDeltas[rm.id] || { produced: 0, procUsed: 0 }
      return { ...rm, used, produced: d.produced, closing: (rm.opening || 0) + (rm.purchased || 0) + d.produced - used - d.procUsed }
    })

    // Block save if any raw material goes negative
    const negatives = updatedRM.filter(rm => rm.closing < -0.001)
    if (negatives.length > 0) {
      const names = negatives.map(rm => `${rm.name} (${rm.closing.toFixed(0)} kg)`).join(', ')
      showToast(`Not enough stock: ${names}`, 'error')
      return false
    }

    updateData('rawMaterials', updatedRM)
    updateData('mixes', newMixes)
    return true
  }

  function openNewMix() {
    setEditingMix({
      local_id: null, // will be set on save
      db_id: null,
      name: `Mix ${mixes.length + 1}`,
      type: '',
      opening_kg: 0,
      ingredients: [],
      prepared_kg: 0,
    })
    setSlideOpen(true)
  }

  function openEditMix(mix) {
    setEditingMix({ ...mix, ingredients: (mix.ingredients || []).map(i => ({ ...i })) })
    setSlideOpen(true)
  }

  function openPrepareMix(mix) {
    setPreparingMix({ ...mix, ingredients: (mix.ingredients || []).map(i => ({ ...i })) })
    setPrepareOpen(true)
  }

  function saveMix(mixForm) {
    const prepared_kg = (mixForm.ingredients || []).reduce((s, i) => s + (parseFloat(i.quantity_kg) || 0), 0)
    // Derive the pellet identity from the RECIPE ingredients (user may have
    // overridden the name in the form). mix.type mirrors the pellet name for
    // backward compatibility with older reports.
    const derived = deriveMixPellet(mixForm.ingredients || [], data.rawMaterials, gcvThreshold)
    const pelletName = (mixForm.pellet_name || '').trim() || derived.name || mixForm.type || null
    // Creating/editing a mix with a recipe is its first preparation — the
    // recipe quantities are consumed from this shift's raw material stock.
    const saved = {
      ...mixForm,
      prepared_kg,
      consumed_ingredients: (mixForm.ingredients || []).map(i => ({ ...i })),
      derived_pellet_name: pelletName,
      derived_gcv: derived.gcv,
      derived_grade: derived.grade,
      type: pelletName || mixForm.type,
    }
    let newMixes
    if (mixForm.local_id && mixes.some(m => m.local_id === mixForm.local_id)) {
      newMixes = mixes.map(m => m.local_id === mixForm.local_id ? saved : m)
    } else {
      newMixes = [...mixes, { ...saved, local_id: 'mix_' + Date.now() }]
    }
    const ok = syncAndSave(newMixes)
    if (ok) {
      setSlideOpen(false)
      setEditingMix(null)
    }
  }

  function deleteMix(localId) {
    syncAndSave(mixes.filter(m => m.local_id !== localId))
  }

  function savePreparedMix(preparedForm) {
    // Refresh derived GCV/grade from the RECIPE (carry-forward name is kept).
    // Derivation never uses consumed_ingredients — those track this shift's
    // raw-material consumption, not the pellet identity.
    const recipe = (Array.isArray(preparedForm.recipeIngredients) && preparedForm.recipeIngredients.length > 0)
      ? preparedForm.recipeIngredients
      : (preparedForm.ingredients || [])
    const derived = deriveMixPellet(recipe, data.rawMaterials, gcvThreshold)
    const pelletName = preparedForm.derived_pellet_name || derived.name || preparedForm.type || null
    const gcv = derived.gcv != null ? derived.gcv : (preparedForm.derived_gcv ?? null)
    const prepared = {
      ...preparedForm,
      derived_pellet_name: pelletName,
      derived_gcv: gcv,
      derived_grade: gcv != null ? gradeForGcv(gcv, gcvThreshold) : (preparedForm.derived_grade || null),
      type: pelletName || preparedForm.type,
    }
    let newMixes
    if (prepared.local_id && mixes.some(m => m.local_id === prepared.local_id)) {
      newMixes = mixes.map(m => m.local_id === prepared.local_id ? prepared : m)
    } else {
      newMixes = [...mixes, { ...prepared, local_id: 'mix_' + Date.now() }]
    }
    const ok = syncAndSave(newMixes)
    if (ok) {
      setPrepareOpen(false)
      setPreparingMix(null)
    }
  }

  // Compute used_kg for a mix from production mix_usages
  function getMixUsed(mix) {
    return (data.production || []).reduce((sum, p) => {
      return sum + (p.mix_usages || [])
        .filter(u => u.mix_local_id === mix.local_id)
        .reduce((s, u) => s + (parseFloat(u.quantity_kg) || 0), 0)
    }, 0)
  }

  const rmProcDeltas = computeProcessingDeltas(data.processing, data.rawMaterials)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* RM Stock table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 1 }}>Raw Material Stock</div>
          <button onClick={goAddPurchase} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 9, border: `1.5px solid ${C.green}`, background: '#fff', color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <ShoppingCart size={13} /> Add Purchase
          </button>
        </div>
        <div style={{ background: C.card, borderRadius: 14, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(5, 1fr)', background: C.green, padding: '9px 12px' }}>
            {['Material', 'Open', 'Purch', 'Made', 'Used', 'Close'].map((h, i) => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#fff', textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          {data.rawMaterials.length === 0 ? (
            <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: '#b5b8a8' }}>No raw materials configured</div>
          ) : (
            data.rawMaterials.map((rm, idx) => {
              const d = rmProcDeltas[rm.id] || { produced: 0, procUsed: 0 }
              const made = d.produced || 0
              const usedTotal = (rm.used || 0) + (d.procUsed || 0)
              const closing = (rm.opening || 0) + (rm.purchased || 0) + made - usedTotal
              return (
              <div key={rm.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(5, 1fr)', padding: '10px 12px', borderTop: idx > 0 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{rm.name}</span>
                <span style={{ fontSize: 12, color: C.muted, textAlign: 'right' }}>{kgToMtStr(rm.opening)}</span>
                <span style={{ fontSize: 12, color: C.muted, textAlign: 'right' }}>{kgToMtStr(rm.purchased)}</span>
                <span style={{ fontSize: 12, color: made > 0 ? C.green : '#c9cbb8', fontWeight: made > 0 ? 700 : 400, textAlign: 'right' }}>{kgToMtStr(made)}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text, textAlign: 'right' }}>{kgToMtStr(usedTotal)}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: closing < 0 ? '#c0392b' : C.green, textAlign: 'right' }}>{kgToMtStr(closing)}</span>
              </div>
              )
            })
          )}
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 5 }}>RM "Used" = mix ingredients + in-house processing. "Made" = produced in-house this shift.</div>
        {(() => {
          const nameById = {}
          ;(data.rawMaterials || []).forEach(rm => { nameById[rm.id] = rm.name })
          const made = []
          const consumed = []
          Object.entries(rmProcDeltas || {}).forEach(([id, d]) => {
            const nm = nameById[id] || 'Material'
            if ((d.produced || 0) > 0) made.push(`${nm} +${Math.round(d.produced)} kg`)
            if ((d.procUsed || 0) > 0) consumed.push(`${nm} -${Math.round(d.procUsed)} kg`)
          })
          if (!made.length && !consumed.length) return null
          return (
            <div style={{ fontSize: 11, color: C.green, marginTop: 4, fontWeight: 600, lineHeight: 1.5 }}>
              In-house this shift: {made.length ? 'made ' + made.join(', ') : ''}{made.length && consumed.length ? '; ' : ''}{consumed.length ? 'consumed ' + consumed.join(', ') : ''}.
            </div>
          )
        })()}
      </div>

      {/* Mixes section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 1 }}>Mixes</div>
          <button
            onClick={openNewMix}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: C.green, color: '#fff', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            <Plus size={14} /> New Mix
          </button>
        </div>

        {mixes.length === 0 ? (
          <div style={{ background: C.card, borderRadius: 14, border: `2px dashed ${C.border}`, padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#b5b8a8', marginBottom: 6 }}>No mixes yet</div>
            <div style={{ fontSize: 11, color: C.dim }}>Tap "New Mix" to create a mix for this shift</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mixes.map(mix => {
              const used = getMixUsed(mix)
              const closing = (mix.opening_kg || 0) + (mix.prepared_kg || 0) - used
              const totalKg = (mix.ingredients || []).reduce((sum, ing) => sum + (parseFloat(ing.quantity_kg) || 0), 0)
              return (
                <div key={mix.local_id} style={{ background: C.card, borderRadius: 14, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
                  {/* Green header */}
                  <div style={{ background: C.green, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {mix.isCarryForward && <Lock size={16} color="#fff" />}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{mix.name}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
                          {(mix.derived_pellet_name || mix.type || 'Pellet')}
                          {mix.derived_gcv != null && ` · ${formatGcv(mix.derived_gcv)}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {mix.isCarryForward ? (
                        <button
                          onClick={() => openPrepareMix(mix)}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(255,255,255,0.25)',
                            border: 'none',
                            borderRadius: 8,
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <Plus size={13} /> Prepare
                        </button>
                      ) : (
                        <>
                          <button onClick={() => openEditMix(mix)} style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => deleteMix(mix.local_id)} style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stock 4-cell row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    {[
                      { label: 'Opening', value: mix.opening_kg || 0, color: C.muted },
                      { label: 'Prepared', value: mix.prepared_kg || 0, color: C.text },
                      { label: 'Used', value: used, color: C.text },
                      { label: 'Closing', value: closing, color: C.green },
                    ].map((cell, i) => (
                      <div key={cell.label} style={{ padding: '10px 8px', borderLeft: i > 0 ? `1px solid ${C.border}` : 'none', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{cell.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: cell.color }}>{kgToMtStr(cell.value)} MT</div>
                      </div>
                    ))}
                  </div>

                  {/* Ingredient composition */}
                  <div style={{ padding: '8px 14px 10px', borderTop: `1px solid ${C.border}`, background: '#faf9f4' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.8 }}>Composition {mix.isCarryForward && '(Recipe)'}</span>
                      {(mix.ingredients?.length > 0 || mix.derived_grade) && <GradeBadge grade={mix.derived_grade} small />}
                    </div>
                    {mix.ingredients?.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
                        {mix.ingredients.map((ing, i) => {
                          const qty = parseFloat(ing.quantity_kg) || 0
                          const pct = totalKg > 0 ? (qty / totalKg) * 100 : 0
                          return (
                            <span key={i} style={{ fontSize: 11, color: C.text, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                              {mix.isCarryForward && <Lock size={10} color={C.text} />}
                              <strong style={{ color: C.green }}>{ing.name || 'RM'}</strong>
                              {mix.isCarryForward
                                ? ` · ${pct.toFixed(1)}%`
                                : ` · ${qty} kg (${pct.toFixed(1)}%)`}
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: '#b5b8a8', fontStyle: 'italic' }}>No ingredients added — tap ✏️ to define this mix's recipe</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Slide-up mix panel */}
      {slideOpen && editingMix && (
        <MixPanel
          mix={editingMix}
          rawMaterials={data.rawMaterials}
          threshold={gcvThreshold}
          onSave={saveMix}
          onClose={() => { setSlideOpen(false); setEditingMix(null) }}
        />
      )}

      {/* Prepare panel for carry-forward mixes */}
      {prepareOpen && preparingMix && (
        <PreparePanel
          mix={preparingMix}
          onSave={savePreparedMix}
          onClose={() => { setPrepareOpen(false); setPreparingMix(null) }}
        />
      )}
    </div>
  )
})

// Slide-up panel for creating/editing a mix
function MixPanel({ mix, rawMaterials, threshold, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    // Pre-fill the pellet name only when it was overridden (differs from what
    // the recipe derives) — otherwise it stays live-derived as recipe changes.
    const initialDerived = deriveMixPellet(mix.ingredients || [], rawMaterials, threshold)
    const stored = mix.derived_pellet_name || ''
    return {
      local_id: mix.local_id || null,
      db_id: mix.db_id || null,
      name: mix.name || '',
      type: mix.type || '',
      pellet_name: stored && stored !== initialDerived.name ? stored : '',
      opening_kg: mix.opening_kg || 0,
      ingredients: (mix.ingredients || []).map(i => ({ ...i })),
      prepared_kg: mix.prepared_kg || 0,
    }
  })

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function addIngredient() {
    setForm(prev => ({ ...prev, ingredients: [...prev.ingredients, { raw_material_type_id: '', name: '', quantity_kg: '' }] }))
  }

  function updateIngredient(idx, field, value) {
    const ings = [...form.ingredients]
    if (field === 'raw_material_type_id') {
      const rm = rawMaterials.find(r => r.id === value)
      ings[idx] = { ...ings[idx], raw_material_type_id: value, name: rm?.name || '' }
    } else {
      ings[idx] = { ...ings[idx], [field]: value }
    }
    setForm(prev => ({ ...prev, ingredients: ings }))
  }

  function removeIngredient(idx) {
    setForm(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx) }))
  }

  const totalKg = form.ingredients.reduce((s, i) => s + (parseFloat(i.quantity_kg) || 0), 0)
  const validIngredients = form.ingredients.filter(i => i.raw_material_type_id && parseFloat(i.quantity_kg) > 0)
  const canSave = validIngredients.length > 0

  // Live-derived pellet identity from the current recipe
  const derived = deriveMixPellet(form.ingredients, rawMaterials, threshold)
  const displayPelletName = form.pellet_name !== '' ? form.pellet_name : (derived.name || '')

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: '20px 20px 0 0', zIndex: 201, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        {/* Panel header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{mix.local_id ? 'Edit Mix' : 'New Mix'}</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color={C.muted} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* Mix Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Mix Name</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Mix 1"
              style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Derived pellet identity */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Pellet</label>
            <input
              value={displayPelletName}
              onChange={e => set('pellet_name', e.target.value)}
              placeholder="Add ingredients to derive"
              style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <GradeBadge grade={derived.grade} />
              {derived.gcv != null && (
                <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{formatGcv(derived.gcv)}</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>Named after the dominant ingredient — edit to override. GCV is the weighted average of the recipe.</div>
          </div>

          {/* Opening stock */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Opening Stock (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              value={form.opening_kg}
              onChange={e => set('opening_kg', parseFloat(e.target.value) || 0)}
              placeholder="0"
              style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>Auto-filled from previous shift's closing.</div>
          </div>

          {/* Ingredients */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ingredients</label>
              {totalKg > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>Total: {totalKg} kg</span>}
            </div>

            {form.ingredients.map((ing, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <select
                  value={ing.raw_material_type_id}
                  onChange={e => updateIngredient(idx, 'raw_material_type_id', e.target.value)}
                  style={{ flex: 1, height: 42, padding: '0 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                >
                  <option value="">Select RM...</option>
                  {rawMaterials.map(rm => <option key={rm.id} value={rm.id}>{rm.name}</option>)}
                </select>
                <input
                  type="number"
                  inputMode="decimal"
                  value={ing.quantity_kg}
                  onChange={e => updateIngredient(idx, 'quantity_kg', e.target.value)}
                  placeholder="kg"
                  style={{ width: 70, height: 42, padding: '0 8px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                />
                <button onClick={() => removeIngredient(idx)} style={{ width: 36, height: 36, background: 'transparent', border: 'none', color: 'rgba(211,47,47,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={16} />
                </button>
              </div>
            ))}

            <button
              onClick={addIngredient}
              style={{ width: '100%', padding: '10px', border: `1.5px dashed ${C.green}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: C.green, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Plus size={14} /> Add Ingredient
            </button>
          </div>
        </div>

        {/* Save button */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, flexShrink: 0, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {!canSave && (
            <div style={{ fontSize: 11, color: '#92400E', background: '#fefae0', border: '1px solid #e9c46a', borderRadius: 8, padding: '6px 10px', marginBottom: 10, textAlign: 'center' }}>
              Add at least one ingredient with a material and quantity &gt; 0
            </div>
          )}
          <button
            onClick={() => { if (canSave) onSave(form) }}
            style={{ width: '100%', padding: '14px 0', background: canSave ? C.green : '#b5b8a8', color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 700, border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.8 }}
          >
            Save Mix
          </button>
        </div>
      </div>
    </>
  )
}

// Slide-up panel for preparing a carry-forward mix (batch preparation)
function PreparePanel({ mix, onSave, onClose }) {
  const [batchSize, setBatchSize] = useState('')

  const recipeTotal = (mix.recipeIngredients || []).reduce((s, i) => s + (parseFloat(i.quantity_kg) || 0), 0)
  const scaleFactor = recipeTotal > 0 && batchSize ? parseFloat(batchSize) / recipeTotal : 1

  function handleReset() {
    onSave({ ...mix, ingredients: (mix.recipeIngredients || []).map(i => ({ ...i })), consumed_ingredients: [], prepared_kg: 0 })
  }

  function handlePrepare() {
    if (!batchSize || parseFloat(batchSize) <= 0) return

    const scaledIngredients = (mix.recipeIngredients || []).map(ing => ({
      ...ing,
      quantity_kg: parseFloat((parseFloat(ing.quantity_kg) * scaleFactor).toFixed(2))
    }))

    // Accumulate this batch onto any batches already prepared this shift
    const consumed = (Array.isArray(mix.consumed_ingredients) ? mix.consumed_ingredients : []).map(i => ({ ...i }))
    scaledIngredients.forEach(ing => {
      const existing = consumed.find(c => c.raw_material_type_id === ing.raw_material_type_id)
      if (existing) {
        existing.quantity_kg = parseFloat(((parseFloat(existing.quantity_kg) || 0) + ing.quantity_kg).toFixed(2))
      } else {
        consumed.push({ ...ing })
      }
    })

    const prepared = {
      ...mix,
      ingredients: consumed.map(i => ({ ...i })),
      consumed_ingredients: consumed,
      prepared_kg: (parseFloat(mix.prepared_kg) || 0) + (parseFloat(batchSize) || 0),
    }
    onSave(prepared)
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 998,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
          paddingTop: 16,
        }}
      >
        {/* Header */}
        <div style={{ padding: '0 20px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Prepare Batch: {mix.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>Enter batch size to auto-scale recipe</div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Recipe info */}
          <div style={{ background: C.bg, borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Recipe Composition</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
              {mix.recipeIngredients?.map((ing, i) => {
                const qty = parseFloat(ing.quantity_kg) || 0
                const pct = recipeTotal > 0 ? (qty / recipeTotal) * 100 : 0
                return (
                  <span key={i} style={{ fontSize: 11, color: C.text, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 8px' }}>
                    <Lock size={10} style={{ display: 'inline', marginRight: 4 }} /> {ing.name || 'RM'} · {qty} kg ({pct.toFixed(1)}%)
                  </span>
                )
              })}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>Total recipe: {recipeTotal} kg</div>
          </div>

          {/* Batch size input */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>Batch Size (kg)</label>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={batchSize}
              onChange={e => setBatchSize(e.target.value)}
              placeholder="Enter total kg to prepare"
              style={{
                width: '100%',
                height: 48,
                padding: '0 14px',
                borderRadius: 12,
                border: `1.5px solid ${C.border}`,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Scaled recipe preview */}
          {batchSize && parseFloat(batchSize) > 0 && (
            <div style={{ background: 'rgba(45,106,79,0.08)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.green, textTransform: 'uppercase', marginBottom: 8 }}>Scaled Recipe</div>
              <div style={{ fontSize: 11, color: C.text, lineHeight: 1.6 }}>
                {mix.recipeIngredients?.map((ing, i) => {
                  const scaledQty = parseFloat((parseFloat(ing.quantity_kg) * scaleFactor).toFixed(2))
                  return (
                    <div key={i}>
                      {ing.name || 'RM'}: {scaledQty} kg
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px 0',
                background: '#f5f5f5',
                color: C.text,
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handlePrepare}
              disabled={!batchSize || parseFloat(batchSize) <= 0}
              style={{
                flex: 2,
                padding: '12px 0',
                background: batchSize && parseFloat(batchSize) > 0 ? C.green : '#b5b8a8',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: batchSize && parseFloat(batchSize) > 0 ? 'pointer' : 'not-allowed',
                opacity: batchSize && parseFloat(batchSize) > 0 ? 1 : 0.6,
              }}
            >
              Prepare Batch
            </button>
          </div>
          {mix.prepared_kg > 0 && (
            <button
              onClick={handleReset}
              style={{
                width: '100%',
                padding: '10px 0',
                background: 'transparent',
                color: '#d32f2f',
                border: '1px solid #d32f2f',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset Prepared to 0
            </button>
          )}
        </div>
      </div>
    </>
  )
}
