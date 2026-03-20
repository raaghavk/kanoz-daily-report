import { memo } from 'react'
import { Calendar, Clock } from 'lucide-react'
import { getLocalDate } from '../../lib/dateUtils'

export default memo(function Step1Header({ data, updateData }) {
  function handleShiftChange(shift) {
    updateData('shift', shift)
    if (shift === 'A') {
      updateData('start_time', '08:00')
      updateData('end_time', '20:00')
      updateData('shift_start_date', data.date)
      updateData('shift_end_date', data.date)
    } else {
      updateData('start_time', '20:00')
      updateData('end_time', '08:00')
      updateData('shift_start_date', data.date)
      // Next day for end date
      const next = new Date(data.date)
      next.setDate(next.getDate() + 1)
      updateData('shift_end_date', next.toISOString().split('T')[0])
    }
  }


  const editableInputStyle = {
    width: '100%',
    height: 48,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
      {/* Shift Dropdown (A Day / B Night) */}
      <div style={{ minWidth: 0 }}>
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

      {/* Shift Schedule Box */}
      <div style={{ background: '#e8f0ec', borderRadius: 14, border: '1.5px solid #b8d4c4', padding: '16px 16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Shift Schedule
        </div>

        {/* Start Date & Start Time (side by side) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
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
                    updateData('shift_end_date', getLocalDate(next))
                  } else {
                    updateData('shift_end_date', e.target.value)
                  }
                }}
                style={{ ...editableInputWithIconStyle, cursor: 'pointer' }}
              />
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
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

          <div style={{ minWidth: 0 }}>
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

      {/* Power Readings */}
      <div style={{ marginTop: 16 }}>
        <label style={labelStyle}>Power Meter Readings</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Start Reading</label>
            <input
              type="number"
              inputMode="decimal"
              value={data.start_power_reading || ''}
              onChange={e => updateData('start_power_reading', e.target.value)}
              placeholder="0"
              style={editableInputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>End Reading</label>
            <input
              type="number"
              inputMode="decimal"
              value={data.end_power_reading || ''}
              onChange={e => updateData('end_power_reading', e.target.value)}
              placeholder="0"
              style={editableInputStyle}
            />
          </div>
        </div>
      </div>

    </div>
  )
})
