import { memo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import PhotoUpload from '../../components/PhotoUpload'

export default memo(function Step8Issues({ data, updateData }) {
  const types = ['Machine', 'Labour', 'Weather', 'Raw Material', 'Electrical', 'Other']
  const severities = ['low', 'medium', 'high', 'critical']

  function addIssue() {
    updateData('issues', [...data.issues, {
      id: Date.now(), type: 'Machine', description: '', severity: 'medium', photo_url: null,
    }])
  }

  function updateIssue(idx, field, value) {
    const issues = [...data.issues]
    issues[idx] = { ...issues[idx], [field]: value }
    updateData('issues', issues)
  }

  function removeIssue(idx) {
    updateData('issues', data.issues.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 12, color: '#595c4a' }}>Report any issues. Skip if no issues this shift.</p>

      {data.issues.map((issue, idx) => (
        <div key={issue.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, position: 'relative' }}>
          <button onClick={() => removeIssue(idx)} style={{ position: 'absolute', top: 12, right: 12, color: '#d32f2f', opacity: 0.5, border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <Trash2 size={16} />
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>TYPE</label>
              <select value={issue.type} onChange={e => updateIssue(idx, 'type', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>SEVERITY</label>
              <select value={issue.severity} onChange={e => updateIssue(idx, 'severity', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}>
                {severities.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>DESCRIPTION</label>
            <textarea value={issue.description} onChange={e => updateIssue(idx, 'description', e.target.value)} placeholder="Describe the issue..." rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', resize: 'none' }} />
          </div>
          <PhotoUpload label="Photo Evidence" onChange={file => updateIssue(idx, 'photo_url', file)} />
        </div>
      ))}

      <button onClick={addIssue} style={{ width: '100%', padding: '12px 0', border: '2px dashed #e5ddd0', borderRadius: 14, fontSize: 14, fontWeight: 600, color: '#595c4a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', cursor: 'pointer' }}>
        <Plus size={18} /> Report Issue
      </button>

      {!data.issues.length && (
        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: '#b5b8a8' }}>No issues? Great! You can skip to the next step.</div>
      )}
    </div>
  )
})
