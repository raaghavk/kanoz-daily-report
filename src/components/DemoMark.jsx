import { DEMO_APP_NAME } from '../lib/demo/mode'

/** Neutral pellet-stack mark for the scrubbed prospect demo (no Kanoz branding). */
export default function DemoMark({ size = 36, alt = DEMO_APP_NAME, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      role="img"
      aria-label={alt}
      style={style}
    >
      <rect width="140" height="140" rx="32" fill="#1b4332" />
      <circle cx="70" cy="70" r="48" fill="#2d6a4f" />
      <ellipse cx="70" cy="52" rx="22" ry="11" fill="#fefae0" />
      <ellipse cx="70" cy="70" rx="22" ry="11" fill="#e9edc9" />
      <ellipse cx="70" cy="88" rx="22" ry="11" fill="#d8f3dc" />
      <path d="M98 38c-8 6-10 16-8 24 8-4 14-12 16-22-2 1-5 0-8-2z" fill="#95d5b2" />
    </svg>
  )
}
