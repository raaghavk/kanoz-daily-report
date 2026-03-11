import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'
import PageHeader from '../components/PageHeader'
import { Plus, Edit3, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

const SECTIONS = [
  { key: 'machines', table: 'machines', label: 'Machines', singular: 'Machine', hasSort: true },
  { key: 'equipment', table: 'equipment', label: 'Equipment', singular: 'Equipment', hasSort: true },
  { key: 'raw_material_types', table: 'raw_material_types', label: 'Raw Material Types', singular: 'Raw Material Type', hasSort: false },
  { key: 'pellet_types', table: 'pellet_types', label: 'Pellet Types', singular: 'Pellet Type', hasSort: false },
]

export default function AdminPanel() {
  const { employee, plant } = useAuth()

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
      .select('id, name')
      .eq('org_id', plant?.org_id)
      .order('name')
      .then(({ data: orgPlants }) => {
        if (ctrl.signal.aborted) return
        setPlants(orgPlants || [])
        if (!selectedPlantId && orgPlants?.length) {
          setSelectedPlantId(orgPlants[0].id)
        }
      })
    return () => ctrl.abort()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedPlantId || employee?.role !== 'admin') return
    let cancelled = false
    ;(async () => {
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
      if (!cancelled) {
        setData(results)
        setLoading(false)
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
    const section = SECTIONS.find(s => s.key === sectionKey)
    const payload = { plant_id: selectedPlantId, name: newItemName.trim(), is_active: true }
    if (section.hasSort) {
      const existing = data[sectionKey] || []
      payload.sort_order = existing.length + 1
    }
    const { error } = await supabase.from(section.table).insert(payload)
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
    const { error } = await supabase.from(section.table).update({ name: newName }).eq('id', id)
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
    const { data: newPlant, error } = await supabase
      .from('plants')
      .insert({ org_id: plant?.org_id, name: newPlantName.trim() })
      .select()
      .single()
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

  const selectedPlantName = plants.find(p => p.id === selectedPlantId)?.name || 'Plant'

  return (
    <div style={{ minHeight: '100vh', background: '#fefae0', paddingBottom: 80 }}>
      <PageHeader title="Plant Settings" subtitle={`Admin · ${selectedPlantName}`} backTo="/settings" />

      {/* Plant Selector */}
      <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e5ddd0' }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Select Plant</label>
        <select
          value={selectedPlantId}
          onChange={e => setSelectedPlantId(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', background: '#fefae0' }}
        >
          {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
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
            <button onClick={addPlant} style={{ padding: '8px 12px', background: '#2d6a4f', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Add</button>
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
                              style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #2d6a4f', fontSize: 13, outline: 'none' }}
                            />
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
                            {item.is_active === false && (
                              <span style={{ fontSize: 10, color: '#d32f2f', fontWeight: 600 }}>Inactive</span>
                            )}
                            <button
                              onClick={() => setEditingItem({ section: section.key, id: item.id, name: item.name })}
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
                          style={{ padding: '8px 12px', background: '#2d6a4f', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
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
      </div>
    </div>
  )
}
