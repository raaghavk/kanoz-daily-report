import { Calendar, Clock } from 'lucide-react'

export default function Step1Header({ data, updateData }) {
  function handleShiftChange(shift) {
    updateData('shift', shift)
    if (shift === 'A') {
      updateData('start_time', '06:00')
      updateData('end_time', '18:00')
      updateData('shift_start_date', data.date)
      updateData('shift_end_date', data.date)
    } else {
      updateData('start_time', '18:00')
      updateData('end_time', '06:00')
      updateData('shift_start_date', data.date)
      // Next day for end date
      const next = new Date(data.date)
      next.setDate(next.getDate() + 1)
      updateData('shift_end_date', next.toISOString().split('T')[0])
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
          Report Date <span className="text-kanoz-red">*</span>
        </label>
        <div className="relative">
          <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-kanoz-text-tertiary" />
          <input
            type="date"
            value={data.date}
            onChange={e => { updateData('date', e.target.value); updateData('shift_start_date', e.target.value) }}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
          Shift <span className="text-kanoz-red">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {['A', 'B'].map(s => (
            <button
              key={s}
              onClick={() => handleShiftChange(s)}
              className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                data.shift === s
                  ? 'border-kanoz-green bg-kanoz-green-light/30 text-kanoz-green'
                  : 'border-kanoz-border text-kanoz-text-secondary'
              }`}
            >
              Shift {s}
              <div className="text-[10px] font-normal mt-0.5">
                {s === 'A' ? '06:00 – 18:00 (Day)' : '18:00 – 06:00 (Night)'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Start Time</label>
          <div className="relative">
            <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-kanoz-text-tertiary" />
            <input
              type="time"
              value={data.start_time}
              onChange={e => updateData('start_time', e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">End Time</label>
          <input
            type="time"
            value={data.end_time}
            onChange={e => updateData('end_time', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
          />
        </div>
      </div>

      {data.shift === 'B' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="text-xs font-bold text-amber-800 mb-1">Overnight Shift</div>
          <div className="text-xs text-amber-700">
            Starts: {new Date(data.shift_start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {data.start_time}
            <br />
            Ends: {new Date(data.shift_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {data.end_time}
          </div>
        </div>
      )}

      <div className="bg-kanoz-bg rounded-xl p-3 border border-kanoz-border">
        <div className="text-[10px] font-bold text-kanoz-text-tertiary uppercase tracking-wider mb-1">Auto-filled</div>
        <div className="text-xs text-kanoz-text-secondary">
          <div>Plant: <strong>{data.plant?.name || 'Prayagraj'}</strong></div>
          <div>Supervisor: <strong>{data.employee?.name || 'Auto-detected'}</strong></div>
        </div>
      </div>
    </div>
  )
}
