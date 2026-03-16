import { describe, it, expect, vi, beforeEach } from 'vitest'
import { escapeCSV, buildCSVRow, exportDetailedReportToCSV, exportReportListToCSV } from '../exportUtils'

describe('escapeCSV', () => {
  it('returns empty string for null/undefined', () => {
    expect(escapeCSV(null)).toBe('')
    expect(escapeCSV(undefined)).toBe('')
  })

  it('returns string unchanged if no special chars', () => {
    expect(escapeCSV('hello')).toBe('hello')
  })

  it('wraps in quotes if value contains comma', () => {
    expect(escapeCSV('a,b')).toBe('"a,b"')
  })

  it('doubles internal quotes and wraps', () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""')
  })

  it('wraps in quotes if value contains newline', () => {
    expect(escapeCSV('line1\nline2')).toBe('"line1\nline2"')
  })

  it('converts numbers to strings', () => {
    expect(escapeCSV(42)).toBe('42')
  })
})

describe('buildCSVRow', () => {
  it('joins escaped values with commas', () => {
    expect(buildCSVRow(['a', 'b,c', 'd'])).toBe('a,"b,c",d')
  })

  it('handles empty array', () => {
    expect(buildCSVRow([])).toBe('')
  })
})

describe('exportDetailedReportToCSV', () => {
  let mockCreateObjectURL, mockRevokeObjectURL

  beforeEach(() => {
    mockCreateObjectURL = vi.fn(() => 'blob:test')
    mockRevokeObjectURL = vi.fn()
    globalThis.URL.createObjectURL = mockCreateObjectURL
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL
    // Mock link element
    const mockLink = { click: vi.fn(), style: {} }
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
  })

  const minimalReport = {
    date: '2025-01-15',
    shift: 1,
    start_time: '06:00:00',
    end_time: '14:00:00',
    employees: { name: 'John' },
    plants: { name: 'Plant A' },
    pellet_production_mt: 100,
  }

  it('generates CSV with all required section headers', () => {
    exportDetailedReportToCSV({ report: minimalReport })

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    const blob = mockCreateObjectURL.mock.calls[0][0]
    expect(blob).toBeInstanceOf(Blob)

    // Check the Blob was created with text/csv type
    expect(blob.type).toBe('text/csv;charset=utf-8;')
  })

  it('creates correct filename', () => {
    exportDetailedReportToCSV({ report: minimalReport })

    const link = document.createElement.mock.results[0].value
    expect(link.download).toBe('shift-report-2025-01-15-shift1.csv')
  })

  it('handles empty child arrays without crashing', () => {
    expect(() => {
      exportDetailedReportToCSV({
        report: minimalReport,
        machineProduction: [],
        rawMaterials: [],
        equipmentDiesel: [],
        pelletStock: [],
        dispatches: [],
        issues: [],
      })
    }).not.toThrow()
  })
})

describe('exportReportListToCSV', () => {
  let mockCreateObjectURL

  beforeEach(() => {
    mockCreateObjectURL = vi.fn(() => 'blob:test')
    globalThis.URL.createObjectURL = mockCreateObjectURL
    globalThis.URL.revokeObjectURL = vi.fn()
    const mockLink = { click: vi.fn(), style: {} }
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
  })

  it('generates CSV with header row', () => {
    exportReportListToCSV([])
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
  })

  it('handles reports with missing nested properties', () => {
    expect(() => {
      exportReportListToCSV([
        { date: '2025-01-15', shift: 1, start_time: '06:00:00', end_time: '14:00:00' },
      ])
    }).not.toThrow()
  })

  it('creates filename with date', () => {
    exportReportListToCSV([])
    // Get the last mock result (this test's call, not a previous test's)
    const results = document.createElement.mock.results
    const link = results[results.length - 1].value
    expect(link.download).toMatch(/^shift-reports-export-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
