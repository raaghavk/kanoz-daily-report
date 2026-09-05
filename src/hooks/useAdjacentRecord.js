import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { adjacentFromIds } from '../lib/adjacentRecord'

/**
 * Load sibling record ids for plant-scoped prev/next navigation.
 * Pass orderBy matching the desired timeline (newest-first or chronological).
 *
 * Direction is inferred from the first orderBy.ascending flag:
 *  - false → newest-first indexing (newer = lower index)
 *  - true  → chronological indexing (older = lower index, oldest = position 1)
 */
export function useAdjacentRecord({ table, plantId, currentId, orderBy = [{ column: 'date', ascending: false }] }) {
  const [state, setState] = useState({
    newerId: null,
    olderId: null,
    position: null,
    total: 0,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!table || !plantId || !currentId) {
        if (!cancelled) setState(s => ({ ...s, loading: false, newerId: null, olderId: null, position: null, total: 0 }))
        return
      }
      try {
        let q = supabase
          .from(table)
          .select('id')
          .eq('plant_id', plantId)
          .eq('is_deleted', false)
        for (const o of orderBy) {
          const opts = { ascending: !!o.ascending }
          if (o.nullsFirst !== undefined) opts.nullsFirst = o.nullsFirst
          q = q.order(o.column, opts)
        }
        const { data, error } = await q
        if (error) throw error
        if (cancelled) return
        const ids = (data || []).map(r => r.id)
        const ascending = !!(orderBy[0]?.ascending)
        setState({
          ...adjacentFromIds(ids, currentId, ascending),
          loading: false,
        })
      } catch {
        if (!cancelled) setState(s => ({ ...s, loading: false, newerId: null, olderId: null }))
      }
    }
    setState(s => ({ ...s, loading: true }))
    load()
    return () => { cancelled = true }
  }, [table, plantId, currentId, JSON.stringify(orderBy)]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
