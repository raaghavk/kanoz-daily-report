export default function Step4RawMaterial({ data, updateData }) {
  function updateRM(idx, field, value) {
    const mats = [...data.rawMaterials]
    mats[idx] = { ...mats[idx], [field]: parseFloat(value) || 0 }
    // Auto-calculate closing
    mats[idx].closing = mats[idx].opening + mats[idx].purchased - mats[idx].used
    updateData('rawMaterials', mats)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 12, color: '#5A6B62' }}>Opening stock auto-carries from previous shift. Purchased auto-fills from Purchase app.</p>

      {data.rawMaterials.map((rm, idx) => (
        <div key={rm.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#1A1A2E' }}>{rm.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8A9B92', marginBottom: 4, textAlign: 'center' }}>OPENING</label>
              <div style={{ padding: '8px 4px', borderRadius: 8, background: '#F5F7F6', border: '1px solid #E2E8E4', textAlign: 'center', fontSize: 12, fontWeight: 500 }}>
                {rm.opening}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8A9B92', marginBottom: 4, textAlign: 'center' }}>PURCHASED</label>
              <div style={{ padding: '8px 4px', borderRadius: 8, background: '#F5F7F6', border: '1px solid #E2E8E4', textAlign: 'center', fontSize: 12, fontWeight: 500 }}>
                {rm.purchased}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8A9B92', marginBottom: 4, textAlign: 'center' }}>USED</label>
              <input
                type="number"
                value={rm.used || ''}
                onChange={e => updateRM(idx, 'used', e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '8px 8px', borderRadius: 8, border: '1px solid #E2E8E4', fontSize: 12, outline: 'none', textAlign: 'center' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#1B7A45', marginBottom: 4, textAlign: 'center' }}>CLOSING</label>
              <div style={{ padding: '8px 4px', borderRadius: 8, background: '#E8F5EE', border: '1px solid #C6F6D5', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#1B7A45' }}>
                {rm.closing}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
