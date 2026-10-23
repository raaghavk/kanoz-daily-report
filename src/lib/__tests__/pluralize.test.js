import { describe, it, expect } from 'vitest'
import { pluralize } from '../pluralize'

describe('pluralize', () => {
  it('uses the singular for one and the plural otherwise', () => {
    expect(pluralize(1, 'entry', 'entries')).toBe('1 entry')
    expect(pluralize(0, 'entry', 'entries')).toBe('0 entries')
    expect(pluralize(2, 'entry', 'entries')).toBe('2 entries')
    expect(pluralize(1, 'part')).toBe('1 part')
    expect(pluralize(3, 'part')).toBe('3 parts')
  })
})
