/**
 * Deep-link path for shift-report push events.
 * Keep send-push-notification in sync (report_submitted / report_edited / issue_reported).
 */
export function reportPushPath(reportId) {
  return reportId ? `/reports/${reportId}` : '/reports'
}
