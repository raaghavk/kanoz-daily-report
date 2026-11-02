import { describe, it, expect } from 'vitest'
import { pickIssueReportedPayload } from '../issueNotify'

const existing = [
  { id: 'iss-1', type: 'Machine', description: 'Belt snapped', severity: 'high' },
  { id: 'iss-2', type: 'Labour', description: 'Short staffed', severity: 'medium' },
]

describe('pickIssueReportedPayload', () => {
  it('returns the most severe issue on a new report', () => {
    expect(pickIssueReportedPayload(existing, [])).toEqual({
      type: 'Machine',
      description: 'Belt snapped',
      severity: 'high',
      count: 2,
    })
  })

  it('returns null when updating a report with only already-saved issues', () => {
    expect(pickIssueReportedPayload(existing, ['iss-1', 'iss-2'])).toBeNull()
  })

  it('notifies only for issues added during edit', () => {
    const issues = [
      ...existing,
      { id: 1700000000000, type: 'Electrical', description: 'Motor burned', severity: 'critical' },
    ]
    expect(pickIssueReportedPayload(issues, ['iss-1', 'iss-2'])).toEqual({
      type: 'Electrical',
      description: 'Motor burned',
      severity: 'critical',
      count: 1,
    })
  })

  it('ignores blank descriptions and truncates the top description', () => {
    const issues = [
      { id: 'n1', type: 'Other', description: '   ', severity: 'critical' },
      { id: 'n2', type: 'Weather', description: 'x'.repeat(80), severity: 'low' },
    ]
    const payload = pickIssueReportedPayload(issues, [])
    expect(payload.count).toBe(1)
    expect(payload.description).toHaveLength(60)
    expect(payload.type).toBe('Weather')
  })
})
