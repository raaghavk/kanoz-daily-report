import { Plus, Trash2 } from 'lucide-react'
import PhotoUpload from '../../components/PhotoUpload'

export default function Step8Issues({ data, updateData }) {
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
    <div className="space-y-4">
      <p className="text-xs text-kanoz-text-secondary">Report any issues. Skip if no issues this shift.</p>

      {data.issues.map((issue, idx) => (
        <div key={issue.id} className="bg-kanoz-card rounded-xl border border-kanoz-border p-4 relative">
          <button onClick={() => removeIssue(idx)} className="absolute top-3 right-3 text-kanoz-red/50 hover:text-kanoz-red">
            <Trash2 size={16} />
          </button>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">TYPE</label>
              <select value={issue.type} onChange={e => updateIssue(idx, 'type', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green">
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">SEVERITY</label>
              <select value={issue.severity} onChange={e => updateIssue(idx, 'severity', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green">
                {severities.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">DESCRIPTION</label>
            <textarea value={issue.description} onChange={e => updateIssue(idx, 'description', e.target.value)} placeholder="Describe the issue..." rows={2} className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green resize-none" />
          </div>
          <PhotoUpload label="Photo Evidence" onChange={file => updateIssue(idx, 'photo_url', file)} />
        </div>
      ))}

      <button onClick={addIssue} className="w-full py-3 border-2 border-dashed border-kanoz-border rounded-xl text-sm font-semibold text-kanoz-text-secondary flex items-center justify-center gap-2 hover:border-kanoz-green hover:text-kanoz-green transition-colors">
        <Plus size={18} /> Report Issue
      </button>

      {!data.issues.length && (
        <div className="text-center py-4 text-xs text-kanoz-text-tertiary">No issues? Great! You can skip to the next step.</div>
      )}
    </div>
  )
}
