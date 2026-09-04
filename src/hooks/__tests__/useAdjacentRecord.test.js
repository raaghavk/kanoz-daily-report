import { describe, it, expect } from 'vitest'

/** Pure helper mirrored from useAdjacentRecord indexing logic (for unit test). */
function adjacentFromIds(ids, currentId) {
  const idx = ids.indexOf(currentId)
  return {
    newerId: idx > 0 ? ids[idx - 1] : null,
    olderId: idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null,
    position: idx >= 0 ? idx + 1 : null,
    total: ids.length,
  }
}

describe('adjacent record indexing', () => {
  const ids = ['newest', 'mid', 'oldest']

  it('mid has both newer and older', () => {
    expect(adjacentFromIds(ids, 'mid')).toEqual({
      newerId: 'newest',
      olderId: 'oldest',
      position: 2,
      total: 3,
    })
  })

  it('newest has only older', () => {
    expect(adjacentFromIds(ids, 'newest')).toEqual({
      newerId: null,
      olderId: 'mid',
      position: 1,
      total: 3,
    })
  })

  it('oldest has only newer', () => {
    expect(adjacentFromIds(ids, 'oldest')).toEqual({
      newerId: 'mid',
      olderId: null,
      position: 3,
      total: 3,
    })
  })

  it('unknown id yields nulls', () => {
    expect(adjacentFromIds(ids, 'missing')).toEqual({
      newerId: null,
      olderId: null,
      position: null,
      total: 3,
    })
  })
})
