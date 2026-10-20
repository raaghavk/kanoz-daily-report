import { DEMO_EMAIL, DEMO_ADMIN_NAME } from './mode.js'
import { IDS } from './ids.js'
import { createDemoSeed } from './seed.js'
import { parseSelect, resolveRelation } from './relations.js'
import { answerDemoQuestion } from './answers.js'
import { normalizePurchaseSerial } from '../purchaseSerial.js'

const SESSION_KEY = 'kanoz_demo_session'
const STORE_VERSION = 1

let store = null
const authListeners = new Set()

function deleteWhere(table, pred) {
  const db = getDemoStore()
  db[table] = (db[table] || []).filter(r => !pred(r))
}

function pushRow(table, row) {
  tableRows(table).push({ id: row.id || newId(), ...row })
}

function replaceShiftReportChildren(reportId, payload) {
  if (!reportId) {
    return { data: null, error: { message: 'shift report not found', name: 'DemoModeError' } }
  }
  const report = tableRows('shift_reports').find(r => r.id === reportId)
  if (!report) {
    return { data: null, error: { message: 'shift report not found', name: 'DemoModeError' } }
  }
  const body = payload || {}
  const mixIds = tableRows('shift_mixes').filter(m => m.shift_report_id === reportId).map(m => m.id)
  deleteWhere('machine_production', r => r.shift_report_id === reportId)
  deleteWhere('shift_mix_machine_usage', r => r.shift_report_id === reportId || mixIds.includes(r.mix_id))
  deleteWhere('shift_mix_compositions', r => mixIds.includes(r.mix_id))
  deleteWhere('shift_mixes', r => r.shift_report_id === reportId)
  deleteWhere('raw_material_usage', r => r.shift_report_id === reportId)
  deleteWhere('processing_runs', r => r.shift_report_id === reportId)
  deleteWhere('equipment_diesel_log', r => r.shift_report_id === reportId)
  deleteWhere('pellet_stock', r => r.shift_report_id === reportId)
  deleteWhere('issues', r => r.shift_report_id === reportId)
  deleteWhere('diesel_purchases', r => r.shift_report_id === reportId)
  deleteWhere('diesel_stock', r => r.shift_report_id === reportId)

  for (const x of body.machine_production || []) {
    pushRow('machine_production', { ...x, shift_report_id: reportId })
  }
  for (const x of body.raw_material_usage || []) {
    pushRow('raw_material_usage', { ...x, shift_report_id: reportId })
  }
  for (const x of body.processing_runs || []) {
    pushRow('processing_runs', { ...x, shift_report_id: reportId })
  }
  for (const x of body.equipment_diesel_log || []) {
    pushRow('equipment_diesel_log', { ...x, shift_report_id: reportId })
  }
  for (const x of body.pellet_stock || []) {
    pushRow('pellet_stock', { ...x, shift_report_id: reportId })
  }
  for (const x of body.issues || []) {
    pushRow('issues', { ...x, shift_report_id: reportId, is_resolved: false })
  }
  if (body.diesel_stock && typeof body.diesel_stock === 'object' && !Array.isArray(body.diesel_stock)) {
    pushRow('diesel_stock', { ...body.diesel_stock, shift_report_id: reportId })
  }
  for (const x of body.diesel_purchases || []) {
    pushRow('diesel_purchases', { ...x, shift_report_id: reportId })
  }
  for (const mix of body.mixes || []) {
    const { compositions, machine_usages, ...mixRow } = mix
    const mixId = newId()
    pushRow('shift_mixes', { ...mixRow, id: mixId, shift_report_id: reportId })
    for (const c of compositions || []) {
      pushRow('shift_mix_compositions', { ...c, mix_id: mixId })
    }
    for (const u of machine_usages || []) {
      pushRow('shift_mix_machine_usage', { ...u, mix_id: mixId, shift_report_id: reportId })
    }
  }
  return { data: null, error: null }
}

export function getDemoStore() {
  if (!store) resetDemoStore()
  return store
}

export function resetDemoStore() {
  store = createDemoSeed()
  return store
}

function tableRows(name) {
  const db = getDemoStore()
  if (!db[name]) db[name] = []
  return db[name]
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function clone(v) {
  return JSON.parse(JSON.stringify(v))
}

function uniqueViolation(message) {
  return { data: null, error: { message, code: '23505', details: 'serial_no' }, count: 0, status: 409, statusText: 'Conflict' }
}

function purchaseSerialTaken(row, ignoreId) {
  const serial = normalizePurchaseSerial(row?.serial_no)
  if (!serial || !row?.plant_id) return false
  return tableRows('raw_material_purchases').some(existing =>
    existing.id !== ignoreId
    && !existing.is_deleted
    && coerceEq(existing.plant_id, row.plant_id)
    && normalizePurchaseSerial(existing.serial_no) === serial
  )
}

const SOFT_DELETE_TABLES = new Set([
  'finance_costs', 'stock_transfers', 'shift_reports', 'vehicle_dispatches', 'raw_material_purchases',
])
const ACTIVE_TABLES = new Set([
  'assets', 'customers', 'suppliers', 'transporters', 'spare_parts', 'vehicles',
  'employees', 'transporter_vehicles', 'spare_parts_suppliers', 'pellet_types',
  'raw_material_types', 'machines', 'equipment', 'storage_plots',
])

function withInsertDefaults(table, r) {
  const row = { ...r, id: r.id || newId() }
  if (row.is_deleted === undefined && SOFT_DELETE_TABLES.has(table)) row.is_deleted = false
  if (row.is_active === undefined && ACTIVE_TABLES.has(table)) row.is_active = true
  if (row.created_at === undefined) row.created_at = new Date().toISOString()
  return row
}

function coerceEq(rowVal, filterVal) {
  if (rowVal === filterVal) return true
  if (rowVal == null && (filterVal === null || filterVal === undefined)) return true
  if (typeof rowVal === 'boolean' || typeof filterVal === 'boolean') {
    return String(rowVal) === String(filterVal)
  }
  if (rowVal != null && filterVal != null && String(rowVal) === String(filterVal)) return true
  return false
}

function applyFilter(row, f) {
  const v = row[f.column]
  switch (f.op) {
    case 'eq': return coerceEq(v, f.value)
    case 'neq': return !coerceEq(v, f.value)
    case 'gt': return v > f.value
    case 'gte': return v >= f.value
    case 'lt': return v < f.value
    case 'lte': return v <= f.value
    case 'in': {
      const list = Array.isArray(f.value) ? f.value : []
      if (list.length === 0) return false
      return list.some(x => coerceEq(v, x))
    }
    case 'is': {
      if (f.value === null) return v === null || v === undefined
      return coerceEq(v, f.value)
    }
    case 'ilike': {
      const pattern = String(f.value || '').replace(/%/g, '.*').replace(/_/g, '.')
      return new RegExp(`^${pattern}$`, 'i').test(String(v ?? ''))
    }
    case 'like': {
      const pattern = String(f.value || '').replace(/%/g, '.*').replace(/_/g, '.')
      return new RegExp(`^${pattern}$`).test(String(v ?? ''))
    }
    case 'or': return f.clauses.some(c => applyFilter(row, c))
    case 'not': return !applyFilter(row, f.inner)
    default: return true
  }
}

function parseOrClause(expr) {
  // e.g. "is_deleted.is.null,is_deleted.eq.false"
  return String(expr).split(',').map(part => {
    const bits = part.trim().split('.')
    const column = bits[0]
    const op = bits[1]
    const rest = bits.slice(2).join('.')
    let value = rest
    if (op === 'is' && rest === 'null') value = null
    else if (rest === 'true') value = true
    else if (rest === 'false') value = false
    return { op, column, value }
  })
}

function compareValues(a, b, nullsFirst) {
  const aNull = a === null || a === undefined || a === ''
  const bNull = b === null || b === undefined || b === ''
  if (aNull && bNull) return 0
  if (aNull) return nullsFirst ? -1 : 1
  if (bNull) return nullsFirst ? 1 : -1
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function projectRow(row, parsed, parentTable) {
  const db = getDemoStore()
  let out
  if (parsed.star || parsed.columns.length === 0) {
    out = { ...row }
  } else {
    out = {}
    for (const col of parsed.columns) {
      if (col in row) out[col] = row[col]
    }
    if ('id' in row && !('id' in out) && parsed.embeds.length) out.id = row.id
  }
  for (const embed of parsed.embeds) {
    const rel = resolveRelation(parentTable, embed)
    const childRows = db[rel.table] || []
    if (rel.many) {
      const matched = childRows.filter(c => coerceEq(c[rel.foreign], row[rel.local]))
      out[embed.alias] = matched.map(c => projectRow(c, embed.inner, rel.table))
    } else {
      const found = childRows.find(c => coerceEq(c[rel.foreign], row[rel.local]))
      out[embed.alias] = found ? projectRow(found, embed.inner, rel.table) : null
    }
  }
  return out
}

function execute(state) {
  const rows = tableRows(state.table)
  const parsed = parseSelect(state.selectArg)

  if (state.action === 'insert') {
    for (const r of state.insertRows || []) {
      if (state.table === 'raw_material_purchases' && purchaseSerialTaken(r)) {
        return Promise.resolve(uniqueViolation('A purchase with this serial already exists for this plant'))
      }
    }
    const inserted = (state.insertRows || []).map(r => {
      const row = withInsertDefaults(state.table, r)
      rows.push(row)
      return row
    })
    return finish(state, inserted, parsed)
  }

  if (state.action === 'upsert') {
    const incoming = state.upsertRows || []
    const keys = (state.onConflict || 'id').split(',').map(s => s.trim())
    const result = []
    for (const r of incoming) {
      const idx = rows.findIndex(existing => keys.every(k => coerceEq(existing[k], r[k])))
      if (state.table === 'raw_material_purchases' && purchaseSerialTaken(r, idx >= 0 ? rows[idx].id : null)) {
        return Promise.resolve(uniqueViolation('A purchase with this serial already exists for this plant'))
      }
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...r }
        result.push(rows[idx])
      } else {
        const row = withInsertDefaults(state.table, r)
        rows.push(row)
        result.push(row)
      }
    }
    return finish(state, result, parsed)
  }

  let matched = rows.filter(row => state.filters.every(f => applyFilter(row, f)))

  if (state.action === 'update') {
    matched.forEach(row => Object.assign(row, state.updatePatch || {}))
    return finish(state, matched, parsed)
  }

  if (state.action === 'delete') {
    const ids = new Set(matched.map(r => r.id))
    const kept = rows.filter(r => !ids.has(r.id))
    store[state.table] = kept
    return finish(state, matched, parsed)
  }

  // select
  for (let i = state.orderBy.length - 1; i >= 0; i -= 1) {
    const o = state.orderBy[i]
    matched = matched.slice().sort((a, b) => {
      const dir = o.ascending ? 1 : -1
      return dir * compareValues(a[o.column], b[o.column], !!o.nullsFirst)
    })
  }
  const count = matched.length
  if (state.offset) matched = matched.slice(state.offset)
  if (state.limit != null) matched = matched.slice(0, state.limit)

  if (state.selectOpts?.head) {
    return Promise.resolve({ data: null, error: null, count, status: 200, statusText: 'OK' })
  }

  const projected = matched.map(r => projectRow(clone(r), parsed, state.table))
  return finish(state, projected, parsed, count)
}

function finish(state, rows, parsed, count = rows.length) {
  if (state.wantSingle) {
    if (rows.length === 0) {
      return Promise.resolve({
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
        count,
        status: 406,
        statusText: 'Not Acceptable',
      })
    }
    return Promise.resolve({ data: clone(rows[0]), error: null, count, status: 200, statusText: 'OK' })
  }
  if (state.wantMaybeSingle) {
    if (rows.length === 0) return Promise.resolve({ data: null, error: null, count: 0, status: 200, statusText: 'OK' })
    return Promise.resolve({ data: clone(rows[0]), error: null, count, status: 200, statusText: 'OK' })
  }
  if (state.action !== 'select' && !state.didSelect) {
    return Promise.resolve({ data: null, error: null, count, status: 201, statusText: 'Created' })
  }
  return Promise.resolve({ data: clone(rows), error: null, count, status: 200, statusText: 'OK' })
}

function createQuery(table) {
  const state = {
    table,
    action: 'select',
    selectArg: '*',
    selectOpts: {},
    filters: [],
    orderBy: [],
    limit: null,
    offset: null,
    wantSingle: false,
    wantMaybeSingle: false,
    insertRows: null,
    updatePatch: null,
    upsertRows: null,
    onConflict: null,
    didSelect: false,
  }

  const api = {
    select(columns = '*', opts = {}) {
      state.selectArg = columns
      state.selectOpts = opts || {}
      state.didSelect = true
      return api
    },
    insert(payload) {
      state.action = 'insert'
      state.insertRows = Array.isArray(payload) ? payload : [payload]
      return api
    },
    update(patch) {
      state.action = 'update'
      state.updatePatch = patch
      return api
    },
    upsert(payload, opts = {}) {
      state.action = 'upsert'
      state.upsertRows = Array.isArray(payload) ? payload : [payload]
      state.onConflict = opts.onConflict || 'id'
      return api
    },
    delete() {
      state.action = 'delete'
      return api
    },
    eq(column, value) { state.filters.push({ op: 'eq', column, value }); return api },
    neq(column, value) { state.filters.push({ op: 'neq', column, value }); return api },
    gt(column, value) { state.filters.push({ op: 'gt', column, value }); return api },
    gte(column, value) { state.filters.push({ op: 'gte', column, value }); return api },
    lt(column, value) { state.filters.push({ op: 'lt', column, value }); return api },
    lte(column, value) { state.filters.push({ op: 'lte', column, value }); return api },
    in(column, value) { state.filters.push({ op: 'in', column, value }); return api },
    is(column, value) { state.filters.push({ op: 'is', column, value }); return api },
    ilike(column, value) { state.filters.push({ op: 'ilike', column, value }); return api },
    like(column, value) { state.filters.push({ op: 'like', column, value }); return api },
    or(expr) { state.filters.push({ op: 'or', clauses: parseOrClause(expr) }); return api },
    not(column, op, value) {
      state.filters.push({ op: 'not', inner: { op, column, value } })
      return api
    },
    match(obj) {
      Object.entries(obj || {}).forEach(([column, value]) => state.filters.push({ op: 'eq', column, value }))
      return api
    },
    order(column, opts = {}) {
      state.orderBy.push({ column, ascending: opts.ascending !== false, nullsFirst: opts.nullsFirst })
      return api
    },
    limit(n) { state.limit = n; return api },
    range(from, to) {
      state.offset = from
      state.limit = to - from + 1
      return api
    },
    single() { state.wantSingle = true; return api },
    maybeSingle() { state.wantMaybeSingle = true; return api },
    then(onFulfilled, onRejected) {
      return execute(state).then(onFulfilled, onRejected)
    },
    catch(onRejected) {
      return execute(state).catch(onRejected)
    },
  }
  return api
}

function demoUser() {
  return {
    id: IDS.authJordan,
    email: DEMO_EMAIL,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'demo' },
    user_metadata: { name: DEMO_ADMIN_NAME, demo: true },
  }
}

export function demoSession() {
  return {
    access_token: 'demo-access-token',
    refresh_token: 'demo-refresh-token',
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: demoUser(),
  }
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.user?.id) return null
    return parsed
  } catch {
    return null
  }
}

function writeSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch { /* ignore */ }
}

function emitAuth(event, session) {
  authListeners.forEach(cb => {
    try { cb(event, session) } catch { /* ignore */ }
  })
}

const STUBBED_FUNCTIONS = {
  'extract-receipt': 'Receipt OCR',
  'parse-voice-entry': 'Voice entry',
  'ai-query': 'AI assistant',
  'plant-chat': 'AI assistant',
  'invite-user': 'User invite',
  'set-user-password': 'Password reset',
  'delete-user': 'User delete',
  'send-push-notification': 'Push notifications',
  'sync-to-sheets': 'Sheets sync',
}

export function createDemoClient() {
  resetDemoStore()
  authListeners.clear()

  const auth = {
    async getSession() {
      return { data: { session: readSession() }, error: null }
    },
    async getUser() {
      const session = readSession()
      return { data: { user: session?.user ?? null }, error: null }
    },
    onAuthStateChange(callback) {
      authListeners.add(callback)
      return {
        data: {
          subscription: {
            unsubscribe() { authListeners.delete(callback) },
          },
        },
      }
    },
    async signInWithPassword({ email }) {
      const normalized = String(email || '').trim().toLowerCase()
      if (normalized !== DEMO_EMAIL) {
        return {
          data: { user: null, session: null },
          error: { message: `Demo login is ${DEMO_EMAIL} (any password).` },
        }
      }
      const session = demoSession()
      writeSession(session)
      queueMicrotask(() => emitAuth('SIGNED_IN', session))
      return { data: { user: session.user, session }, error: null }
    },
    async signOut() {
      writeSession(null)
      emitAuth('SIGNED_OUT', null)
      return { error: null }
    },
  }

  const functions = {
    async invoke(name, opts = {}) {
      const label = STUBBED_FUNCTIONS[name] || 'This feature'
      const message = `${label} is not available in demo`
      if (name === 'ai-query' || name === 'plant-chat') {
        const question = opts?.body?.question || ''
        return {
          data: { answer: answerDemoQuestion(question, { fn: name, db: getDemoStore() }) },
          error: null,
        }
      }
      return { data: null, error: { message, name: 'DemoModeError' } }
    },
  }

  const storage = {
    from() {
      return {
        async upload(path) {
          return { data: { path }, error: null }
        },
        getPublicUrl(path) {
          return { data: { publicUrl: `https://demo.invalid/photos/${path}` } }
        },
      }
    },
  }

  return {
    from: (table) => createQuery(table),
    auth,
    functions,
    storage,
    rpc: async (fn, args = {}) => {
      if (fn === 'replace_shift_report_children') {
        return replaceShiftReportChildren(args.p_report_id, args.p_payload)
      }
      return { data: null, error: { message: 'Not available in demo', name: 'DemoModeError' } }
    },
    channel() {
      return { on() { return this }, subscribe() { return { unsubscribe() {} } } }
    },
    removeChannel() {},
    _demo: { version: STORE_VERSION, reset: resetDemoStore, getStore: getDemoStore },
  }
}
