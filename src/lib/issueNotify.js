const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

/**
 * Pick the most severe newly logged issue for an issue_reported push.
 *
 * alreadyReportedIds is the set of issue ids that were already on the report
 * when it was opened for edit. Empty for a new report, so every described
 * issue counts as new. Returns null when there is nothing new to announce
 * (e.g. Update Report with the same issues still present).
 */
export function pickIssueReportedPayload(issues, alreadyReportedIds = []) {
  const known = new Set(alreadyReportedIds)
  const described = (issues || []).filter(i => (i?.description || '').trim())
  const fresh = described.filter(i => i.id == null || !known.has(i.id))
  if (fresh.length === 0) return null

  const sorted = [...fresh].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] || 3) - (SEVERITY_ORDER[b.severity] || 3),
  )
  const top = sorted[0]
  return {
    type: top.type,
    description: (top.description || '').slice(0, 60),
    severity: top.severity,
    count: fresh.length,
  }
}
