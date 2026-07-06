import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'
import PageHeader from '../components/PageHeader'
import { Plus, Edit3, Check, X, ChevronDown, ChevronUp, Archive, RotateCcw } from 'lucide-react'

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
  const [addingPlant, setAddingPlant] = useState(false)
  const [newPlantName, setNewPlantName] = useState('')

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({ machines: true, equipment: true, raw_material_types: true, pellet_types: true })

  // Show archived plants toggle
  const [showArchived, setShowArchived] = useState(false)

  // Per-plant GCV grade threshold (High GCV vs Low GCV cutoff)
  const [thresholdDraft, setThresholdDraft] = useState('')
  const [savingThreshold, setSavingThreshold] = useState(false)
  const [busy, setBusy] = useState(false)

  // Plant Location
  const [showLocation, setShowLocation] = useState(false)
  const [locationLat, setLocationLat] = useState(plant?.location_lat?.toString() || '')
  const [locationLng, setLocationLng] = useState(plant?.location_lng?.toString() || '')
  const [savingLocation, setSavingLocation] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)

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
    showToast('GCV grade threshold saved', 'success')
    setPlants(prev => prev.map(p => p.id === selectedPlantId ? { ...p, gcv_grade_threshold: val } : p))
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
    if (employee?.role !== 'admin') return
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
    if (!selectedPlantId || employee?.role !== 'admin') return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
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
      } catch (err) {
        console.error('Error loading admin data:', err)
        if (!cancelled) showToast('Failed to load plant settings', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [selectedPlantId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (employee?.role !== 'admin') {
    return (
      <div style={{ minHeight: '100vh', background: '#fefae0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#595c4a', fontSize: 14 }}>Admin access required</p>
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
    const { error } = await supabase.from(section.table).insert(payload)
    setBusy(false)
    if (error) {
      showToast('Failed to add: ' + error.message, 'error')
      return
    }
    showToast(`${section.singular} added`, 'success')
    setNewItemName('')
    setAddingTo(null)
    loadAllData()
  }

  async function updateItem(sectionKey, id, newName) {
    const section = SECTIONS.find(s => s.key === sectionKey)
    const payload = { name: newName }
    if (sectionKey === 'raw_material_types') {
      const g = parseFloat(editingItem?.gcv)
      payload.gcv_kcal_kg = Number.isNaN(g) ? null : g
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
        {/* GCV grade threshold (per plant) */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '14px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 2 }}>GCV Grade Threshold</div>
          <div style={{ fontSize: 12, color: '#8a8d7a', marginBottom: 10 }}>Mixes at or above this GCV are graded High GCV</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              inputMode="decimal"
              value={thresholdDraft}
              onChange={e => setThresholdDraft(e.target.value)}
              placeholder="3200"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', minWidth: 0, boxSizing: 'border-box' }}
            />
            <span style={{ fontSize: 12, color: '#8a8d7a', whiteSpace: 'nowrap' }}>kcal/kg</span>
            <button
              onClick={saveThreshold}
              disabled={savingThreshold}
              style={{ padding: '10px 16px', background: '#2d6a4f', color: 'white', borderRadius: 10, border: 'none', cursor: savingThreshold ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: savingThreshold ? 0.6 : 1 }}
            >
              {savingThreshold ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

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
                    {/* Items */}
                    {items.map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
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
                              style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none', minWidth: 0 }}
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
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#2c2c2c' }}>{item.name}</span>
                            {section.key === 'raw_material_types' && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: item.gcv_kcal_kg != null ? '#2d6a4f' : '#8a8d7a', background: '#fefae0', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                                {item.gcv_kcal_kg != null ? `${item.gcv_kcal_kg} kcal/kg` : 'GCV not set'}
                              </span>
                            )}
                            {section.key === 'pellet_types' && item.grade && (
                              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap', background: item.grade === 'High GCV' ? '#2d6a4f' : '#fef3c7', color: item.grade === 'High GCV' ? '#fff' : '#b45309' }}>
                                {item.grade}
                              </span>
                            )}
                            {item.is_active === false && (
                              <span style={{ fontSize: 10, color: '#d32f2f', fontWeight: 600 }}>Inactive</span>
                            )}
                            <button
                              onClick={() => setEditingItem({ section: section.key, id: item.id, name: item.name, gcv: item.gcv_kcal_kg ?? '' })}
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
                      <div style={{ display: 'flex', gap: 8, padding: '10px 16px' }}>
                        <input
                          type="text"
                          placeholder={`New ${section.singular.toLowerCase()} name`}
                          value={newItemName}
                          onChange={e => setNewItemName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addItem(section.key)}
                          autoFocus
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none' }}
                        />
                        <button
                          onClick={() => addItem(section.key)}
                          disabled={busy}
                          style={{ padding: '8px 12px', background: '#2d6a4f', color: 'white', borderRadius: 8, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: busy ? 0.6 : 1 }}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setAddingTo(null); setNewItemName('') }}
                          style={{ padding: '8px 12px', background: '#fefae0', color: '#595c4a', borderRadius: 8, border: '1px solid #e5ddd0', cursor: 'pointer', fontSize: 12 }}
                        >
                          Cancel
                        </button>
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
      </div>
    </div>
  )
}
