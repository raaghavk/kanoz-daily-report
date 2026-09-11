import { supabase } from './supabase'
import { resyncShiftReport } from './resyncReport'
import { selectCascadeReportIds } from './cascadeResyncSelect'

/**
 * Resync the first affected shift and every later one for a plant.
 * Date-agnostic: works for any month / any historical instant.
 * Returns { count } — number of reports successfully resynced.
 */
export async function cascadeResyncFrom(plantId, fromDate, fromTime) {
  if (!plantId || !fromDate) return { count: 0 }

  const { data: reports, error } = await supabase
    .from('shift_reports')
    .select('id, shift_start_date, start_time, shift_end_date, end_time')
    .eq('plant_id', plantId)
    .eq('is_deleted', false)
    .order('shift_start_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw error

  const ids = selectCascadeReportIds(reports || [], fromDate, fromTime)
  for (const id of ids) {
    await resyncShiftReport(id)
  }
  return { count: ids.length }
}

export { reportContainsInstant, selectCascadeReportIds, earlierCascadePoint } from './cascadeResyncSelect'
