/** `1 entry` / `2 entries` — `plural` defaults to singular + 's'. */
export function pluralize(n, singular, plural = `${singular}s`) {
  const count = Number(n) || 0
  return `${count} ${count === 1 ? singular : plural}`
}
