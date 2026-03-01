import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'
import { Calendar, Clock, AlertTriangle, Eye } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function ReportView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [machineProduction, setMachineProduction] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [equipmentDiesel, setEquipmentDiesel] = useState([])
  const [pelletStock, setPelletStock] = useState([])
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchReport()
    }
  }, [id])

  async function fetchReport() {
    try {
      setLoading(true)

      const { data: reportData, error: reportError } = await supabase
        .from('shift_reports')
        .select('*, plants(name), employees(name)')
        .eq('id', id)
        .single()

      if (reportError) throw reportError
      if (!reportData) {
        showToast('Report not found', 'error')
        navigate('/reports')
        return
      }

      setReport(reportData)

      const { data: machData } = await supabase
        .from('machine_production')
        .select('*, machines(name)')
        .eq('shift_report_id', id)

      setMachineProduction(machData || [])

      const { data: matData } = await supabase
        .from('rm_purchases')
        .select('*, raw_materials(name)')
        .eq('shift_report_id', id)

      setRawMaterials(matData || [])

      const { data: dispatchData } = await supabase
        .from('vehicle_dispatches')
        .select('*, dispatch_pellets(*, pellet_types(name)), customers(name)')
        .eq('shift_report_id', id)

      setDispatches(dispatchData || [])

      const { data: dieselData } = await supabase
        .from('equipment_diesel_log')
        .select('*')
        .eq('shift_report_id', id)

      setEquipmentDiesel(dieselData || [])

      const { data: stockData } = await supabase
        .from('pellet_stock')
        .select('*, pellet_types(name)')
        .eq('shift_report_id', id)

      setPelletStock(stockData || [])

      const { data: issuesData } = await supabase
        .from('issues')
        .select('*')
        .eq('shift_report_id', id)

      setIssues(issuesData || [])
    } catch (err) {
      console.error('Error fetching report:', err)
      showToast('Failed to load report', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-kanoz-text-secondary">Loading report...</div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-kanoz-text-secondary">Report not found</div>
      </div>
    )
  }

  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return 'N/A'
    return `${new Date(dateStr).toLocaleDateString('en-IN')} ${timeStr}`
  }

  const machineTimings = machineProduction.map(m => ({
    name: m.machines?.name || 'Unknown',
    from: m.from_time || '-',
    to: m.to_time || '-',
    hours: m.hours || 0,
    breakdown_hours: m.breakdown_hours || 0
  }))

  return (
    <div className="pb-20">
      <PageHeader title="Shift Report" subtitle={`Shift ${report.shift} · ${report.date}`} backTo="/reports" />

      {/* Report Header Info */}
      <div className="px-4 mt-4 space-y-4">
        <div className="bg-kanoz-card rounded-xl border border-kanoz-border p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-kanoz-text-secondary font-semibold mb-1">Date</div>
              <div className="flex items-center gap-2 text-sm font-bold text-kanoz-text">
                <Calendar size={16} className="text-kanoz-green" />
                {new Date(report.date).toLocaleDateString('en-IN')}
              </div>
            </div>
            <div>
              <div className="text-xs text-kanoz-text-secondary font-semibold mb-1">Shift</div>
              <div className="text-sm font-bold text-kanoz-text">
                Shift {report.shift}
              </div>
            </div>
            <div>
              <div className="text-xs text-kanoz-text-secondary font-semibold mb-1">Time</div>
              <div className="flex items-center gap-2 text-sm font-bold text-kanoz-text">
                <Clock size={16} className="text-kanoz-blue" />
                {report.start_time?.slice(0, 5)} → {report.end_time?.slice(0, 5)}
              </div>
            </div>
            <div>
              <div className="text-xs text-kanoz-text-secondary font-semibold mb-1">Supervisor</div>
              <div className="text-sm font-bold text-kanoz-text">
                {report.employees?.name || 'N/A'}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-kanoz-text-secondary font-semibold mb-1">Plant</div>
              <div className="text-sm font-bold text-kanoz-text">
                {report.plants?.name || 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Machine Timings Section */}
      <div className="px-4 mt-6">
        <h2 className="text-xs font-bold text-kanoz-text-secondary uppercase tracking-wider mb-3">Machine Timings</h2>
        <div className="bg-kanoz-card rounded-xl border border-kanoz-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-kanoz-bg border-b border-kanoz-border">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold text-kanoz-text">Machine</th>
                <th className="px-3 py-2.5 text-left font-bold text-kanoz-text">From</th>
                <th className="px-3 py-2.5 text-left font-bold text-kanoz-text">To</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Hours</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {machineTimings.length > 0 ? (
                machineTimings.map((m, idx) => (
                  <tr key={idx} className="border-t border-kanoz-border hover:bg-kanoz-bg transition-colors">
                    <td className="px-3 py-2.5 font-medium text-kanoz-text">{m.name}</td>
                    <td className="px-3 py-2.5 text-kanoz-text-secondary">{m.from}</td>
                    <td className="px-3 py-2.5 text-kanoz-text-secondary">{m.to}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text font-bold">{m.hours}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text-secondary">{m.breakdown_hours}h</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-3 py-4 text-center text-kanoz-text-tertiary">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production Section */}
      <div className="px-4 mt-6">
        <h2 className="text-xs font-bold text-kanoz-text-secondary uppercase tracking-wider mb-3">Production</h2>
        <div className="bg-kanoz-card rounded-xl border border-kanoz-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-kanoz-bg border-b border-kanoz-border">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold text-kanoz-text">Machine</th>
                <th className="px-3 py-2.5 text-left font-bold text-kanoz-text">Pellet Type</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Quantity (MT)</th>
              </tr>
            </thead>
            <tbody>
              {machineProduction.length > 0 ? (
                machineProduction.map(m => (
                  <tr key={m.id} className="border-t border-kanoz-border hover:bg-kanoz-bg transition-colors">
                    <td className="px-3 py-2.5 font-medium text-kanoz-text">{m.machines?.name || 'N/A'}</td>
                    <td className="px-3 py-2.5 text-kanoz-text-secondary">{m.pellet_type || 'N/A'}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text font-bold">{m.quantity_mt || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="px-3 py-4 text-center text-kanoz-text-tertiary">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Materials Section */}
      <div className="px-4 mt-6">
        <h2 className="text-xs font-bold text-kanoz-text-secondary uppercase tracking-wider mb-3">Raw Materials</h2>
        <div className="bg-kanoz-card rounded-xl border border-kanoz-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-kanoz-bg border-b border-kanoz-border">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold text-kanoz-text">Material</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Opening</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Purchased</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Used</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Closing</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.length > 0 ? (
                rawMaterials.map(m => (
                  <tr key={m.id} className="border-t border-kanoz-border hover:bg-kanoz-bg transition-colors">
                    <td className="px-3 py-2.5 font-medium text-kanoz-text">{m.raw_materials?.name || 'N/A'}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text-secondary">{m.opening_qty || 0}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text-secondary">{m.purchased_qty || 0}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text-secondary">{m.used_qty || 0}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-kanoz-text">{m.closing_qty || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-3 py-4 text-center text-kanoz-text-tertiary">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equipment & Diesel Section */}
      <div className="px-4 mt-6">
        <h2 className="text-xs font-bold text-kanoz-text-secondary uppercase tracking-wider mb-3">Equipment & Diesel</h2>
        <div className="bg-kanoz-card rounded-xl border border-kanoz-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-kanoz-bg border-b border-kanoz-border">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold text-kanoz-text">Equipment</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Opening (L)</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Added (L)</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Closing (L)</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Hours</th>
              </tr>
            </thead>
            <tbody>
              {equipmentDiesel.length > 0 ? (
                equipmentDiesel.map(e => (
                  <tr key={e.id} className="border-t border-kanoz-border hover:bg-kanoz-bg transition-colors">
                    <td className="px-3 py-2.5 font-medium text-kanoz-text">{e.equipment_name || 'N/A'}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text-secondary">{e.opening_litres || 0}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text-secondary">{e.added_litres || 0}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-kanoz-text">{e.closing_litres || 0}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text-secondary">{e.hours_operated || 0}h</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-3 py-4 text-center text-kanoz-text-tertiary">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatches Section */}
      <div className="px-4 mt-6">
        <h2 className="text-xs font-bold text-kanoz-text-secondary uppercase tracking-wider mb-3">Vehicle Dispatches</h2>
        <div className="bg-kanoz-card rounded-xl border border-kanoz-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-kanoz-bg border-b border-kanoz-border">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold text-kanoz-text">Truck</th>
                <th className="px-3 py-2.5 text-left font-bold text-kanoz-text">Customer</th>
                <th className="px-3 py-2.5 text-left font-bold text-kanoz-text">Pellet Type</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Qty (MT)</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Time</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.length > 0 ? (
                dispatches.map(d => (
                  <tr key={d.id} className="border-t border-kanoz-border hover:bg-kanoz-bg transition-colors">
                    <td className="px-3 py-2.5 font-medium text-kanoz-text">{d.truck_number}</td>
                    <td className="px-3 py-2.5 text-kanoz-text-secondary">{d.customers?.name || 'N/A'}</td>
                    <td className="px-3 py-2.5 text-kanoz-text-secondary">
                      {d.dispatch_pellets?.map(p => p.pellet_types?.name).join(', ') || 'N/A'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text font-bold">
                      {d.dispatch_pellets?.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0).toFixed(1) || 0}
                    </td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text-secondary">{d.dispatch_time?.slice(0, 5) || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-3 py-4 text-center text-kanoz-text-tertiary">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pellet Stock Section */}
      <div className="px-4 mt-6">
        <h2 className="text-xs font-bold text-kanoz-text-secondary uppercase tracking-wider mb-3">Pellet Stock</h2>
        <div className="bg-kanoz-card rounded-xl border border-kanoz-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-kanoz-bg border-b border-kanoz-border">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold text-kanoz-text">Type</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Opening</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Production</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Dispatch</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Wastage</th>
                <th className="px-3 py-2.5 text-right font-bold text-kanoz-text">Closing</th>
              </tr>
            </thead>
            <tbody>
              {pelletStock.length > 0 ? (
                pelletStock.map(p => (
                  <tr key={p.id} className="border-t border-kanoz-border hover:bg-kanoz-bg transition-colors">
                    <td className="px-3 py-2.5 font-medium text-kanoz-text">{p.pellet_types?.name || 'N/A'}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text-secondary">{p.opening_mt || 0}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text-secondary">{p.production_mt || 0}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text-secondary">{p.dispatch_mt || 0}</td>
                    <td className="px-3 py-2.5 text-right text-kanoz-text-secondary">{p.wastage_mt || 0}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-kanoz-text">{p.closing_mt || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-3 py-4 text-center text-kanoz-text-tertiary">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issues Section */}
      {issues.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="text-xs font-bold text-kanoz-text-secondary uppercase tracking-wider mb-3">Issues Reported</h2>
          <div className="space-y-3">
            {issues.map(issue => (
              <div key={issue.id} className="bg-kanoz-card rounded-xl border border-kanoz-border p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <AlertTriangle size={16} className="text-kanoz-red" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-kanoz-text capitalize">{issue.issue_type}</span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                        issue.severity === 'High' ? 'bg-red-100 text-red-700' :
                        issue.severity === 'Medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-xs text-kanoz-text-secondary">{issue.description}</p>
                    {issue.photo_url && (
                      <div className="mt-2 flex items-center gap-1 text-kanoz-blue text-[10px] font-medium">
                        <Eye size={12} /> Photo attached
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Handover Notes Section */}
      {report.handover_notes && (
        <div className="px-4 mt-6">
          <h2 className="text-xs font-bold text-kanoz-text-secondary uppercase tracking-wider mb-3">Handover Notes</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-900">{report.handover_notes}</p>
          </div>
        </div>
      )}

      {/* Status Badge */}
      <div className="px-4 mt-6 pb-4">
        <div className="flex items-center justify-center gap-2 py-3 bg-kanoz-card rounded-xl border border-kanoz-border">
          <div className={`w-2 h-2 rounded-full ${report.status === 'submitted' ? 'bg-kanoz-green' : 'bg-amber-500'}`} />
          <span className="text-xs font-bold text-kanoz-text-secondary uppercase">
            {report.status === 'submitted' ? 'Submitted' : 'Draft'}
          </span>
        </div>
      </div>
    </div>
  )
}
