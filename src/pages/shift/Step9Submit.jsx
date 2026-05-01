import { memo } from 'react'
import { CheckCircle } from 'lucide-react'

function formatDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr + 'T00:00:00')
  const day = d.getDate()
  const suffix = [11, 12, 13].includes(day) ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th'
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${day}${suffix} ${months[d.getMonth()]}, ${d.getFullYear()}`
}

export default memo(function Step9Submit({ data, updateData }) {
  const totalProd = data.production.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
  const totalDispatches = Object.values(data.dispatchTotals || {}).reduce((sum, qty) => sum + (parseFloat(qty) || 0), 0)
  const totalIssues = data.issues.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Report Summary</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#595c4a' }}>Date</span><span style={{ fontWeight: 600 }}>{formatDate(data.shift_start_date)}{data.shift === 'B' ? ` → ${formatDate(data.shift_end_date)}` : ''}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#595c4a' }}>Shift</span><span style={{ fontWeight: 600 }}>Shift {data.shift} ({data.start_time} – {data.end_time})</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#595c4a' }}>Total Production</span><span style={{ fontWeight: 700, color: '#2d6a4f' }}>{totalProd.toFixed(1)} MT</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#595c4a' }}>Dispatches</span><span style={{ fontWeight: 600 }}>{typeof totalDispatches === 'number' && totalDispatches > 0 ? `${totalDispatches.toFixed(1)} MT` : 'None'}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#595c4a' }}>Issues</span><span style={{ fontWeight: 600, color: totalIssues > 0 ? '#d32f2f' : '#2d6a4f' }}>{totalIssues || 'None'}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#595c4a' }}>Machines Active</span><span style={{ fontWeight: 600 }}>{(data.machines || []).filter(m => m.from_time && m.to_time).length}/{(data.machines || []).length}</span></div>
        </div>
      </div>

      {/* Handover Notes */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#595c4a', marginBottom: 6 }}>
          Handover Notes for Next Shift
        </label>
        <textarea
          value={data.handover_notes}
          onChange={e => updateData('handover_notes', e.target.value)}
          placeholder="Important notes for the next shift supervisor..."
          rows={3}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 14, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', resize: 'none' }}
        />
      </div>

      {/* Remarks */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#595c4a', marginBottom: 6 }}>Remarks (Optional)</label>
        <textarea
          value={data.remarks}
          onChange={e => updateData('remarks', e.target.value)}
          placeholder="Any additional notes..."
          rows={2}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 14, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', resize: 'none' }}
        />
      </div>

      <div style={{ background: '#e8f0ec', border: '1.5px solid #b8d4c4', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <CheckCircle size={20} style={{ color: '#2d6a4f', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2d6a4f' }}>Ready to Submit</div>
          <div style={{ fontSize: 12, color: '#595c4a', marginTop: 4 }}>
            Click "Submit Report" below. Once submitted, the report will be locked and visible to admin.
          </div>
        </div>
      </div>
    </div>
  )
})
