import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useShiftReport(editId, plantId) {
  return useQuery({
    queryKey: ['shiftReport', editId],
    queryFn: async () => {
      const { data: report, error } = await supabase
        .from('shift_reports')
        .select('*')
        .eq('id', editId)
        .single()

      if (error) throw error
      if (!report) throw new Error('Report not found')

      const [machProd, rmUsage, diesel, pStock, issuesData, dStock, dPurchases] = await Promise.all([
        supabase.from('machine_production').select('*, machines(name)').eq('shift_report_id', editId),
        supabase.from('raw_material_usage').select('*, raw_material_types(name)').eq('shift_report_id', editId),
        supabase.from('equipment_diesel_log').select('*').eq('shift_report_id', editId),
        supabase.from('pellet_stock').select('*, pellet_types(name)').eq('shift_report_id', editId),
        supabase.from('issues').select('*').eq('shift_report_id', editId),
        supabase.from('diesel_stock').select('*').eq('shift_report_id', editId).maybeSingle(),
        supabase.from('diesel_purchases').select('*').eq('shift_report_id', editId),
      ])

      return {
        report,
        machineProduction: machProd.data || [],
        rawMaterialUsage: rmUsage.data || [],
        dieselLog: diesel.data || [],
        pelletStock: pStock.data || [],
        issues: issuesData.data || [],
        dieselStock: dStock.data,
        dieselPurchases: dPurchases.data || [],
      }
    },
    enabled: !!editId && !!plantId,
  })
}
