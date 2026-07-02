import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { can } from '../../lib/permissions'
import { loadPeriod, loadDaily, loadAssets, loadSpares, latestReportDate, PERIOD_LABEL } from '../../lib/dashboardData'
import { Loader2 } from 'lucide-react'

const money = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const lakh = n => (Number(n) >= 100000 ? '₹' + (n / 100000).toFixed(1) + 'L' : money(n))
const mt = n => (Math.round(Number(n) * 100) / 100).toLocaleString('en-IN') + ' MT'
const NAV = [
  ['daily', '📅', 'Daily Report'], ['overview', '📊', 'Overview'], ['production', '🏭', 'Production'],
  ['rawmat', '🌾', 'Raw Materials'], ['dispatch', '🚛', 'Dispatch & Sales'],
  ['finance', '💰', 'Finance'], ['assets', '🛠️', 'Assets'], ['spares', '📦', 'Spare Parts'],
]

function Bars({ rows, max, fmt, color = '#2d6a4f' }) {
  const m = max || Math.max(1, ...rows.map(r => r.v))
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {rows.length === 0 && <div style={{ fontSize: 12, color: '#a7a999' }}>No data in this period.</div>}
    {rows.map((r, i) => <div key={i}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}><span style={{ fontWeight: 600 }}>{r.name}</span><span style={{ color: '#6b6f5c' }}>{fmt(r.v)}</span></div>
      <div style={{ height: 9, background: '#f0ece0', borderRadius: 6 }}><div style={{ width: (r.v / m * 100) + '%', height: '100%', background: color, borderRadius: 6 }} /></div>
    </div>)}
  </div>
}

export default function AdminDashboard() {
  const { plant, employee } = useAuth()
  const navigate = useNavigate()
  const allowed = ['admin', 'plant_manager', 'accountant'].includes(employee?.role)
  const [section, setSection] = useState('daily')
  const [period, setPeriod] = useState('mtd')
  const [date, setDate] = useState('')
  const [pd, setPd] = useState(null), [daily, setDaily] = useState(null)
  const [assets, setAssets] = useState(null), [spares, setSpares] = useState(null)
  const [realisation, setRealisation] = useState(11000)
  const [loadingP, setLoadingP] = useState(true), [loadingD, setLoadingD] = useState(true)

  useEffect(() => { if (plant?.id) { latestReportDate(plant).then(setDate); loadAssets(plant).then(setAssets); loadSpares(plant).then(setSpares) } }, [plant]) // eslint-disable-line
  useEffect(() => { if (plant?.id) { setLoadingP(true); loadPeriod(plant, period).then(d => { setPd(d); setLoadingP(false) }) } }, [plant, period]) // eslint-disable-line
  useEffect(() => { if (plant?.id && date) { setLoadingD(true); loadDaily(plant, date).then(d => { setDaily(d); setLoadingD(false) }) } }, [plant, date]) // eslint-disable-line

  if (!allowed) return <div style={S.full}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 46 }}>🔒</div><h2>Admin only</h2><p style={{ color: '#8a8d7a', fontSize: 13 }}>The dashboard is for admins & managers.</p><button style={S.btn} onClick={() => navigate('/')}>Back to app</button></div></div>

  const spin = <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} /></div>

  return (
    <div style={S.app}>
      <style>{`.kdrow:hover{background:#fbf9f1}.kdnav:hover{background:rgba(255,255,255,.06)}`}</style>
      <aside style={S.side}>
        <div style={S.brand}><div style={S.logo}>🌾</div><div><div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Kanoz Admin</div><div style={{ fontSize: 10, color: '#7fa890' }}>{plant?.name || 'Plant'}</div></div></div>
        <nav style={{ padding: 10, flex: 1 }}>
          {NAV.map(([k, ic, label]) => <button key={k} className="kdnav" onClick={() => setSection(k)} style={{ ...S.navb, ...(section === k ? S.navOn : {}) }}><span style={{ width: 20 }}>{ic}</span> {label}</button>)}
        </nav>
        <div style={{ padding: 16, fontSize: 11, color: '#6f9580', borderTop: '1px solid rgba(255,255,255,.08)', lineHeight: 1.5 }}>Admin-only · live data<br />Summaries only — detail in the sheet<button onClick={() => navigate('/')} style={{ ...S.navb, marginTop: 10, color: '#bcd4c4' }}>← Back to app</button></div>
      </aside>

      <main style={S.main}>
        <div style={S.top}>
          <div><h1 style={{ fontSize: 18, fontWeight: 800, color: '#16331f', margin: 0 }}>{NAV.find(n => n[0] === section)[2]}</h1><div style={{ fontSize: 12, color: '#8a8d7a' }}>{plant?.name} plant</div></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {section === 'daily' && <input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.pill} />}
            {['overview', 'production', 'rawmat', 'dispatch', 'finance'].includes(section) && <select value={period} onChange={e => setPeriod(e.target.value)} style={S.pill}>{Object.entries(PERIOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
            <div style={{ ...S.pill, background: '#2d6a4f', color: '#fff', border: 'none' }}>{employee?.name || 'Admin'}</div>
          </div>
        </div>
        <div style={S.wrap}>
          {section === 'daily' && (loadingD || !daily ? spin : <Daily d={daily} date={date} />)}
          {section !== 'daily' && (loadingP || !pd ? spin : <>
            {section === 'overview' && <Overview d={pd} assets={assets} spares={spares} />}
            {section === 'production' && <Production d={pd} />}
            {section === 'rawmat' && <RawMat d={pd} />}
            {section === 'dispatch' && <Dispatch d={pd} />}
            {section === 'finance' && <Finance d={pd} assets={assets} spares={spares} realisation={realisation} setR={setRealisation} />}
          </>)}
          {section === 'assets' && (!assets ? spin : <Assets a={assets} />)}
          {section === 'spares' && (!spares ? spin : <Spares s={spares} />)}
        </div>
      </main>
    </div>
  )
}

/* ---- sections ---- */
const Kpi = ({ l, n, sub }) => <div style={S.kpi}><div style={{ fontSize: 12, color: '#8a8d7a', fontWeight: 600 }}>{l}</div><div style={{ fontSize: 24, fontWeight: 800, marginTop: 5 }}>{n}</div>{sub && <div style={{ fontSize: 11.5, color: '#8a8d7a', marginTop: 3 }}>{sub}</div>}</div>
const Card = ({ title, sub, children }) => <div style={S.card}><div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>{sub && <div style={{ fontSize: 11.5, color: '#8a8d7a', margin: '2px 0 14px' }}>{sub}</div>}{children}</div>

function Daily({ d, date }) {
  const tot = d.shifts.reduce((a, s) => { a.total += s.total; d.machines.forEach(m => a.bm[m] = (a.bm[m] || 0) + (s.byMachine[m] || 0)); return a }, { total: 0, bm: {} })
  return <>
    <div style={S.kpis}><Kpi l="Production" n={mt(d.production)} /><Kpi l="RM used" n={d.rmUsed.toLocaleString('en-IN') + ' kg'} /><Kpi l="RM purchased" n={d.rmPurchased.toLocaleString('en-IN') + ' kg'} /><Kpi l="Dispatched" n={mt(d.dispatched)} /></div>
    {d.shifts.length === 0 ? <Card title="No shift report" sub={'Nothing recorded for ' + date}><div style={{ fontSize: 12, color: '#a7a999' }}>Pick another date.</div></Card> :
      <div style={S.g2}>
        <Card title="Shift-wise production" sub="Machine split · MT">
          <table style={S.table}><thead><tr><Th>Shift</Th><Th>Total</Th>{d.machines.map(m => <Th key={m}>{m}</Th>)}</tr></thead><tbody>
            {d.shifts.map((s, i) => <tr key={i} className="kdrow"><Td b>Shift {s.shift}</Td><Td>{s.total}</Td>{d.machines.map(m => <Td key={m}>{s.byMachine[m] || 0}</Td>)}</tr>)}
            <tr style={{ fontWeight: 800, background: '#f6f3ea' }}><Td>Total</Td><Td>{tot.total}</Td>{d.machines.map(m => <Td key={m}>{tot.bm[m] || 0}</Td>)}</tr>
          </tbody></table>
        </Card>
        <Card title="Raw material" sub="Purchased & used this day · kg">
          <table style={S.table}><thead><tr><Th>Material</Th><Th>Purchased</Th><Th>Used</Th></tr></thead><tbody>
            {d.rm.length === 0 ? <tr><Td>—</Td><Td>0</Td><Td>0</Td></tr> : d.rm.map((r, i) => <tr key={i} className="kdrow"><Td b>{r.type}</Td><Td>{r.purchased.toLocaleString('en-IN')}</Td><Td>{r.used.toLocaleString('en-IN')}</Td></tr>)}
          </tbody></table>
        </Card>
      </div>}
    <Card title="Dispatches this day" sub={d.dispatch.length + ' load(s)'}>
      <table style={S.table}><thead><tr><Th>Customer</Th><Th>Pellet type</Th><Th right>Qty (MT)</Th></tr></thead><tbody>
        {d.dispatch.length === 0 ? <tr><Td>—</Td><Td></Td><Td right>0</Td></tr> : d.dispatch.map((x, i) => <tr key={i} className="kdrow"><Td b>{x.customer}</Td><Td>{x.type}</Td><Td right>{x.qty}</Td></tr>)}
      </tbody></table>
      <div style={S.muted}>Day summary. The full line-by-line ledger lives in the spreadsheet.</div>
    </Card>
  </>
}

function Overview({ d, assets, spares }) {
  const costMT = d.production ? (d.rmSpend + d.spareSpend) / d.production : 0
  return <>
    <div style={S.kpis}><Kpi l="Production" n={mt(d.production)} /><Kpi l="Dispatched" n={mt(d.dispatched)} /><Kpi l="RM spend" n={lakh(d.rmSpend)} /><Kpi l="Cost / MT (RM+spares)" n={money(costMT)} /></div>
    <div style={S.g2}>
      <Card title="Production by day" sub="This period · MT"><Bars rows={d.prodByDay.map(x => ({ name: x.date, v: x.mt }))} fmt={mt} /></Card>
      <Card title="Needs attention" sub="Live from assets & spares">
        {assets?.flagged?.map(a => <div key={a.id} style={{ ...S.alert, background: '#fee2e2', color: '#b91c1c' }}>🛠️ <b>{a.code}</b> — repairs {Math.round(a.ratio * 100)}% of new. Replace.</div>)}
        {assets?.atRepair?.map(a => <div key={a.id} style={{ ...S.alert, background: '#fef3c7', color: '#b45309' }}>🚚 <b>{a.code}</b> at {a.current_location || 'vendor'}.</div>)}
        {spares?.low?.map((s, i) => <div key={i} style={{ ...S.alert, background: '#fef3c7', color: '#b45309' }}>📦 <b>{s.name}</b> — {s.stock} {s.unit} left (min {s.min}).</div>)}
        {!(assets?.flagged?.length || assets?.atRepair?.length || spares?.low?.length) && <div style={{ fontSize: 12, color: '#a7a999' }}>All clear.</div>}
      </Card>
    </div>
  </>
}

function Production({ d }) {
  const max = Math.max(1, ...d.byMachine.map(m => m.mt))
  return <>
    <div style={S.kpis}><Kpi l="Production" n={mt(d.production)} /><Kpi l="Machines active" n={d.byMachine.length} /><Kpi l="Power used" n={Math.round(d.power).toLocaleString('en-IN') + ' kWh'} /><Kpi l="kWh / MT" n={d.production ? Math.round(d.power / d.production) : '—'} /></div>
    <div style={S.g2}>
      <Card title="Output by machine" sub="This period · MT"><Bars rows={d.byMachine.map(m => ({ name: m.name, v: m.mt }))} max={max} fmt={mt} /></Card>
      <Card title="Machine detail" sub="Hours & breakdown">
        <table style={S.table}><thead><tr><Th>Machine</Th><Th>Output</Th><Th>Run hrs</Th><Th>Breakdown</Th></tr></thead><tbody>
          {d.byMachine.length === 0 ? <tr><Td>—</Td><Td>0</Td><Td>0</Td><Td>0</Td></tr> : d.byMachine.map((m, i) => <tr key={i} className="kdrow"><Td b>{m.name}</Td><Td>{mt(m.mt)}</Td><Td>{m.hours} h</Td><Td>{m.breakdown} h</Td></tr>)}
        </tbody></table>
      </Card>
    </div>
  </>
}

function RawMat({ d }) {
  return <>
    <div style={S.kpis}><Kpi l="RM purchased" n={(d.rmKg / 1000).toFixed(1) + ' MT'} /><Kpi l="RM spend" n={lakh(d.rmSpend)} /><Kpi l="Avg cost / kg" n={d.rmKg ? '₹' + (d.rmSpend / d.rmKg).toFixed(2) : '—'} /><Kpi l="Materials" n={d.rmByType.length} /></div>
    <Card title="By material" sub="This period">
      <table style={S.table}><thead><tr><Th>Material</Th><Th>Purchased (kg)</Th><Th>Spend</Th><Th>Avg ₹/kg</Th></tr></thead><tbody>
        {d.rmByType.length === 0 ? <tr><Td>—</Td><Td>0</Td><Td>₹0</Td><Td>—</Td></tr> : d.rmByType.map((r, i) => <tr key={i} className="kdrow"><Td b>{r.type}</Td><Td>{r.kg.toLocaleString('en-IN')}</Td><Td>{money(r.spend)}</Td><Td>{r.kg ? '₹' + (r.spend / r.kg).toFixed(2) : '—'}</Td></tr>)}
      </tbody></table>
    </Card>
  </>
}

function Dispatch({ d }) {
  return <>
    <div style={S.kpis}><Kpi l="Dispatched" n={mt(d.dispatched)} /><Kpi l="Customers" n={d.byCustomer.length} /><Kpi l="Top customer" n={d.byCustomer[0]?.name || '—'} sub={d.byCustomer[0] ? mt(d.byCustomer[0].mt) : ''} /><Kpi l="Avg / customer" n={d.byCustomer.length ? mt(d.dispatched / d.byCustomer.length) : '—'} /></div>
    <Card title="Dispatch by customer" sub="This period · MT"><Bars rows={d.byCustomer.map(c => ({ name: c.name, v: c.mt }))} fmt={mt} color="#d97706" /></Card>
  </>
}

function Finance({ d, assets, spares, realisation, setR }) {
  const repair = assets?.lifetimeRepair || 0
  const totalCost = d.rmSpend + d.spareSpend
  const revenue = realisation * d.dispatched
  const gp = revenue - totalCost
  const margin = revenue ? gp / revenue * 100 : 0
  return <>
    <div style={S.kpis}>
      <Kpi l="RM spend" n={lakh(d.rmSpend)} /><Kpi l="Spare parts spend" n={money(d.spareSpend)} /><Kpi l="Asset repair (lifetime)" n={money(repair)} /><Kpi l="Cost / MT produced" n={d.production ? money(totalCost / d.production) : '—'} />
    </div>
    <Card title="Profitability" sub="Revenue needs a sale rate — no sale price is stored, so enter your average realisation">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>Avg realisation ₹/MT</span>
        <input type="number" value={realisation} onChange={e => setR(Number(e.target.value) || 0)} style={{ ...S.pill, width: 130 }} />
      </div>
      <table style={S.table}><tbody>
        <tr className="kdrow"><Td b>Revenue (est.)</Td><Td right>{lakh(revenue)}</Td></tr>
        <tr className="kdrow"><Td>Raw material</Td><Td right>{lakh(d.rmSpend)}</Td></tr>
        <tr className="kdrow"><Td>Spare parts</Td><Td right>{money(d.spareSpend)}</Td></tr>
        <tr className="kdrow"><Td b>Gross profit (est.)</Td><Td right style={{ color: gp >= 0 ? '#15803d' : '#b91c1c', fontWeight: 800 }}>{lakh(gp)}</Td></tr>
        <tr className="kdrow"><Td b>Margin</Td><Td right style={{ fontWeight: 800 }}>{margin.toFixed(1)}%</Td></tr>
      </tbody></table>
      <div style={S.muted}>Estimate only — conversion costs (power, labour) not yet captured per-period. We can add them next.</div>
    </Card>
  </>
}

function Assets({ a }) {
  return <>
    <div style={S.kpis}><Kpi l="Active assets" n={a.active} /><Kpi l="Lifetime repair spend" n={money(a.lifetimeRepair)} /><Kpi l="Out for repair" n={a.atRepair.length} /><Kpi l="Flagged: replace" n={a.flagged.length} /></div>
    <Card title="Repair vs. replace" sub="Auto-flagged from repair history">
      <table style={S.table}><thead><tr><Th>Asset</Th><Th>Repairs</Th><Th>Spend</Th><Th>Ratio</Th><Th>Call</Th></tr></thead><tbody>
        {a.rvr.length === 0 ? <tr><Td>No repairs logged yet</Td><Td></Td><Td></Td><Td></Td><Td></Td></tr> : a.rvr.map((r, i) => { const c = r.ratio >= 0.5 ? ['#fee2e2', '#b91c1c', 'REPLACE'] : r.ratio >= 0.3 ? ['#fef3c7', '#b45309', 'WATCH'] : ['#dcfce7', '#15803d', 'REPAIR OK']; return <tr key={i} className="kdrow"><Td b>{r.code}</Td><Td>{r.repairs}×</Td><Td>{money(r.spend)}</Td><Td>{Math.round(r.ratio * 100)}%</Td><Td><span style={{ background: c[0], color: c[1], fontWeight: 800, fontSize: 10.5, padding: '3px 9px', borderRadius: 20 }}>{c[2]}</span></Td></tr> })}
      </tbody></table>
    </Card>
  </>
}

function Spares({ s }) {
  return <>
    <div style={S.kpis}><Kpi l="Parts tracked" n={s.items.length} /><Kpi l="Low stock" n={s.low.length} /><Kpi l="Spend (all time)" n={money(s.spend)} /><Kpi l="In stock (units)" n={s.items.reduce((a, i) => a + Math.max(0, i.stock), 0)} /></div>
    <Card title="Low stock — reorder" sub="At or below plant minimum">
      <table style={S.table}><thead><tr><Th>Part</Th><Th>In stock</Th><Th>Min</Th></tr></thead><tbody>
        {s.low.length === 0 ? <tr><Td>Nothing below minimum 👍</Td><Td></Td><Td></Td></tr> : s.low.map((i, k) => <tr key={k} className="kdrow"><Td b>{i.name}</Td><Td>{i.stock} {i.unit}</Td><Td>{i.min}</Td></tr>)}
      </tbody></table>
    </Card>
  </>
}

const Th = ({ children, right }) => <th style={{ textAlign: right ? 'right' : 'left', color: '#8a8d7a', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.3px', padding: 8, borderBottom: '1.5px solid #eee7d5' }}>{children}</th>
const Td = ({ children, b, right, style }) => <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3efe4', fontWeight: b ? 700 : 400, textAlign: right ? 'right' : 'left', fontSize: 12.5, ...style }}>{children}</td>

const S = {
  full: { position: 'fixed', inset: 0, background: '#fefae0', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  app: { position: 'fixed', inset: 0, display: 'flex', background: '#eceae0', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', color: '#22241c' },
  side: { width: 232, background: '#16331f', color: '#cfe3d6', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  brand: { padding: 20, display: 'flex', gap: 11, alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.08)' },
  logo: { width: 36, height: 36, borderRadius: 10, background: '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 },
  navb: { display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', border: 'none', background: 'none', color: '#bcd4c4', fontSize: 13.5, fontWeight: 600, borderRadius: 9, cursor: 'pointer', textAlign: 'left', width: '100%' },
  navOn: { background: '#2d6a4f', color: '#fff' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  top: { background: '#fff', borderBottom: '1px solid #e3ddcf', padding: '13px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  wrap: { padding: '22px 28px 60px', overflowY: 'auto', flex: 1 },
  pill: { border: '1.5px solid #e3ddcf', background: '#fff', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: '#44483a', outline: 'none' },
  btn: { marginTop: 16, padding: '10px 20px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 18 },
  kpi: { background: '#fff', border: '1px solid #e8e3d6', borderRadius: 16, padding: '15px 17px' },
  g2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 },
  card: { background: '#fff', border: '1px solid #e8e3d6', borderRadius: 16, padding: 18, marginBottom: 18 },
  table: { width: '100%', borderCollapse: 'collapse' },
  alert: { display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 10, marginBottom: 8, fontSize: 12.5 },
  muted: { fontSize: 11.5, color: '#a7a999', marginTop: 10 },
}
