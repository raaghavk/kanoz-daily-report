import { memo } from 'react'
import { CheckCircle } from 'lucide-react'

export default memo(function Step9Submit({ data, updateData }) {
  const totalProd = data.production.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
  const totalDispatches = data.dispatches.length
  const totalIssues = data.issues.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Report Summary</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5A6B62' }}>Date</span><span style={{ fontWeight: 600 }}>{data.shift_start_date}{data.shift === 'B' ? ` → ${data.shift_end_date}` : ''}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5A6B62' }}>Shift</span><span style={{ fontWeight: 600 }}>Shift {data.shift} ({data.start_time} – {data.end_time})</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5A6B62' }}>Total Production</span><span style={{ fontWeight: 700, color: '#1B7A45' }}>{totalProd.toFixed(1)} MT</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5A6B62' }}>Dispatches</span><span style={{ fontWeight: 600 }}>{totalDispatches} trucks</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5A6B62' }}>Issues</span><span style={{ fontWeight: 600, color: totalIssues > 0 ? '#E53E3E' : '#1B7A45' }}>{totalIssues || 'None'}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5A6B62' }}>Machines Active</span><span style={{ fontWeight: 600 }}>{data.machines.filter(m => m.production_hours > 0).length}/{data.machines.length}</span></div>
        </div>
      </div>

      {/* Handover Notes */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
          Handover Notes for Next Shift
        </label>
        <textarea
          value={data.handover_notes}
          onChange={e => updateData('handover_notes', e.target.value)}
          placeholder="Important notes for the next shift supervisor..."
          rows={3}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 14, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none', resize: 'none' }}
        />
      </div>

      {/* Remarks */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>Remarks (Optional)</label>
        <textarea
          value={data.remarks}
          onChange={e => updateData('remarks', e.target.value)}
          placeholder="Any additional notes..."
          rows={2}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 14, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none', resize: 'none' }}
        />
      </div>

      <div style={{ background: '#E8F5EE', border: '1.5px solid #C6F6D5', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <CheckCircle size={20} style={{ color: '#1B7A45', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1B7A45' }}>Ready to Submit</div>
          <div style={{ fontSize: 12, color: '#5A6B62', marginTop: 4 }}>
            Click "Submit Report" below. Once submitted, the report will be locked and visible to admin.
          </div>
        </div>
      </div>
    </div>
  )
})
