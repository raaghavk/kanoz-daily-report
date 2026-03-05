export const COLORS = {
  primary: '#2d6a4f',
  primaryLight: '#e8f0ec',
  primaryBorder: '#b8d4c4',
  dark: '#2c2c2c',
  text: '#595c4a',
  textLight: '#8a8d7a',
  textMuted: '#b5b8a8',
  border: '#e5ddd0',
  background: '#fefae0',
  danger: '#d32f2f',
  warning: '#d4a373',
  warningBg: '#fefae0',
  warningBorder: '#e9c46a',
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
