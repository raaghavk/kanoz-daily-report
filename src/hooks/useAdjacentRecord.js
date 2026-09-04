import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Load sibling record ids for plant-scoped prev/next navigation.
 * `orderBy` must match the list screen sort (newest-first recommended).
 *
 * Returns:
 *  - newerId: previous index in a desc-sorted list (more recent)
 *  - olderId: next index (older)
 *  - position / total for "3 of 40" labels
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
          q = q.order(o.column, { ascending: !!o.ascending })
        }
        const { data, error } = await q
        if (error) throw error
        if (cancelled) return
        const ids = (data || []).map(r => r.id)
        const idx = ids.indexOf(currentId)
        setState({
          newerId: idx > 0 ? ids[idx - 1] : null,
          olderId: idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null,
          position: idx >= 0 ? idx + 1 : null,
          total: ids.length,
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
