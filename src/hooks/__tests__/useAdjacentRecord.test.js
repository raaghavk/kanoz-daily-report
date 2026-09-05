import { describe, it, expect } from 'vitest'
import { adjacentFromIds } from '../../lib/adjacentRecord'

describe('adjacent record indexing (newest-first)', () => {
  const ids = ['newest', 'mid', 'oldest']

  it('mid has both newer and older', () => {
    expect(adjacentFromIds(ids, 'mid', false)).toEqual({
      newerId: 'newest',
      olderId: 'oldest',
      position: 2,
      total: 3,
    })
  })

  it('newest has only older', () => {
    expect(adjacentFromIds(ids, 'newest', false)).toEqual({
      newerId: null,
      olderId: 'mid',
      position: 1,
      total: 3,
    })
  })

  it('oldest has only newer', () => {
    expect(adjacentFromIds(ids, 'oldest', false)).toEqual({
      newerId: 'mid',
      olderId: null,
      position: 3,
      total: 3,
    })
  })

  it('unknown id yields nulls', () => {
    expect(adjacentFromIds(ids, 'missing', false)).toEqual({
      newerId: null,
      olderId: null,
      position: null,
      total: 3,
    })
  })
})

describe('adjacent record indexing (chronological ascending)', () => {
  const ids = ['oldest', 'mid', 'newest']

  it('mid has both older and newer; position is chronological', () => {
    expect(adjacentFromIds(ids, 'mid', true)).toEqual({
      olderId: 'oldest',
      newerId: 'newest',
      position: 2,
      total: 3,
    })
  })

  it('oldest is position 1 and only has newer', () => {
    expect(adjacentFromIds(ids, 'oldest', true)).toEqual({
      olderId: null,
      newerId: 'mid',
      position: 1,
      total: 3,
    })
  })

  it('newest is last and only has older', () => {
    expect(adjacentFromIds(ids, 'newest', true)).toEqual({
      olderId: 'mid',
      newerId: null,
      position: 3,
      total: 3,
    })
  })
})
