import { memo } from 'react'

export default memo(function Step4RawMaterial({ data, updateData }) {
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
              <div style={{ padding: '8px 4px', borderRadius: 8, background: '#fefae0', border: '1px solid #e5ddd0', textAlign: 'center', fontSize: 12, fontWeight: 500 }}>
                {rm.opening}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8a8d7a', marginBottom: 4, textAlign: 'center' }}>PURCHASED</label>
              <div style={{ padding: '8px 4px', borderRadius: 8, background: '#fefae0', border: '1px solid #e5ddd0', textAlign: 'center', fontSize: 12, fontWeight: 500 }}>
                {rm.purchased}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8a8d7a', marginBottom: 4, textAlign: 'center' }}>USED</label>
              <input
                type="number"
                value={rm.used || ''}
                onChange={e => updateRM(idx, 'used', e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '8px 8px', borderRadius: 8, border: '1px solid #e5ddd0', fontSize: 12, outline: 'none', textAlign: 'center' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#2d6a4f', marginBottom: 4, textAlign: 'center' }}>CLOSING</label>
              <div style={{ padding: '8px 4px', borderRadius: 8, background: '#e8f0ec', border: '1px solid #b8d4c4', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#2d6a4f' }}>
                {rm.closing}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
})
