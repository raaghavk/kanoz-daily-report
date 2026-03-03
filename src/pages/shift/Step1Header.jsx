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

  // Get current date and time for readonly fields
  const now = new Date()
  const currentDateStr = now.toISOString().split('T')[0]
  const currentTimeStr = now.toTimeString().split(' ')[0].slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Report Fill Date & Time (auto/readonly) */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
          Report Fill Date & Time
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Calendar size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#C5CFC8' }} />
            <input
              type="date"
              value={currentDateStr}
              readOnly
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                borderRadius: 10,
                border: '1px solid #E2E8E4',
                background: '#F5F7F6',
                color: '#5A6B62',
                fontSize: 14,
                outline: 'none',
                cursor: 'not-allowed'
              }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#C5CFC8' }} />
            <input
              type="time"
              value={currentTimeStr}
              readOnly
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                borderRadius: 10,
                border: '1px solid #E2E8E4',
                background: '#F5F7F6',
                color: '#5A6B62',
                fontSize: 14,
                outline: 'none',
                cursor: 'not-allowed'
              }}
            />
          </div>
        </div>
      </div>

      {/* Plant & Shift (side by side) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Plant (auto/readonly) */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
            Plant
          </label>
          <input
            type="text"
            value={data.plant?.name || 'Prayagraj'}
            readOnly
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #E2E8E4',
              background: '#F5F7F6',
              color: '#5A6B62',
              fontSize: 14,
              outline: 'none',
              cursor: 'not-allowed'
            }}
          />
        </div>

        {/* Shift Dropdown (A Day / B Night) */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
            Shift <span style={{ color: '#E53E3E' }}>*</span>
          </label>
          <select
            value={data.shift || ''}
            onChange={e => handleShiftChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1.5px solid #E2E8E4',
              background: 'white',
              color: '#1A1A2E',
              fontSize: 14,
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">Select Shift</option>
            <option value="A">A Day</option>
            <option value="B">B Night</option>
          </select>
        </div>
      </div>

      {/* Supervisor (auto/readonly) */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
          Supervisor
        </label>
        <input
          type="text"
          value={data.employee?.name || 'Auto-detected'}
          readOnly
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #E2E8E4',
            background: '#F5F7F6',
            color: '#5A6B62',
            fontSize: 14,
            outline: 'none',
            cursor: 'not-allowed'
          }}
        />
      </div>

      {/* Shift Schedule Box */}
      <div style={{ background: '#E8F5EE', borderRadius: 14, border: '1.5px solid #C6F6D5', padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1B7A45', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Shift Schedule
        </div>

        {/* Start Date & Start Time (side by side) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
              Start Date <span style={{ color: '#E53E3E' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#C5CFC8' }} />
              <input
                type="date"
                value={data.shift_start_date || data.date}
                onChange={e => {
                  updateData('shift_start_date', e.target.value)
                  if (data.shift === 'B') {
                    const next = new Date(e.target.value)
                    next.setDate(next.getDate() + 1)
                    updateData('shift_end_date', next.toISOString().split('T')[0])
                  } else {
                    updateData('shift_end_date', e.target.value)
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 10,
                  border: '1.5px solid #E2E8E4',
                  background: 'white',
                  color: '#1A1A2E',
                  fontSize: 14,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
              Start Time <span style={{ color: '#E53E3E' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#C5CFC8' }} />
              <input
                type="time"
                value={data.start_time}
                onChange={e => updateData('start_time', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 10,
                  border: '1.5px solid #E2E8E4',
                  background: 'white',
                  color: '#1A1A2E',
                  fontSize: 14,
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* End Date & End Time (side by side) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
              End Date <span style={{ color: '#E53E3E' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#C5CFC8' }} />
              <input
                type="date"
                value={data.shift_end_date || data.date}
                onChange={e => updateData('shift_end_date', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 10,
                  border: '1.5px solid #E2E8E4',
                  background: 'white',
                  color: '#1A1A2E',
                  fontSize: 14,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
              End Time <span style={{ color: '#E53E3E' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#C5CFC8' }} />
              <input
                type="time"
                value={data.end_time}
                onChange={e => updateData('end_time', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 10,
                  border: '1.5px solid #E2E8E4',
                  background: 'white',
                  color: '#1A1A2E',
                  fontSize: 14,
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Weather Dropdown (optional) */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
          Weather <span style={{ color: '#999', fontSize: 11 }}>(Optional)</span>
        </label>
        <select
          value={data.weather || ''}
          onChange={e => updateData('weather', e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1.5px solid #E2E8E4',
            background: 'white',
            color: '#1A1A2E',
            fontSize: 14,
            fontWeight: 500,
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="">Select Weather</option>
          <option value="Clear">Clear</option>
          <option value="Cloudy">Cloudy</option>
          <option value="Rainy">Rainy</option>
          <option value="Foggy">Foggy</option>
        </select>
      </div>
    </div>
  )
}
