import { CheckCircle } from 'lucide-react'

export default function Step9Submit({ data, updateData }) {
  const totalProd = data.production.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
  const totalDispatches = data.dispatches.length
  const totalIssues = data.issues.length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-kanoz-card rounded-xl border border-kanoz-border p-4">
        <div className="text-xs font-bold text-kanoz-text-tertiary uppercase tracking-wider mb-3">Report Summary</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-kanoz-text-secondary">Date</span><span className="font-semibold">{data.shift_start_date}{data.shift === 'B' ? ` → ${data.shift_end_date}` : ''}</span></div>
          <div className="flex justify-between"><span className="text-kanoz-text-secondary">Shift</span><span className="font-semibold">Shift {data.shift} ({data.start_time} – {data.end_time})</span></div>
          <div className="flex justify-between"><span className="text-kanoz-text-secondary">Total Production</span><span className="font-bold text-kanoz-green">{totalProd.toFixed(1)} MT</span></div>
          <div className="flex justify-between"><span className="text-kanoz-text-secondary">Dispatches</span><span className="font-semibold">{totalDispatches} trucks</span></div>
          <div className="flex justify-between"><span className="text-kanoz-text-secondary">Issues</span><span className={`font-semibold ${totalIssues > 0 ? 'text-kanoz-red' : 'text-kanoz-green'}`}>{totalIssues || 'None'}</span></div>
          <div className="flex justify-between"><span className="text-kanoz-text-secondary">Machines Active</span><span className="font-semibold">{data.machines.filter(m => m.production_hours > 0).length}/{data.machines.length}</span></div>
        </div>
      </div>

      {/* Handover Notes */}
      <div>
        <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
          Handover Notes for Next Shift
        </label>
        <textarea
          value={data.handover_notes}
          onChange={e => updateData('handover_notes', e.target.value)}
          placeholder="Important notes for the next shift supervisor..."
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green resize-none"
        />
      </div>

      {/* Remarks */}
      <div>
        <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Remarks (Optional)</label>
        <textarea
          value={data.remarks}
          onChange={e => updateData('remarks', e.target.value)}
          placeholder="Any additional notes..."
          rows={2}
          className="w-full px-3.5 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green resize-none"
        />
      </div>

      <div className="bg-kanoz-green-light/20 border border-kanoz-green-light rounded-xl p-4 flex items-start gap-3">
        <CheckCircle size={20} className="text-kanoz-green flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-kanoz-green">Ready to Submit</div>
          <div className="text-xs text-kanoz-text-secondary mt-1">
            Click "Submit Report" below. Once submitted, the report will be locked and visible to admin.
          </div>
        </div>
      </div>
    </div>
  )
}
