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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
          Report Date <span style={{ color: '#E53E3E' }}>*</span>
        </label>
        <div style={{ position: 'relative' }}>
          <Calendar size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#C5CFC8' }} />
          <input
            type="date"
            value={data.date}
            onChange={e => { updateData('date', e.target.value); updateData('shift_start_date', e.target.value) }}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 12, padding: '10px 12px 10px 36px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none' }}
          />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
          Shift <span style={{ color: '#E53E3E' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {['A', 'B'].map(s => (
            <button
              key={s}
              onClick={() => handleShiftChange(s)}
              style={data.shift === s ? {
                padding: '12px 0',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                border: '2px solid #1B7A45',
                background: '#E8F5EE',
                color: '#1B7A45',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s'
              } : {
                padding: '12px 0',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                border: '2px solid #E2E8E4',
                background: 'white',
                color: '#5A6B62',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              Shift {s}
              <div style={{ fontSize: 10, fontWeight: 400, marginTop: 4 }}>
                {s === 'A' ? '06:00 – 18:00 (Day)' : '18:00 – 06:00 (Night)'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>Start Time</label>
          <div style={{ position: 'relative' }}>
            <Clock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#C5CFC8' }} />
            <input
              type="time"
              value={data.start_time}
              onChange={e => updateData('start_time', e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, padding: '10px 12px 10px 36px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none' }}
            />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>End Time</label>
          <input
            type="time"
            value={data.end_time}
            onChange={e => updateData('end_time', e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none' }}
          />
        </div>
      </div>

      {data.shift === 'B' && (
        <div style={{ background: '#FFF8E6', border: '1.5px solid #F0D98C', borderRadius: 14, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#956C03', marginBottom: 4 }}>Overnight Shift</div>
          <div style={{ fontSize: 12, color: '#A0790A' }}>
            Starts: {new Date(data.shift_start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {data.start_time}
            <br />
            Ends: {new Date(data.shift_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {data.end_time}
          </div>
        </div>
      )}

      <div style={{ background: '#F5F7F6', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#C5CFC8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Auto-filled</div>
        <div style={{ fontSize: 12, color: '#5A6B62' }}>
          <div>Plant: <strong>{data.plant?.name || 'Prayagraj'}</strong></div>
          <div>Supervisor: <strong>{data.employee?.name || 'Auto-detected'}</strong></div>
        </div>
      </div>
    </div>
  )
}
