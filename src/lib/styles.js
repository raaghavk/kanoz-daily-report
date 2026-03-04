export const COLORS = {
  primary: '#1B7A45',
  primaryLight: '#E8F5EE',
  primaryBorder: '#C3DFCC',
  dark: '#1A1A2E',
  text: '#5A6B62',
  textLight: '#8A9B92',
  textMuted: '#C5CFC8',
  border: '#E2E8E4',
  background: '#F5F7F6',
  danger: '#E53E3E',
  warning: '#D4960A',
  warningBg: '#FFF8E6',
  warningBorder: '#F0D98C',
  info: '#2563EB',
  white: '#FFFFFF',
}

export const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 12,
  border: `1.5px solid ${COLORS.border}`,
  fontSize: 14,
  color: COLORS.dark,
  outline: 'none',
  background: COLORS.background,
  boxSizing: 'border-box',
}

export const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: COLORS.textLight,
  marginBottom: 6,
}

export const cardStyle = {
  background: COLORS.white,
  borderRadius: 14,
  border: `1.5px solid ${COLORS.border}`,
  padding: 16,
}
