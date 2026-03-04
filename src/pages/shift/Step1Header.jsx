import { memo } from 'react'
import { Calendar, Clock } from 'lucide-react'

export default memo(function Step1Header({ data, updateData, employee }) {
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

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #e5ddd0',
    background: '#fefae0',
    color: '#595c4a',
    fontSize: 14,
    outline: 'none',
    cursor: 'not-allowed',
    boxSizing: 'border-box',
  }

  const inputWithIconStyle = {
    ...inputStyle,
    paddingLeft: 38,
  }

  const editableInputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1.5px solid #e5ddd0',
    background: 'white',
    color: '#2c2c2c',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const editableInputWithIconStyle = {
    ...editableInputStyle,
    paddingLeft: 38,
  }

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#595c4a',
    marginBottom: 6,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Report Fill Date & Time (auto/readonly) */}
      <div>
        <label style={labelStyle}>Report Fill Date & Time</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Calendar size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b5b8a8', zIndex: 1 }} />
            <input type="date" value={currentDateStr} readOnly style={inputWithIconStyle} />
          </div>
          <div style={{ position: 'relative' }}>
            <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b5b8a8', zIndex: 1 }} />
            <input type="time" value={currentTimeStr} readOnly style={inputWithIconStyle} />
          </div>
        </div>
      </div>

      {/* Plant & Shift (side by side) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Plant (auto/readonly) */}
        <div>
          <label style={labelStyle}>Plant</label>
          <input type="text" value={data.plant?.name || 'Prayagraj'} readOnly style={inputStyle} />
        </div>

        {/* Shift Dropdown (A Day / B Night) */}
        <div>
          <label style={labelStyle}>
            Shift <span style={{ color: '#d32f2f' }}>*</span>
          </label>
          <select
            value={data.shift || ''}
            onChange={e => handleShiftChange(e.target.value)}
            style={{
              ...editableInputStyle,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <option value="">Select Shift</option>
            <option value="A">A Day</option>
            <option value="B">B Night</option>
          </select>
        </div>
      </div>

      {/* Supervisor (auto/readonly - show name) */}
      <div>
        <label style={labelStyle}>Supervisor</label>
        <input
          type="text"
          value={employee?.name || 'Loading...'}
          readOnly
          style={inputStyle}
        />
      </div>

      {/* Shift Schedule Box */}
      <div style={{ background: '#e8f0ec', borderRadius: 14, border: '1.5px solid #b8d4c4', padding: '16px 16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Shift Schedule
        </div>

        {/* Start Date & Start Time (side by side) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>
              Start Date <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b5b8a8', zIndex: 1 }} />
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
                style={{ ...editableInputWithIconStyle, cursor: 'pointer' }}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Start Time <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b5b8a8', zIndex: 1 }} />
              <input
                type="time"
                value={data.start_time}
                onChange={e => updateData('start_time', e.target.value)}
                style={editableInputWithIconStyle}
              />
            </div>
          </div>
        </div>

        {/* End Date & End Time (side by side) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>
              End Date <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b5b8a8', zIndex: 1 }} />
              <input
                type="date"
                value={data.shift_end_date || data.date}
                onChange={e => updateData('shift_end_date', e.target.value)}
                style={{ ...editableInputWithIconStyle, cursor: 'pointer' }}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              End Time <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b5b8a8', zIndex: 1 }} />
              <input
                type="time"
                value={data.end_time}
                onChange={e => updateData('end_time', e.target.value)}
                style={editableInputWithIconStyle}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Weather Dropdown (optional) */}
      <div>
        <label style={labelStyle}>
          Weather <span style={{ color: '#999', fontSize: 11 }}>(Optional)</span>
        </label>
        <select
          value={data.weather || ''}
          onChange={e => updateData('weather', e.target.value)}
          style={{
            ...editableInputStyle,
            fontWeight: 500,
            cursor: 'pointer',
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
})
