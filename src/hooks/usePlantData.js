import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function usePlantData(plantId) {
  return useQuery({
    queryKey: ['plantData', plantId],
    queryFn: async () => {
      const [machinesRes, materialsRes, pelletTypesRes, equipmentRes] = await Promise.all([
        supabase.from('machines').select('*').eq('plant_id', plantId).eq('is_active', true).order('sort_order'),
        supabase.from('raw_material_types').select('*').eq('plant_id', plantId).eq('is_active', true),
        supabase.from('pellet_types').select('*').eq('plant_id', plantId).eq('is_active', true),
        supabase.from('equipment').select('*').eq('plant_id', plantId).eq('is_active', true).order('sort_order'),
      ])

      // Fetch previous shift data for carry-forward
      let prevPelletStock = []
      let prevDieselLog = []
      let prevRawMaterials = []
      let prevDieselStock = null

      const { data: prevReport } = await supabase
        .from('shift_reports')
        .select('id')
        .eq('plant_id', plantId)
        .order('date', { ascending: false })
        .order('shift', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (prevReport) {
        const [psRes, dlRes, rmRes, dsRes] = await Promise.all([
          supabase.from('pellet_stock').select('*').eq('shift_report_id', prevReport.id),
          supabase.from('equipment_diesel_log').select('*').eq('shift_report_id', prevReport.id),
          supabase.from('raw_material_usage').select('*').eq('shift_report_id', prevReport.id),
          supabase.from('diesel_stock').select('*').eq('shift_report_id', prevReport.id).maybeSingle(),
        ])
        prevPelletStock = psRes.data || []
        prevDieselLog = dlRes.data || []
        prevRawMaterials = rmRes.data || []
        prevDieselStock = dsRes.data
      }

      return {
        machines: machinesRes.data || [],
        materials: materialsRes.data || [],
        pelletTypes: pelletTypesRes.data || [],
        equipment: equipmentRes.data || [],
        prevPelletStock,
        prevDieselLog,
        prevRawMaterials,
        prevDieselStock,
      }
    },
    enabled: !!plantId,
    staleTime: 5 * 60 * 1000,
  })
}
