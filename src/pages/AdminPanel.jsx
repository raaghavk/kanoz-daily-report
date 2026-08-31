import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'
import PageHeader from '../components/PageHeader'
import { Plus, Edit3, Check, X, ChevronDown, ChevronUp, Archive, RotateCcw, Trash2 } from 'lucide-react'
import ProcessRoutes from './settings/ProcessRoutes'
import PlantPlots from './settings/PlantPlots'
import { gradeForGcv } from '../lib/pelletGrading'
import { kgToMt, kgToMtStr, mtToKg } from '../lib/units'

// Default type options seeded per org on first load when none exist.
const DEFAULT_MACHINE_TYPES = ['Log Eater', 'Hammer Mill', 'Pellet Machine', 'Mixer', 'Screener', 'Other']
const DEFAULT_EQUIPMENT_TYPES = ['Generator', 'Vehicle', 'Loader', 'Weighbridge', 'Pump', 'Other']
const FUEL_TYPES = ['Diesel', 'Electric', 'Petrol', 'None']

const SECTIONS = [
  { key: 'machines', table: 'machines', label: 'Machines', singular: 'Machine', hasSort: true },
  { key: 'equipment', table: 'equipment', label: 'Equipment', singular: 'Equipment', hasSort: true },
  { key: 'raw_material_types', table: 'raw_material_types', label: 'Raw Material Types', singular: 'Raw Material Type', hasSort: false },
  { key: 'pellet_types', table: 'pellet_types', label: 'Pellet Types', singular: 'Pellet Type', hasSort: false },
]

export default function AdminPanel() {
  const { employee, plant, refreshPlant } = useAuth()

  // Plant selector state
  const [plants, setPlants] = useState([])
  const [selectedPlantId, setSelectedPlantId] = useState(plant?.id || '')

  // Data for each section
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)

  // Inline editing
  const [editingItem, setEditingItem] = useState(null) // { section, id, name }
  const [addingTo, setAddingTo] = useState(null) // section key
  const [newItemName, setNewItemName] = useState('')
  // Extra fields for machines/equipment add flow (type, capacity MT/hr, motor HP)
  const [newItemType, setNewItemType] = useState('')
  const [newItemCapacity, setNewItemCapacity] = useState('')
  const [newItemMotorHp, setNewItemMotorHp] = useState('')
  const [newItemStock, setNewItemStock] = useState('')
  const [newItemSource, setNewItemSource] = useState('purchased')
  // Equipment-specific add fields (equipment is NOT MT/hr producing)
  const [newItemFuel, setNewItemFuel] = useState('')
  const [newItemRating, setNewItemRating] = useState('')
  const [newItemIdentifier, setNewItemIdentifier] = useState('')
  const [newItemOwner, setNewItemOwner] = useState('')
  const [newItemCompany, setNewItemCompany] = useState('')
  // Managed machine/equipment type dropdowns (machine_type_options), keyed by kind
  const [typeOptions, setTypeOptions] = useState({ machine: [], equipment: [] })
  // Inline "type manager" (list + add + deactivate) UI state
  const [managingTypes, setManagingTypes] = useState(null) // 'machine' | 'equipment' | null
  const [newTypeName, setNewTypeName] = useState('')
  // Pellet recipe ratios derived from most recent shift mixes (keyed by lowercased pellet name)
  const [pelletRatios, setPelletRatios] = useState({})
  const [pelletRecipesStructured, setPelletRecipesStructured] = useState({})
  const [pelletModal, setPelletModal] = useState(null)
  const [savingPellet, setSavingPellet] = useState(false)
  const [equipModal, setEquipModal] = useState(null)
  const [savingEquip, setSavingEquip] = useState(false)
  const [addingPlant, setAddingPlant] = useState(false)
  const [newPlantName, setNewPlantName] = useState('')

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({ machines: false, equipment: false, raw_material_types: false, pellet_types: false })

  // Show archived plants toggle
  const [showArchived, setShowArchived] = useState(false)

  // Per-plant GCV grade threshold (High GCV vs Low GCV cutoff)
  const [thresholdDraft, setThresholdDraft] = useState('')
  const [editThreshold, setEditThreshold] = useState(false)
  const [savingThreshold, setSavingThreshold] = useState(false)
  const [busy, setBusy] = useState(false)

  // Plant Location
  const [showLocation, setShowLocation] = useState(false)
  const [locationLat, setLocationLat] = useState(plant?.location_lat?.toString() || '')
  const [locationLng, setLocationLng] = useState(plant?.location_lng?.toString() || '')
  const [savingLocation, setSavingLocation] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)

  const [stockOpeningDate, setStockOpeningDate] = useState(plant?.stock_opening_date || '')
  const [savingStockDate, setSavingStockDate] = useState(false)
  const [editStockDate, setEditStockDate] = useState(false)

  useEffect(() => {
    const sel = plants.find(p => p.id === selectedPlantId)
    setThresholdDraft(sel?.gcv_grade_threshold ?? 3200)
  }, [selectedPlantId, plants])

  async function saveThreshold() {
    const val = parseFloat(thresholdDraft)
    if (Number.isNaN(val) || val <= 0) {
      showToast('Enter a valid threshold (kcal/kg)', 'error')
      return
    }
    setSavingThreshold(true)
    const { error } = await supabase.from('plants').update({ gcv_grade_threshold: val }).eq('id', selectedPlantId)
    setSavingThreshold(false)
    if (error) {
      showToast('Failed to save threshold: ' + error.message, 'error')
      return
    }
    setEditThreshold(false)
    showToast('GCV grade threshold saved', 'success')
    setPlants(prev => prev.map(p => p.id === selectedPlantId ? { ...p, gcv_grade_threshold: val } : p))
  }

  useEffect(() => {
    setStockOpeningDate(plant?.stock_opening_date || '')
  }, [plant?.id, plant?.stock_opening_date])

  async function saveStockOpeningDate() {
    setSavingStockDate(true)
    try {
      const { error } = await supabase.from('plants').update({ stock_opening_date: stockOpeningDate || null }).eq('id', plant.id)
      if (error) throw error
      await refreshPlant()
      setEditStockDate(false)
      showToast('Stock opening date saved', 'success')
    } catch (err) {
      console.error('saveStockOpeningDate error:', err)
      showToast('Failed to save date', 'error')
    } finally { setSavingStockDate(false) }
  }


  useEffect(() => {
    if (plant?.location_lat) {
      setLocationLat(plant.location_lat.toString())
      setLocationLng(plant.location_lng?.toString() || '')
    }
  }, [plant?.location_lat])

  async function saveLocation() {
    if (!locationLat || !locationLng) { showToast('Enter both latitude and longitude', 'error'); return }
    setSavingLocation(true)
    try {
      const { error } = await supabase.from('plants').update({
        location_lat: parseFloat(locationLat),
        location_lng: parseFloat(locationLng),
      }).eq('id', plant.id)
      if (error) throw error
      await refreshPlant()
      showToast('Location saved — weather will now show on home screen', 'success')
    } catch (err) {
      console.error('saveLocation error:', err)
      showToast('Failed to save location', 'error')
    } finally { setSavingLocation(false) }
  }

  function captureLocation() {
    if (!navigator.geolocation) { showToast('Geolocation not supported', 'error'); return }
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocationLat(pos.coords.latitude.toFixed(6))
        setLocationLng(pos.coords.longitude.toFixed(6))
        setGettingLocation(false)
        showToast('Location captured — tap Save to apply', 'success')
      },
      () => { showToast('Could not get location', 'error'); setGettingLocation(false) },
      { timeout: 8000 }
    )
  }

  // Load managed type dropdowns for machines & equipment (org-scoped).
  // Seeds sensible defaults the first time an org has none.
  async function loadTypeOptions() {
    const orgId = plant?.org_id
    if (!orgId) return
    let { data: opts } = await supabase
      .from('machine_type_options')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order')
    opts = opts || []
    // Seed defaults per kind if this org has none yet
    const seedRows = []
    if (!opts.some(o => o.kind === 'machine')) {
      DEFAULT_MACHINE_TYPES.forEach((name, i) => seedRows.push({ org_id: orgId, kind: 'machine', name, sort_order: i + 1 }))
    }
    if (!opts.some(o => o.kind === 'equipment')) {
      DEFAULT_EQUIPMENT_TYPES.forEach((name, i) => seedRows.push({ org_id: orgId, kind: 'equipment', name, sort_order: i + 1 }))
    }
    if (seedRows.length) {
      const { data: inserted } = await supabase.from('machine_type_options').insert(seedRows).select()
      if (inserted) opts = [...opts, ...inserted]
    }
    setTypeOptions({
      machine: opts.filter(o => o.kind === 'machine'),
      equipment: opts.filter(o => o.kind === 'equipment'),
    })
  }

  async function addTypeOption(kind) {
    if (!newTypeName.trim()) { showToast('Type name is required', 'error'); return }
    const list = typeOptions[kind] || []
    const { error } = await supabase.from('machine_type_options').insert({
      org_id: plant?.org_id, kind, name: newTypeName.trim(), sort_order: list.length + 1,
    })
    if (error) { showToast('Failed to add type: ' + error.message, 'error'); return }
    showToast('Type added', 'success')
    setNewTypeName('')
    loadTypeOptions()
  }

  async function toggleTypeOption(id, currentActive) {
    const { error } = await supabase.from('machine_type_options').update({ is_active: !currentActive }).eq('id', id)
    if (error) { showToast('Failed to update type', 'error'); return }
    loadTypeOptions()
  }

  async function deleteTypeOption(id) {
    if (!window.confirm('Delete this type permanently?')) return
    const { error } = await supabase.from('machine_type_options').delete().eq('id', id)
    if (error) { showToast('Failed to delete type: ' + error.message, 'error'); return }
    showToast('Type deleted', 'success')
    loadTypeOptions()
  }

  // When another active equipment in this plant already has the same name, require a
  // distinguishing detail (vehicle/gen number, owner, or company) so look-alikes like two
  // "Loader" machines can be told apart, and block an exact duplicate. Not all equipment
  // has a vehicle number, so any one of the three details is enough.
  async function equipDisambiguationError({ name, identifier, owner, company, excludeId }) {
    const nm = (name || '').trim()
    if (!nm) return null
    let q = supabase.from('equipment')
      .select('id, name, identifier, owner, company')
      .eq('plant_id', selectedPlantId)
      .eq('is_active', true)
    if (excludeId) q = q.neq('id', excludeId)
    const { data: rows } = await q
    const norm = v => (v || '').trim().toLowerCase()
    const sameName = (rows || []).filter(e => norm(e.name) === norm(nm))
    if (!sameName.length) return null
    const hasDetail = (identifier || '').trim() || (owner || '').trim() || (company || '').trim()
    if (!hasDetail) return `Another "${nm}" already exists. Add a vehicle/gen number, owner, or company so they can be told apart.`
    const exact = sameName.some(e => norm(e.identifier) === norm(identifier) && norm(e.owner) === norm(owner) && norm(e.company) === norm(company))
    if (exact) return `An identical "${nm}" (same number, owner and company) already exists.`
    return null
  }

  async function saveEquip() {
    if (!equipModal) return
    if (!equipModal.name.trim()) { showToast('Name is required', 'error'); return }
    {
      const disErr = await equipDisambiguationError({ name: equipModal.name, identifier: equipModal.identifier, owner: equipModal.owner, company: equipModal.company, excludeId: equipModal.id })
      if (disErr) { showToast(disErr, 'error'); return }
    }
    const stock = parseFloat(equipModal.stock)
    const hp = parseFloat(equipModal.motorHp)
    setSavingEquip(true)
    try {
      const { error } = await supabase.from('equipment').update({
        name: equipModal.name.trim(),
        equipment_type: (equipModal.type || '').trim() || null,
        owner: (equipModal.owner || '').trim() || null,
        company: (equipModal.company || '').trim() || null,
        identifier: (equipModal.identifier || '').trim() || null,
        fuel_type: (equipModal.fuel || '').trim() || null,
        opening_stock_litres: Number.isNaN(stock) ? null : stock,
        rating: (equipModal.rating || '').trim() || null,
        motor_hp: Number.isNaN(hp) ? null : hp,
      }).eq('id', equipModal.id)
      if (error) throw error
      showToast('Equipment saved', 'success')
      setEquipModal(null)
      loadAllData()
    } catch { showToast('Failed to save equipment', 'error') } finally { setSavingEquip(false) }
  }

  async function savePellet() {
    if (!pelletModal) return
    let g = parseFloat(pelletModal.gcv)
    const open = parseFloat(pelletModal.opening)
    if (!pelletModal.name.trim()) { showToast('Name is required', 'error'); return }
    const recipe = (pelletModal.recipe || [])
      .filter(r => r.material_name && String(r.pct).trim() !== '')
      .map(r => ({ material_name: r.material_name, pct: Number(r.pct) || 0 }))
    // Auto-derive GCV from the recipe (kg-weighted average of ingredient GCVs) when not typed in.
    if (Number.isNaN(g) && recipe.length) {
      const norm = (x) => (x || '').toString().trim().toLowerCase()
      const gcvByName = {}
      for (const rm of (data.raw_material_types || [])) if (rm.gcv_kcal_kg != null) gcvByName[norm(rm.name)] = Number(rm.gcv_kcal_kg)
      let num = 0, den = 0
      for (const r of recipe) { const gv = gcvByName[norm(r.material_name)]; if (gv != null) { num += gv * (Number(r.pct) || 0); den += (Number(r.pct) || 0) } }
      if (den > 0) g = Math.round(num / den)
    }
    const threshold = parseFloat(thresholdDraft) || 3200
    const grade = gradeForGcv(Number.isNaN(g) ? null : g, threshold)
    setSavingPellet(true)
    try {
      const { error } = await supabase.from('pellet_types').update({
        name: pelletModal.name.trim(),
        gcv_kcal_kg: Number.isNaN(g) ? null : g,
        grade,
        opening_stock_mt: Number.isNaN(open) ? null : open,
        recipe: recipe.length ? recipe : null,
      }).eq('id', pelletModal.id)
      if (error) throw error
      showToast('Pellet type saved', 'success')
      setPelletModal(null)
      loadAllData()
    } catch { showToast('Failed to save pellet type', 'error') } finally { setSavingPellet(false) }
  }

  async function loadAllData() {
    setLoading(true)
    const results = {}
    for (const section of SECTIONS) {
      const orderBy = section.hasSort ? 'sort_order' : 'name'
      const { data: items } = await supabase
        .from(section.table)
        .select('*')
        .eq('plant_id', selectedPlantId)
        .order(orderBy)
      results[section.key] = items || []
    }
    setData(results)
    setLoading(false)
  }

  useEffect(() => {
    if (!can(employee?.role, 'plant_settings')) return
    const ctrl = new AbortController()
    supabase
      .from('plants')
      .select('id, name, is_active, gcv_grade_threshold')
      .eq('org_id', plant?.org_id)
      .order('name')
      .then(({ data: orgPlants }) => {
        if (ctrl.signal.aborted) return
        setPlants(orgPlants || [])
        const activePlants = (orgPlants || []).filter(p => p.is_active !== false)
        if (!selectedPlantId && activePlants.length) {
          setSelectedPlantId(activePlants[0].id)
        }
      })
    return () => ctrl.abort()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedPlantId || !can(employee?.role, 'plant_settings')) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        loadTypeOptions()
        const results = {}
        for (const section of SECTIONS) {
          const orderBy = section.hasSort ? 'sort_order' : 'name'
          const { data: items, error } = await supabase
            .from(section.table)
            .select('*')
            .eq('plant_id', selectedPlantId)
            .order(orderBy)
          if (error) console.error(`Failed to load ${section.label}:`, error)
          results[section.key] = items || []
        }
        if (!cancelled) {
          setData(results)
        }

        // Derive pellet recipe ratios from the most recent shift mix per pellet name
        try {
          const { data: mixes } = await supabase
            .from('shift_mixes')
            .select('id, derived_pellet_name, name, type, created_at')
            .eq('plant_id', selectedPlantId)
            .order('created_at', { ascending: false })
          const mixList = mixes || []
          // Keep the most recent mix per pellet name (list already sorted desc)
          const latestByName = {}
          for (const m of mixList) {
            const pname = (m.derived_pellet_name || m.type || m.name || '').trim().toLowerCase()
            if (!pname) continue
            if (!latestByName[pname]) latestByName[pname] = m
          }
          const mixIds = Object.values(latestByName).map(m => m.id)
          const ratios = {}
          const structured = {}
          if (mixIds.length) {
            const { data: comps } = await supabase
              .from('shift_mix_compositions')
              .select('mix_id, raw_material_name, quantity_kg')
              .in('mix_id', mixIds)
            const compsByMix = {}
            for (const c of comps || []) {
              if (!compsByMix[c.mix_id]) compsByMix[c.mix_id] = []
              compsByMix[c.mix_id].push(c)
            }
            for (const [pname, mix] of Object.entries(latestByName)) {
              const list = (compsByMix[mix.id] || []).filter(c => Number(c.quantity_kg) > 0)
              const total = list.reduce((sum, c) => sum + Number(c.quantity_kg || 0), 0)
              if (!total) continue
              const parts = list
                .map(c => ({ material_name: c.raw_material_name, pct: Math.round((Number(c.quantity_kg) / total) * 100) }))
                .sort((a, b) => b.pct - a.pct)
              structured[pname] = parts
              ratios[pname] = parts.map(c => `${c.material_name} ${c.pct}%`).join(' · ')
            }
          }
          if (!cancelled) { setPelletRatios(ratios); setPelletRecipesStructured(structured) }
        } catch (mixErr) {
          console.error('Failed to derive pellet ratios:', mixErr)
        }
      } catch (err) {
        console.error('Error loading admin data:', err)
        if (!cancelled) showToast('Failed to load plant settings', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [selectedPlantId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!can(employee?.role, 'plant_settings')) {
    return (
      <div style={{ minHeight: '100vh', background: '#fefae0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#595c4a', fontSize: 14 }}>You don't have access to Plant Settings.</p>
      </div>
    )
  }

  async function addItem(sectionKey) {
    if (!newItemName.trim()) {
      showToast('Name is required', 'error')
      return
    }
    if (busy) return
    setBusy(true)
    const section = SECTIONS.find(s => s.key === sectionKey)
    const payload = { plant_id: selectedPlantId, name: newItemName.trim(), is_active: true }
    if (section.hasSort) {
      const existing = data[sectionKey] || []
      payload.sort_order = existing.length + 1
    }
    // Machines: type (managed dropdown) + production/hr (MT) + motor HP
    if (sectionKey === 'machines') {
      const cap = parseFloat(newItemCapacity)
      const hp = parseFloat(newItemMotorHp)
      payload.machine_type = newItemType.trim() || null
      payload.capacity_mt_per_hour = Number.isNaN(cap) ? null : cap
      payload.motor_hp = Number.isNaN(hp) ? null : hp
    }
    // Equipment: type (managed dropdown) + fuel_type + rating + optional motor HP.
    // Equipment does NOT produce MT/hr — capacity_mt_per_hour is not surfaced.
    if (sectionKey === 'equipment') {
      const hp = parseFloat(newItemMotorHp)
      const litres = parseFloat(newItemStock)
      payload.equipment_type = newItemType.trim() || null
      payload.fuel_type = newItemFuel.trim() || null
      payload.rating = newItemRating.trim() || null
      payload.identifier = newItemIdentifier.trim() || null
      payload.owner = newItemOwner.trim() || null
      payload.company = newItemCompany.trim() || null
      payload.motor_hp = Number.isNaN(hp) ? null : hp
      payload.opening_stock_litres = Number.isNaN(litres) ? 0 : litres
    }
    // Raw material types: GCV (newItemType field) + opening stock
    if (sectionKey === 'raw_material_types') {
      const g = parseFloat(newItemType)
      payload.gcv_kcal_kg = Number.isNaN(g) ? null : g
      const stockMt = parseFloat(newItemStock)
      payload.opening_stock_kg = Number.isNaN(stockMt) ? 0 : mtToKg(stockMt)
      payload.source = newItemSource || 'purchased'
    }
    if (sectionKey === 'equipment') {
      const disErr = await equipDisambiguationError({ name: newItemName, identifier: newItemIdentifier, owner: newItemOwner, company: newItemCompany })
      if (disErr) { showToast(disErr, 'error'); setBusy(false); return }
    }
    const { error } = await supabase.from(section.table).insert(payload)
    setBusy(false)
    if (error) {
      showToast('Failed to add: ' + error.message, 'error')
      return
    }
    showToast(`${section.singular} added`, 'success')
    setNewItemName('')
    setNewItemType('')
    setNewItemCapacity('')
    setNewItemMotorHp('')
    setNewItemStock('')
    setNewItemSource('purchased')
    setNewItemFuel('')
    setNewItemRating('')
    setNewItemIdentifier('')
    setNewItemOwner('')
    setNewItemCompany('')
    setAddingTo(null)
    loadAllData()
  }

  async function updateItem(sectionKey, id, newName) {
    const section = SECTIONS.find(s => s.key === sectionKey)
    const payload = { name: newName }
    if (sectionKey === 'raw_material_types') {
      const g = parseFloat(editingItem?.gcv)
      payload.gcv_kcal_kg = Number.isNaN(g) ? null : g
      const stockMt = parseFloat(editingItem?.stock)
      payload.opening_stock_kg = Number.isNaN(stockMt) ? 0 : mtToKg(stockMt)
      payload.source = editingItem?.source || 'purchased'
    }
    if (sectionKey === 'machines') {
      const cap = parseFloat(editingItem?.capacity)
      const hp = parseFloat(editingItem?.motorHp)
      payload.machine_type = (editingItem?.type || '').trim() || null
      payload.capacity_mt_per_hour = Number.isNaN(cap) ? null : cap
      payload.motor_hp = Number.isNaN(hp) ? null : hp
    }
    if (sectionKey === 'equipment') {
      const hp = parseFloat(editingItem?.motorHp)
      const litres = parseFloat(editingItem?.stock)
      payload.equipment_type = (editingItem?.type || '').trim() || null
      payload.fuel_type = (editingItem?.fuel || '').trim() || null
      payload.rating = (editingItem?.rating || '').trim() || null
      payload.identifier = (editingItem?.identifier || '').trim() || null
      payload.owner = (editingItem?.owner || '').trim() || null
      payload.company = (editingItem?.company || '').trim() || null
      payload.motor_hp = Number.isNaN(hp) ? null : hp
      payload.opening_stock_litres = Number.isNaN(litres) ? 0 : litres
    }
    if (sectionKey === 'equipment') {
      const disErr = await equipDisambiguationError({ name: newName, identifier: editingItem?.identifier, owner: editingItem?.owner, company: editingItem?.company, excludeId: id })
      if (disErr) { showToast(disErr, 'error'); return }
    }
    const { error } = await supabase.from(section.table).update(payload).eq('id', id)
    if (error) {
      showToast('Failed to update', 'error')
      return
    }
    showToast('Updated', 'success')
    setEditingItem(null)
    loadAllData()
  }

  async function toggleActive(sectionKey, id, currentActive) {
    const section = SECTIONS.find(s => s.key === sectionKey)
    const { error } = await supabase.from(section.table).update({ is_active: !currentActive }).eq('id', id)
    if (error) {
      showToast('Failed to update', 'error')
      return
    }
    showToast(currentActive ? 'Deactivated' : 'Activated', 'success')
    loadAllData()
  }

  function toggleSection(key) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function addPlant() {
    if (!newPlantName.trim()) {
      showToast('Plant name is required', 'error')
      return
    }
    if (busy) return
    setBusy(true)
    const { data: newPlant, error } = await supabase
      .from('plants')
      .insert({ org_id: plant?.org_id, name: newPlantName.trim(), code: newPlantName.trim().toLowerCase().replace(/\s+/g, '-') })
      .select()
      .single()
    setBusy(false)
    if (error) {
      showToast('Failed to add plant: ' + error.message, 'error')
      return
    }
    showToast('Plant added', 'success')
    setNewPlantName('')
    setAddingPlant(false)
    setPlants(prev => [...prev, { id: newPlant.id, name: newPlant.name }].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedPlantId(newPlant.id)
  }

  async function archivePlant(plantId) {
    const plantName = plants.find(p => p.id === plantId)?.name || 'this plant'
    if (!window.confirm(`Archive "${plantName}"?\n\nIt will be hidden from all dropdowns and reports. You can restore it later from "Show archived".`)) return
    const { error } = await supabase.from('plants').update({ is_active: false }).eq('id', plantId)
    if (error) { showToast('Failed to archive plant', 'error'); return }
    showToast(`"${plantName}" archived`, 'success')
    setPlants(prev => prev.map(p => p.id === plantId ? { ...p, is_active: false } : p))
    // Switch to first active plant
    const remaining = plants.filter(p => p.id !== plantId && p.is_active !== false)
    setSelectedPlantId(remaining[0]?.id || '')
  }

  async function restorePlant(plantId) {
    const plantName = plants.find(p => p.id === plantId)?.name || 'this plant'
    const { error } = await supabase.from('plants').update({ is_active: true }).eq('id', plantId)
    if (error) { showToast('Failed to restore plant', 'error'); return }
    showToast(`"${plantName}" restored`, 'success')
    setPlants(prev => prev.map(p => p.id === plantId ? { ...p, is_active: true } : p))
    setSelectedPlantId(plantId)
  }

  const selectedPlantName = plants.find(p => p.id === selectedPlantId)?.name || 'Plant'
  const visiblePlants = plants.filter(p => showArchived ? true : p.is_active !== false)
  const archivedCount = plants.filter(p => p.is_active === false).length

  return (
    <div style={{ minHeight: '100%', background: '#fefae0', paddingBottom: 80 }}>
      <PageHeader title="Plant Settings" subtitle={`Admin · ${selectedPlantName}`} backTo="/settings" />

      {/* Plant Selector */}
      <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e5ddd0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a' }}>Select Plant</label>
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(prev => !prev)}
              style={{ fontSize: 11, color: showArchived ? '#d32f2f' : '#8a8d7a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              {showArchived ? `Hide archived` : `Show archived (${archivedCount})`}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={selectedPlantId}
            onChange={e => setSelectedPlantId(e.target.value)}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', background: '#fefae0' }}
          >
            {visiblePlants.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.is_active === false ? ' (archived)' : ''}
              </option>
            ))}
          </select>
          {/* Archive / Restore button for selected plant */}
          {selectedPlantId && (() => {
            const sel = plants.find(p => p.id === selectedPlantId)
            if (!sel) return null
            return sel.is_active === false ? (
              <button
                onClick={() => restorePlant(selectedPlantId)}
                title="Restore plant"
                style={{ padding: '10px 12px', background: '#e8f5e9', color: '#2d6a4f', borderRadius: 12, border: '1.5px solid #b8d4c4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
              >
                <RotateCcw size={14} /> Restore
              </button>
            ) : (
              <button
                onClick={() => archivePlant(selectedPlantId)}
                title="Archive plant"
                style={{ padding: '10px 12px', background: '#fff8e1', color: '#b45309', borderRadius: 12, border: '1.5px solid #f0d9a0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
              >
                <Archive size={14} /> Archive
              </button>
            )
          })()}
        </div>
        {addingPlant ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="text"
              placeholder="New plant name"
              value={newPlantName}
              onChange={e => setNewPlantName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPlant()}
              autoFocus
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none' }}
            />
            <button onClick={addPlant} disabled={busy} style={{ padding: '8px 12px', background: '#2d6a4f', color: 'white', borderRadius: 8, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: busy ? 0.6 : 1 }}>Add</button>
            <button onClick={() => { setAddingPlant(false); setNewPlantName('') }} style={{ padding: '8px 12px', background: '#fefae0', color: '#595c4a', borderRadius: 8, border: '1px solid #e5ddd0', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingPlant(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 8, padding: '8px 0', background: 'transparent', border: '1.5px dashed #b8d4c4', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2d6a4f' }}
          >
            <Plus size={14} /> Add New Plant
          </button>
        )}
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#595c4a', fontSize: 14 }}>Loading...</div>
        ) : (
          SECTIONS.map(section => {
            const items = data[section.key] || []
            const isExpanded = expandedSections[section.key]

            return (
              <div key={section.key} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.key)}
                  style={{
                    width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>{section.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a', background: '#fefae0', padding: '2px 8px', borderRadius: 6 }}>
                      {items.filter(i => i.is_active !== false).length}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp size={18} color="#8a8d7a" /> : <ChevronDown size={18} color="#8a8d7a" />}
                </button>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f0ebe0' }}>
                    {/* Managed type dropdown manager (machines / equipment) */}
                    {(section.key === 'machines' || section.key === 'equipment') && (() => {
                      const kind = section.key === 'machines' ? 'machine' : 'equipment'
                      const isOpen = managingTypes === kind
                      const list = typeOptions[kind] || []
                      return (
                        <div style={{ borderBottom: '1px solid #f0ebe0', background: '#faf7ec' }}>
                          <button
                            onClick={() => { setManagingTypes(isOpen ? null : kind); setNewTypeName('') }}
                            style={{ width: '100%', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2d6a4f' }}
                          >
                            <span>+ Manage {section.key === 'machines' ? 'Machine' : 'Equipment'} Types</span>
                            {isOpen ? <ChevronUp size={14} color="#8a8d7a" /> : <ChevronDown size={14} color="#8a8d7a" />}
                          </button>
                          {isOpen && (
                            <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {list.map(o => (
                                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: o.is_active === false ? 0.5 : 1 }}>
                                  <span style={{ flex: 1, fontSize: 12, color: '#2c2c2c' }}>{o.name}</span>
                                  <button
                                    onClick={() => toggleTypeOption(o.id, o.is_active !== false)}
                                    style={{ padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600, background: o.is_active !== false ? '#DCFCE7' : '#FEE2E2', color: o.is_active !== false ? '#15803D' : '#DC2626' }}
                                  >
                                    {o.is_active !== false ? 'Active' : 'Enable'}
                                  </button>
                                  <button
                                    onClick={() => deleteTypeOption(o.id)}
                                    title="Delete this type permanently"
                                    style={{ padding: '3px 6px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center' }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ))}
                              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                                <input
                                  type="text"
                                  placeholder="New type name"
                                  value={newTypeName}
                                  onChange={e => setNewTypeName(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && addTypeOption(kind)}
                                  style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 12, outline: 'none', minWidth: 0 }}
                                />
                                <button
                                  onClick={() => addTypeOption(kind)}
                                  style={{ padding: '7px 12px', background: '#2d6a4f', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                  <Plus size={13} /> Add
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    {/* Items */}
                    {items.map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                          flexWrap: 'wrap',
                          borderBottom: '1px solid #f5f0e1',
                          opacity: item.is_active === false ? 0.5 : 1,
                        }}
                      >
                        {editingItem?.section === section.key && editingItem?.id === item.id ? (
                          <>
                            <input
                              type="text"
                              value={editingItem.name}
                              onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                              autoFocus
                              style={{ flex: '0 1 170px', padding: '6px 9px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none', minWidth: 90, maxWidth: 170 }}
                            />
                            {section.key === 'raw_material_types' && (
                              <input
                                type="number"
                                inputMode="decimal"
                                placeholder="kcal/kg"
                                value={editingItem.gcv}
                                onChange={e => setEditingItem({ ...editingItem, gcv: e.target.value })}
                                title="GCV (kcal/kg)"
                                style={{ width: 84, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                              />
                            )}
                            {section.key === 'raw_material_types' && (
                              <input
                                type="number"
                                inputMode="decimal"
                                placeholder="Opening MT"
                                value={editingItem.stock}
                                onChange={e => setEditingItem({ ...editingItem, stock: e.target.value })}
                                title="Opening stock (kg)"
                                style={{ width: 90, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                              />
                            )}
                            {section.key === 'raw_material_types' && (
                              <select
                                value={editingItem.source || 'purchased'}
                                onChange={e => setEditingItem({ ...editingItem, source: e.target.value })}
                                title="Source"
                                style={{ width: 110, padding: '6px 6px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                              >
                                <option value="in_house">In-house</option>
                                <option value="purchased">Purchased</option>
                                <option value="both">Both</option>
                              </select>
                            )}
                            {section.key === 'machines' && (
                              <>
                                <select
                                  value={editingItem.type}
                                  onChange={e => setEditingItem({ ...editingItem, type: e.target.value })}
                                  title="Machine type"
                                  style={{ width: 110, padding: '6px 6px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                                >
                                  <option value="">Type…</option>
                                  {(typeOptions.machine || []).filter(o => o.is_active !== false || o.name === editingItem.type).map(o => (
                                    <option key={o.id} value={o.name}>{o.name}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  placeholder="MT/hr"
                                  value={editingItem.capacity}
                                  onChange={e => setEditingItem({ ...editingItem, capacity: e.target.value })}
                                  title="Production per hour (MT)"
                                  style={{ width: 74, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                                />
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  placeholder="HP"
                                  value={editingItem.motorHp}
                                  onChange={e => setEditingItem({ ...editingItem, motorHp: e.target.value })}
                                  title="Motor HP"
                                  style={{ width: 60, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                                />
                              </>
                            )}
                            {section.key === 'equipment' && (
                              <>
                                <input
                                  type="text"
                                  placeholder="Vehicle / Gen no"
                                  value={editingItem.identifier}
                                  onChange={e => setEditingItem({ ...editingItem, identifier: e.target.value })}
                                  title="Vehicle number / Generator number (optional)"
                                  style={{ width: 96, padding: '6px 7px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                                />
                                <input
                                  type="text"
                                  placeholder="Owner"
                                  value={editingItem.owner}
                                  onChange={e => setEditingItem({ ...editingItem, owner: e.target.value })}
                                  title="Owner name (optional)"
                                  style={{ width: 84, padding: '6px 7px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                                />
                                <input
                                  type="text"
                                  placeholder="Company"
                                  value={editingItem.company}
                                  onChange={e => setEditingItem({ ...editingItem, company: e.target.value })}
                                  title="Company / make (optional)"
                                  style={{ width: 90, padding: '6px 7px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                                />
                                <select
                                  value={editingItem.type}
                                  onChange={e => setEditingItem({ ...editingItem, type: e.target.value })}
                                  title="Equipment type"
                                  style={{ width: 92, padding: '6px 6px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                                >
                                  <option value="">Type…</option>
                                  {(typeOptions.equipment || []).filter(o => o.is_active !== false || o.name === editingItem.type).map(o => (
                                    <option key={o.id} value={o.name}>{o.name}</option>
                                  ))}
                                </select>
                                <select
                                  value={editingItem.fuel}
                                  onChange={e => setEditingItem({ ...editingItem, fuel: e.target.value })}
                                  title="Fuel type"
                                  style={{ width: 76, padding: '6px 6px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                                >
                                  <option value="">Fuel…</option>
                                  {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  placeholder="Opening (L)"
                                  value={editingItem.stock}
                                  onChange={e => setEditingItem({ ...editingItem, stock: e.target.value })}
                                  title="Opening stock (litres) — as of the stock opening date"
                                  style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                                />
                                <input
                                  type="text"
                                  placeholder="Rating"
                                  value={editingItem.rating}
                                  onChange={e => setEditingItem({ ...editingItem, rating: e.target.value })}
                                  title="Rating (e.g. 125 kVA)"
                                  style={{ width: 72, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                                />
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  placeholder="HP"
                                  value={editingItem.motorHp}
                                  onChange={e => setEditingItem({ ...editingItem, motorHp: e.target.value })}
                                  title="Motor HP (optional)"
                                  style={{ width: 56, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                                />
                              </>
                            )}
                            <button
                              onClick={() => updateItem(section.key, item.id, editingItem.name)}
                              style={{ padding: '4px 8px', background: '#2d6a4f', color: 'white', borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingItem(null)}
                              style={{ padding: '4px 8px', background: '#fefae0', color: '#595c4a', borderRadius: 6, border: '1px solid #e5ddd0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: '#2c2c2c' }}>{item.name}</span>
                              {section.key === 'machines' && (() => {
                                const parts = []
                                if (item.machine_type) parts.push(item.machine_type)
                                if (item.capacity_mt_per_hour != null) parts.push(`${item.capacity_mt_per_hour} MT/hr`)
                                if (item.motor_hp != null) parts.push(`${item.motor_hp} HP`)
                                if (!parts.length) return null
                                return <span style={{ fontSize: 11, color: '#8a8d7a' }}>{parts.join(' · ')}</span>
                              })()}
                              {section.key === 'equipment' && (() => {
                                const parts = []
                                if (item.identifier) parts.push(item.identifier)
                                if (item.owner) parts.push('Owner: ' + item.owner)
                                if (item.company) parts.push(item.company)
                                if (item.equipment_type) parts.push(item.equipment_type)
                                if (item.fuel_type) parts.push(item.fuel_type)
                                if (item.rating) parts.push(item.rating)
                                if (item.motor_hp != null) parts.push(`${item.motor_hp} HP`)
                                if (!parts.length) return null
                                return <span style={{ fontSize: 11, color: '#8a8d7a' }}>{parts.join(' · ')}</span>
                              })()}
                              {section.key === 'raw_material_types' && (() => {
                                const label = item.source === 'in_house' ? 'In-house' : item.source === 'both' ? 'Both' : 'Purchased'
                                return <span style={{ fontSize: 11, color: '#8a8d7a' }}>{`\u00b7 ${label}`}</span>
                              })()}
                              {section.key === 'pellet_types' && (() => {
                                const setRatio = Array.isArray(item.recipe) && item.recipe.length
                                  ? item.recipe.map(r => `${r.material_name} ${r.pct}%`).join(' · ')
                                  : null
                                const ratio = setRatio || pelletRatios[(item.name || '').trim().toLowerCase()]
                                return <span style={{ fontSize: 11, color: ratio ? '#2d6a4f' : '#8a8d7a', fontStyle: ratio ? 'normal' : 'italic' }}>{ratio || 'recipe not set yet'}</span>
                              })()}
                            </div>
                            {section.key === 'raw_material_types' && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: item.gcv_kcal_kg != null ? '#2d6a4f' : '#8a8d7a', background: '#fefae0', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                                {item.gcv_kcal_kg != null ? `${item.gcv_kcal_kg} kcal/kg` : 'GCV not set'}
                              </span>
                            )}
                            {section.key === 'raw_material_types' && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a', background: '#fefae0', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                                {`Open ${kgToMtStr(item.opening_stock_kg)} MT`}
                              </span>
                            )}
                            {section.key === 'equipment' && Number(item.opening_stock_litres) > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a', background: '#fefae0', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                                {`Open ${Number(item.opening_stock_litres)} L`}
                              </span>
                            )}
                            {section.key === 'pellet_types' && item.grade && (
                              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap', background: item.grade === 'High GCV' ? '#2d6a4f' : '#fef3c7', color: item.grade === 'High GCV' ? '#fff' : '#b45309' }}>
                                {item.grade}
                              </span>
                            )}
                            {section.key === 'pellet_types' && Number(item.opening_stock_mt) > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a', background: '#fefae0', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                                {`Open ${Number(item.opening_stock_mt)} MT`}
                              </span>
                            )}
                            {item.is_active === false && (
                              <span style={{ fontSize: 10, color: '#d32f2f', fontWeight: 600 }}>Inactive</span>
                            )}
                            <button
                              onClick={() => {
                                if (section.key === 'pellet_types') {
                                  setPelletModal({ id: item.id, name: item.name || '', gcv: item.gcv_kcal_kg ?? '', opening: item.opening_stock_mt ?? '', recipe: (Array.isArray(item.recipe) && item.recipe.length) ? item.recipe.map(r => ({ ...r })) : (pelletRecipesStructured[(item.name || '').trim().toLowerCase()] || []).map(r => ({ ...r })) })
                                } else if (section.key === 'equipment') {
                                  setEquipModal({ id: item.id, name: item.name || '', type: item.equipment_type || '', owner: item.owner || '', company: item.company || '', identifier: item.identifier || '', fuel: item.fuel_type || '', stock: item.opening_stock_litres ?? '', rating: item.rating || '', motorHp: item.motor_hp ?? '' })
                                } else {
                                  setEditingItem({ section: section.key, id: item.id, name: item.name, gcv: item.gcv_kcal_kg ?? '', stock: (section.key === 'equipment' ? (item.opening_stock_litres ?? '') : (item.opening_stock_kg != null ? kgToMt(item.opening_stock_kg) : '')), source: item.source ?? 'purchased', type: (item.machine_type ?? item.equipment_type ?? ''), capacity: item.capacity_mt_per_hour ?? '', motorHp: item.motor_hp ?? '', fuel: item.fuel_type ?? '', rating: item.rating ?? '', identifier: item.identifier ?? '', owner: item.owner ?? '', company: item.company ?? '' })
                                }
                              }}
                              style={{ padding: '4px 8px', background: '#fefae0', borderRadius: 6, border: '1px solid #e5ddd0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                              <Edit3 size={12} color="#595c4a" />
                            </button>
                            <button
                              onClick={() => toggleActive(section.key, item.id, item.is_active !== false)}
                              style={{
                                padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                                background: item.is_active !== false ? '#DCFCE7' : '#FEE2E2',
                                color: item.is_active !== false ? '#15803D' : '#DC2626',
                              }}
                            >
                              {item.is_active !== false ? 'Active' : 'Enable'}
                            </button>
                          </>
                        )}
                      </div>
                    ))}

                    {/* Add new item */}
                    {addingTo === section.key ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="text"
                            placeholder={`New ${section.singular.toLowerCase()} name`}
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addItem(section.key)}
                            autoFocus
                            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none', minWidth: 0 }}
                          />
                          <button
                            onClick={() => addItem(section.key)}
                            disabled={busy}
                            style={{ padding: '8px 12px', background: '#2d6a4f', color: 'white', borderRadius: 8, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: busy ? 0.6 : 1 }}
                          >
                            Add
                          </button>
                          <button
                            onClick={() => { setAddingTo(null); setNewItemName(''); setNewItemType(''); setNewItemCapacity(''); setNewItemMotorHp(''); setNewItemStock('') }}
                            style={{ padding: '8px 12px', background: '#fefae0', color: '#595c4a', borderRadius: 8, border: '1px solid #e5ddd0', cursor: 'pointer', fontSize: 12 }}
                          >
                            Cancel
                          </button>
                        </div>
                        {section.key === 'machines' && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <select
                              value={newItemType}
                              onChange={e => setNewItemType(e.target.value)}
                              title="Machine type"
                              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', minWidth: 0, background: '#fff' }}
                            >
                              <option value="">Machine type…</option>
                              {(typeOptions.machine || []).filter(o => o.is_active !== false).map(o => (
                                <option key={o.id} value={o.name}>{o.name}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              inputMode="decimal"
                              placeholder="MT/hr"
                              value={newItemCapacity}
                              onChange={e => setNewItemCapacity(e.target.value)}
                              title="Production per hour (MT)"
                              style={{ width: 84, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                            />
                            <input
                              type="number"
                              inputMode="decimal"
                              placeholder="HP"
                              value={newItemMotorHp}
                              onChange={e => setNewItemMotorHp(e.target.value)}
                              title="Motor HP"
                              style={{ width: 70, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                        )}
                        {section.key === 'equipment' && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input
                              type="text"
                              placeholder="Vehicle / Generator no (optional)"
                              value={newItemIdentifier}
                              onChange={e => setNewItemIdentifier(e.target.value)}
                              title="Vehicle number / Generator number"
                              style={{ flex: '1 1 45%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', minWidth: 0 }}
                            />
                            <input
                              type="text"
                              placeholder="Owner (optional)"
                              value={newItemOwner}
                              onChange={e => setNewItemOwner(e.target.value)}
                              title="Owner name"
                              style={{ flex: '1 1 45%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', minWidth: 0 }}
                            />
                            <input
                              type="text"
                              placeholder="Company / make (optional)"
                              value={newItemCompany}
                              onChange={e => setNewItemCompany(e.target.value)}
                              title="Company / manufacturer"
                              style={{ flex: '1 1 45%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', minWidth: 0 }}
                            />
                            <select
                              value={newItemType}
                              onChange={e => setNewItemType(e.target.value)}
                              title="Equipment type"
                              style={{ flex: '1 1 45%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', minWidth: 0, background: '#fff' }}
                            >
                              <option value="">Equipment type…</option>
                              {(typeOptions.equipment || []).filter(o => o.is_active !== false).map(o => (
                                <option key={o.id} value={o.name}>{o.name}</option>
                              ))}
                            </select>
                            <select
                              value={newItemFuel}
                              onChange={e => setNewItemFuel(e.target.value)}
                              title="Fuel type"
                              style={{ flex: '1 1 45%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', minWidth: 0, background: '#fff' }}
                            >
                              <option value="">Fuel type…</option>
                              {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                            <input
                              type="number"
                              inputMode="decimal"
                              placeholder="Opening Stock (litres)"
                              value={newItemStock}
                              onChange={e => setNewItemStock(e.target.value)}
                              title="Opening stock (litres) — as of the stock opening date"
                              style={{ flex: '1 1 45%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', boxSizing: 'border-box', minWidth: 0 }}
                            />
                            <input
                              type="text"
                              placeholder="Rating (e.g. 125 kVA)"
                              value={newItemRating}
                              onChange={e => setNewItemRating(e.target.value)}
                              title="Rating"
                              style={{ flex: '1 1 45%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', minWidth: 0 }}
                            />
                            <input
                              type="number"
                              inputMode="decimal"
                              placeholder="HP (optional)"
                              value={newItemMotorHp}
                              onChange={e => setNewItemMotorHp(e.target.value)}
                              title="Motor HP (optional)"
                              style={{ flex: '1 1 45%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', boxSizing: 'border-box', minWidth: 0 }}
                            />
                          </div>
                        )}
                        {section.key === 'raw_material_types' && (
                          <>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input
                                type="number"
                                inputMode="decimal"
                                placeholder="GCV (kcal/kg)"
                                value={newItemType}
                                onChange={e => setNewItemType(e.target.value)}
                                title="GCV (kcal/kg)"
                                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', minWidth: 0 }}
                              />
                              <input
                                type="number"
                                inputMode="decimal"
                                placeholder="Opening stock (MT)"
                                value={newItemStock}
                                onChange={e => setNewItemStock(e.target.value)}
                                title="Opening stock (kg)"
                                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', minWidth: 0 }}
                              />
                            </div>
                            <select
                              value={newItemSource}
                              onChange={e => setNewItemSource(e.target.value)}
                              title="Source"
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#2c2c2c' }}
                            >
                              <option value="in_house">Source: In-house</option>
                              <option value="purchased">Source: Purchased</option>
                              <option value="both">Source: Both</option>
                            </select>
                            <div style={{ fontSize: 11, color: '#8a8d7a' }}>Stock already on hand before app usage began. Used as opening for the first shift report.</div>
                          </>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingTo(section.key); setNewItemName('') }}
                        style={{
                          width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          background: '#fefae0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2d6a4f',
                        }}
                      >
                        <Plus size={14} /> Add {section.singular}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Process Routes (assembly lines) — plant-scoped */}
        {!loading && selectedPlantId && (
          <ProcessRoutes plantId={selectedPlantId} orgId={plant?.org_id} />
        )}

        {/* Land plots for this plant */}
        {!loading && selectedPlantId && (
          <PlantPlots plantId={selectedPlantId} />
        )}

        {/* GCV grade threshold — compact chip + Edit (matches Stock Opening Date) */}
        {!editThreshold ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2c2c2c' }}>GCV grade threshold</div>
              <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 2 }}>{thresholdDraft || 3200} kcal/kg · mixes at or above are High GCV</div>
            </div>
            <button onClick={() => setEditThreshold(true)} style={{ padding: '7px 14px', background: '#fff', color: '#2d6a4f', borderRadius: 9, border: '1.5px solid #b8d4c4', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '14px 16px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 2 }}>GCV Grade Threshold</div>
            <div style={{ fontSize: 12, color: '#8a8d7a', marginBottom: 10 }}>Mixes at or above this GCV are graded High GCV</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="number" inputMode="decimal" value={thresholdDraft} onChange={e => setThresholdDraft(e.target.value)} placeholder="3200" style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', minWidth: 120, boxSizing: 'border-box' }} />
              <span style={{ fontSize: 12, color: '#8a8d7a', whiteSpace: 'nowrap' }}>kcal/kg</span>
              <button onClick={saveThreshold} disabled={savingThreshold} style={{ padding: '10px 16px', background: '#2d6a4f', color: 'white', borderRadius: 10, border: 'none', cursor: savingThreshold ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: savingThreshold ? 0.6 : 1 }}>{savingThreshold ? 'Saving...' : 'Save'}</button>
              <button onClick={() => setEditThreshold(false)} style={{ padding: '10px 14px', background: '#fefae0', color: '#595c4a', borderRadius: 10, border: '1px solid #e5ddd0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Stock Opening (as-of) date — locked after first set to avoid accidental edits */}
        {(() => {
          const isSet = !!stockOpeningDate
          const editing = editStockDate || !isSet
          const pretty = isSet ? stockOpeningDate.split('-').reverse().join('/') : ''
          if (!editing) {
            return (
              <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2c2c2c' }}>Stock opening date</div>
                  <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 2 }}>{pretty} · opening figures are as of this day</div>
                </div>
                <button onClick={() => setEditStockDate(true)} style={{ padding: '7px 14px', background: '#fff', color: '#2d6a4f', borderRadius: 9, border: '1.5px solid #b8d4c4', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
              </div>
            )
          }
          return (
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '14px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 2 }}>Stock Opening Date</div>
              <div style={{ fontSize: 12, color: '#8a8d7a', marginBottom: 10 }}>The opening stock figures are the physical stock as of this date's shift start. Purchases dated before it are already inside the opening (not double-counted). Set this to the day you switched from paper to the app.</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>As-of date</label>
                  <input type="date" value={stockOpeningDate || ''} onChange={e => setStockOpeningDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <button onClick={saveStockOpeningDate} disabled={savingStockDate} style={{ padding: '10px 16px', background: '#2d6a4f', color: 'white', borderRadius: 10, border: 'none', cursor: savingStockDate ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: savingStockDate ? 0.6 : 1 }}>{savingStockDate ? 'Saving...' : 'Save'}</button>
                {isSet && <button onClick={() => { setStockOpeningDate(plant?.stock_opening_date || ''); setEditStockDate(false) }} style={{ padding: '10px 14px', background: '#fefae0', color: '#595c4a', borderRadius: 10, border: '1px solid #e5ddd0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>}
              </div>
            </div>
          )
        })()}

        {/* Plant Location — for weather feature */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
          <button
            onClick={() => setShowLocation(o => !o)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>🌤️</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c' }}>Plant Location</div>
                <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 1 }}>
                  {plant?.location_lat ? `${Number(plant.location_lat).toFixed(4)}, ${Number(plant.location_lng).toFixed(4)}` : 'Not set — needed for weather on home screen'}
                </div>
              </div>
            </div>
            <span style={{ fontSize: 12, color: '#8a8d7a' }}>{showLocation ? '▲' : '▼'}</span>
          </button>

          {showLocation && (
            <div style={{ borderTop: '1px solid #f0ebe0', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Latitude</label>
                  <input type="number" step="0.000001" placeholder="e.g. 25.4358" value={locationLat}
                    onChange={e => setLocationLat(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', background: '#fefae0', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Longitude</label>
                  <input type="number" step="0.000001" placeholder="e.g. 81.8463" value={locationLng}
                    onChange={e => setLocationLng(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', background: '#fefae0', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={captureLocation} disabled={gettingLocation}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 12, fontWeight: 600, color: '#2d6a4f', cursor: 'pointer' }}>
                  {gettingLocation ? 'Getting...' : '📍 Use My Location'}
                </button>
                <button onClick={saveLocation} disabled={savingLocation}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: '#2d6a4f', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: savingLocation ? 0.6 : 1 }}>
                  {savingLocation ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

      {pelletModal && (() => {
        const rms = (data.raw_material_types || []).filter(m => m.is_active !== false)
        const total = (pelletModal.recipe || []).reduce((a, r) => a + (Number(r.pct) || 0), 0)
        const setRecipe = (rec) => setPelletModal(pm => ({ ...pm, recipe: rec }))
        return (
          <div onClick={() => !savingPellet && setPelletModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, maxHeight: '88vh', overflowY: 'auto', background: '#fefae0', borderRadius: 16, padding: '18px 18px 22px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1b4332' }}>Edit Pellet Type</div>
                <button onClick={() => setPelletModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a8d7a' }}><X size={20} /></button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', marginBottom: 5 }}>Name</div>
                <input value={pelletModal.name} onChange={e => setPelletModal(pm => ({ ...pm, name: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', marginBottom: 5 }}>GCV (kcal/kg)</div>
                  <input type="number" inputMode="decimal" value={pelletModal.gcv} onChange={e => setPelletModal(pm => ({ ...pm, gcv: e.target.value }))} placeholder="optional" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', marginBottom: 5 }}>Opening stock (MT)</div>
                  <input type="number" inputMode="decimal" value={pelletModal.opening} onChange={e => setPelletModal(pm => ({ ...pm, opening: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a' }}>Mix recipe (default ratio)</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: total === 100 ? '#2d6a4f' : '#b45309' }}>{total}%</span>
              </div>
              <div style={{ fontSize: 11, color: '#8a8d7a', marginBottom: 8, lineHeight: 1.4 }}>Saved as the default recipe for this pellet (shown on the pellet). Actual usage still comes from the shift mix you build.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {(pelletModal.recipe || []).map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={r.material_name || ''} onChange={e => { const rec = [...pelletModal.recipe]; rec[i] = { ...rec[i], material_name: e.target.value }; setRecipe(rec) }} style={{ flex: 1, padding: '9px 8px', borderRadius: 9, border: '1.5px solid #e5ddd0', fontSize: 13, background: '#fff', outline: 'none' }}>
                      <option value="">Material…</option>
                      {rms.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                    <input type="number" inputMode="decimal" value={r.pct} onChange={e => { const rec = [...pelletModal.recipe]; rec[i] = { ...rec[i], pct: e.target.value }; setRecipe(rec) }} placeholder="%" style={{ width: 66, padding: '9px 8px', borderRadius: 9, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    <button onClick={() => setRecipe(pelletModal.recipe.filter((_, x) => x !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', padding: 4 }}><X size={16} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setRecipe([...(pelletModal.recipe || []), { material_name: '', pct: '' }])} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', background: '#fff', border: '1.5px solid #b8d4c4', borderRadius: 9, color: '#2d6a4f', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
                <Plus size={13} /> Add material
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setPelletModal(null)} style={{ flex: 1, padding: '12px 0', background: '#fff', color: '#595c4a', borderRadius: 11, border: '1.5px solid #e5ddd0', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button onClick={savePellet} disabled={savingPellet} style={{ flex: 1, padding: '12px 0', background: savingPellet ? '#c3d2c9' : '#2d6a4f', color: '#fff', borderRadius: 11, border: 'none', fontSize: 14, fontWeight: 700, cursor: savingPellet ? 'default' : 'pointer' }}>{savingPellet ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )
      })()}

      {equipModal && (
        <div onClick={() => !savingEquip && setEquipModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, maxHeight: '88vh', overflowY: 'auto', background: '#fefae0', borderRadius: 16, padding: '18px 18px 22px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1b4332' }}>Edit Equipment</div>
              <button onClick={() => setEquipModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a8d7a' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', marginBottom: 5 }}>Name</div>
              <input value={equipModal.name} onChange={e => setEquipModal(m => ({ ...m, name: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', marginBottom: 5 }}>Type</div>
                <select value={equipModal.type} onChange={e => setEquipModal(m => ({ ...m, type: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  <option value="">Type…</option>
                  {(typeOptions.equipment || []).filter(o => o.is_active !== false || o.name === equipModal.type).map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', marginBottom: 5 }}>Vehicle / Generator no</div>
                <input value={equipModal.identifier} onChange={e => setEquipModal(m => ({ ...m, identifier: e.target.value }))} placeholder="optional" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', marginBottom: 5 }}>Owner</div>
                <input value={equipModal.owner} onChange={e => setEquipModal(m => ({ ...m, owner: e.target.value }))} placeholder="optional" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', marginBottom: 5 }}>Company / make</div>
                <input value={equipModal.company} onChange={e => setEquipModal(m => ({ ...m, company: e.target.value }))} placeholder="optional" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', marginBottom: 5 }}>Fuel</div>
                <select value={equipModal.fuel} onChange={e => setEquipModal(m => ({ ...m, fuel: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  <option value="">Fuel…</option>
                  {FUEL_TYPES.map(fu => <option key={fu} value={fu}>{fu}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', marginBottom: 5 }}>Opening diesel (L)</div>
                <input type="number" inputMode="decimal" value={equipModal.stock} onChange={e => setEquipModal(m => ({ ...m, stock: e.target.value }))} placeholder="as of stock opening date" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', marginBottom: 5 }}>Rating (e.g. 125 kVA)</div>
                <input value={equipModal.rating} onChange={e => setEquipModal(m => ({ ...m, rating: e.target.value }))} placeholder="optional" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', marginBottom: 5 }}>Motor HP</div>
                <input type="number" inputMode="decimal" value={equipModal.motorHp} onChange={e => setEquipModal(m => ({ ...m, motorHp: e.target.value }))} placeholder="optional" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEquipModal(null)} style={{ flex: 1, padding: '12px 0', background: '#fff', color: '#595c4a', borderRadius: 11, border: '1.5px solid #e5ddd0', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveEquip} disabled={savingEquip} style={{ flex: 1, padding: '12px 0', background: savingEquip ? '#c3d2c9' : '#2d6a4f', color: '#fff', borderRadius: 11, border: 'none', fontSize: 14, fontWeight: 700, cursor: savingEquip ? 'default' : 'pointer' }}>{savingEquip ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
