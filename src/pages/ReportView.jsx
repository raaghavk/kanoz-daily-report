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
        <div style={{ color: '#5A6B62', fontSize: 13 }}>Loading report...</div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div style={{ color: '#5A6B62', fontSize: 13 }}>Report not found</div>
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
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16 }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div style={{ fontSize: 10, color: '#8A9B92', fontWeight: 600, marginBottom: 4 }}>Date</div>
              <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>
                <Calendar size={16} style={{ color: '#1B7A45' }} />
                {new Date(report.date).toLocaleDateString('en-IN')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#8A9B92', fontWeight: 600, marginBottom: 4 }}>Shift</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>
                Shift {report.shift}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#8A9B92', fontWeight: 600, marginBottom: 4 }}>Time</div>
              <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>
                <Clock size={16} style={{ color: '#1E3A5F' }} />
                {report.start_time?.slice(0, 5)} → {report.end_time?.slice(0, 5)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#8A9B92', fontWeight: 600, marginBottom: 4 }}>Supervisor</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>
                {report.employees?.name || 'N/A'}
              </div>
            </div>
            <div className="col-span-2">
              <div style={{ fontSize: 10, color: '#8A9B92', fontWeight: 600, marginBottom: 4 }}>Plant</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>
                {report.plants?.name || 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Machine Timings Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Machine Timings</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', overflow: 'hidden' }}>
          <table className="w-full text-xs">
            <thead style={{ background: '#F5F7F6', borderBottom: '1px solid #E2E8E4' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Machine</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>From</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>To</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Hours</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {machineTimings.length > 0 ? (
                machineTimings.map((m, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #E2E8E4' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1A1A2E', fontSize: 11 }}>{m.name}</td>
                    <td style={{ padding: '10px 12px', color: '#5A6B62', fontSize: 11 }}>{m.from}</td>
                    <td style={{ padding: '10px 12px', color: '#5A6B62', fontSize: 11 }}>{m.to}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>{m.hours}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#5A6B62', fontSize: 11 }}>{m.breakdown_hours}h</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '16px 12px', textAlign: 'center', color: '#C5CFC8', fontSize: 11 }}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Production</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', overflow: 'hidden' }}>
          <table className="w-full text-xs">
            <thead style={{ background: '#F5F7F6', borderBottom: '1px solid #E2E8E4' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Machine</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Pellet Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Quantity (MT)</th>
              </tr>
            </thead>
            <tbody>
              {machineProduction.length > 0 ? (
                machineProduction.map(m => (
                  <tr key={m.id} style={{ borderTop: '1px solid #E2E8E4' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1A1A2E', fontSize: 11 }}>{m.machines?.name || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', color: '#5A6B62', fontSize: 11 }}>{m.pellet_type || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>{m.quantity_mt || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" style={{ padding: '16px 12px', textAlign: 'center', color: '#C5CFC8', fontSize: 11 }}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Materials Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Raw Materials</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', overflow: 'hidden' }}>
          <table className="w-full text-xs">
            <thead style={{ background: '#F5F7F6', borderBottom: '1px solid #E2E8E4' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Material</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Opening</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Purchased</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Used</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Closing</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.length > 0 ? (
                rawMaterials.map(m => (
                  <tr key={m.id} style={{ borderTop: '1px solid #E2E8E4' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1A1A2E', fontSize: 11 }}>{m.raw_materials?.name || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#5A6B62', fontSize: 11 }}>{m.opening_qty || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#5A6B62', fontSize: 11 }}>{m.purchased_qty || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#5A6B62', fontSize: 11 }}>{m.used_qty || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>{m.closing_qty || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '16px 12px', textAlign: 'center', color: '#C5CFC8', fontSize: 11 }}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equipment & Diesel Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Equipment & Diesel</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', overflow: 'hidden' }}>
          <table className="w-full text-xs">
            <thead style={{ background: '#F5F7F6', borderBottom: '1px solid #E2E8E4' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Equipment</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Opening (L)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Added (L)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Closing (L)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Hours</th>
              </tr>
            </thead>
            <tbody>
              {equipmentDiesel.length > 0 ? (
                equipmentDiesel.map(e => (
                  <tr key={e.id} style={{ borderTop: '1px solid #E2E8E4' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1A1A2E', fontSize: 11 }}>{e.equipment_name || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#5A6B62', fontSize: 11 }}>{e.opening_litres || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#5A6B62', fontSize: 11 }}>{e.added_litres || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>{e.closing_litres || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#5A6B62', fontSize: 11 }}>{e.hours_operated || 0}h</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '16px 12px', textAlign: 'center', color: '#C5CFC8', fontSize: 11 }}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatches Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Vehicle Dispatches</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', overflow: 'hidden' }}>
          <table className="w-full text-xs">
            <thead style={{ background: '#F5F7F6', borderBottom: '1px solid #E2E8E4' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Truck</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Customer</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Pellet Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Qty (MT)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.length > 0 ? (
                dispatches.map(d => (
                  <tr key={d.id} style={{ borderTop: '1px solid #E2E8E4' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1A1A2E', fontSize: 11 }}>{d.truck_number}</td>
                    <td style={{ padding: '10px 12px', color: '#5A6B62', fontSize: 11 }}>{d.customers?.name || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', color: '#5A6B62', fontSize: 11 }}>
                      {d.dispatch_pellets?.map(p => p.pellet_types?.name).join(', ') || 'N/A'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>
                      {d.dispatch_pellets?.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0).toFixed(1) || 0}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#5A6B62', fontSize: 11 }}>{d.dispatch_time?.slice(0, 5) || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '16px 12px', textAlign: 'center', color: '#C5CFC8', fontSize: 11 }}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pellet Stock Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Pellet Stock</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', overflow: 'hidden' }}>
          <table className="w-full text-xs">
            <thead style={{ background: '#F5F7F6', borderBottom: '1px solid #E2E8E4' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Opening</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Production</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Dispatch</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Wastage</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>Closing</th>
              </tr>
            </thead>
            <tbody>
              {pelletStock.length > 0 ? (
                pelletStock.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #E2E8E4' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1A1A2E', fontSize: 11 }}>{p.pellet_types?.name || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#5A6B62', fontSize: 11 }}>{p.opening_mt || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#5A6B62', fontSize: 11 }}>{p.production_mt || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#5A6B62', fontSize: 11 }}>{p.dispatch_mt || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#5A6B62', fontSize: 11 }}>{p.wastage_mt || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1A1A2E', fontSize: 11 }}>{p.closing_mt || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '16px 12px', textAlign: 'center', color: '#C5CFC8', fontSize: 11 }}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issues Section */}
      {issues.length > 0 && (
        <div style={{ padding: '0 20px', marginTop: 24 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Issues Reported</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {issues.map(issue => (
              <div key={issue.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 12 }}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <AlertTriangle size={16} style={{ color: '#E53E3E' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', textTransform: 'capitalize' }}>{issue.issue_type}</span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: 4,
                        ...(issue.severity === 'High' ? { background: '#FEE2E2', color: '#B91C1C' } :
                           issue.severity === 'Medium' ? { background: '#FEF3C7', color: '#B45309' } :
                           { background: '#DBEAFE', color: '#1E40AF' })
                      }}>
                        {issue.severity}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: '#5A6B62', marginTop: 4 }}>{issue.description}</p>
                    {issue.photo_url && (
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, color: "#1E3A5F", fontSize: 10, fontWeight: 500 }}>
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
        <div style={{ padding: '0 20px', marginTop: 24 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Handover Notes</h2>
          <div style={{ background: '#FFF8E6', border: '1.5px solid #F0D98C', borderRadius: 14, padding: 16 }}>
            <p style={{ fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>{report.handover_notes}</p>
          </div>
        </div>
      )}

      {/* Status Badge */}
      <div style={{ padding: '0 20px', marginTop: 24, paddingBottom: 16 }}>
        <div className="flex items-center justify-center gap-2" style={{ padding: '12px 0', background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4' }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: report.status === "submitted" ? "#1B7A45" : "#F59E0B" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase' }}>
            {report.status === 'submitted' ? 'Submitted' : 'Draft'}
          </span>
        </div>
      </div>
    </div>
  )
}
