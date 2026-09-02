/**
 * Kanoz Daily Report — Google Sheets Sync
 * Fetches live data from Supabase and writes to sheets on open / manual refresh.
 *
 * ── HOW TO INSTALL ────────────────────────────────────────────────────────────
 *  1. Open your Google Sheet → Extensions → Apps Script
 *  2. Delete all existing code and paste this entire file
 *  3. Save (Ctrl+S)
 *  4. Run "setupTriggers" once from the Run menu (it will ask for permissions — allow)
 *  5. Close Apps Script. Reload your Google Sheet — data syncs automatically on open.
 *
 * ── SHEETS WRITTEN ────────────────────────────────────────────────────────────
 *   Purchases     · Dispatches     · Shift Reports
 *   Suppliers     · Transporters
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
var SUPABASE_URL = 'https://coguzmhpfmjkxmuasuoj.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ3V6bWhwZm1qa3htdWFzdW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNTU0MzYsImV4cCI6MjA4NzgzMTQzNn0.3udEtLfgOEWaRmPRWTywpSwEAc0lLkCdj86Eg_ZBhwo';
var PLANT_ID    = 'b0000000-0000-0000-0000-000000000001';
var ORG_ID      = 'a0000000-0000-0000-0000-000000000001';
var DAYS_BACK   = 90;   // how many days of history to pull for purchases & dispatches
// ─────────────────────────────────────────────────────────────────────────────


// ── TRIGGERS ─────────────────────────────────────────────────────────────────

/** Run this ONCE manually to install the installable onOpen trigger */
function setupTriggers() {
  // Wipe existing project triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onSheetOpen')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onOpen()
    .create();
  SpreadsheetApp.getUi().alert('✅ Trigger installed! Data will sync automatically whenever you open this sheet.');
}

/** Installable trigger target */
function onSheetOpen() { syncAll(); }

/** Simple onOpen — adds the menu and syncs (runs without authorization for read-only menus) */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🌿 Kanoz Sync')
    .addItem('🔄 Refresh All Data', 'syncAll')
    .addSeparator()
    .addItem('📦 Purchases',    'syncPurchases')
    .addItem('🚛 Dispatches',   'syncDispatches')
    .addItem('📊 Shift Reports','syncShiftReports')
    .addItem('🏭 Suppliers',    'syncSuppliers')
    .addItem('🚜 Transporters', 'syncTransporters')
    .addSeparator()
    .addItem('⚙️  Setup Auto-Sync Trigger', 'setupTriggers')
    .addToUi();
  // Attempt sync — may fail if script hasn't been authorized yet (first open)
  try { syncAll(); } catch(e) { /* silently skip; user can run from menu */ }
}


// ── MAIN SYNC ────────────────────────────────────────────────────────────────

function syncAll() {
  var ss = SpreadsheetApp.getActive();
  var toast = function(msg) { ss.toast(msg, '🌿 Kanoz', 4); };

  toast('Syncing purchases…');    syncPurchases();
  toast('Syncing dispatches…');   syncDispatches();
  toast('Syncing shift reports…');syncShiftReports();
  toast('Syncing suppliers…');    syncSuppliers();
  toast('Syncing transporters…'); syncTransporters();
  toast('✅ All synced — ' + fmtNow());
}


// ── HELPERS ──────────────────────────────────────────────────────────────────

function supabaseFetch(table, queryString) {
  var url = SUPABASE_URL + '/rest/v1/' + table + '?' + queryString;
  var opts = {
    method: 'get',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Accept':        'application/json'
    },
    muteHttpExceptions: true
  };
  var resp = UrlFetchApp.fetch(url, opts);
  var code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error('Supabase ' + code + ' on ' + table + ': ' + resp.getContentText().slice(0, 300));
  }
  return JSON.parse(resp.getContentText());
}

function sheet(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

/** Date string for the cutoff (DAYS_BACK days ago), in IST */
function cutoffDate() {
  var d = new Date();
  d.setDate(d.getDate() - DAYS_BACK);
  return Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd');
}

function fmtNow() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy HH:mm') + ' IST';
}

function n(v) { return parseFloat(v) || 0; }  // safe number

/**
 * Write a full sheet: timestamp row, header row (dark green), data rows.
 * Row 1 = timestamp banner (merged across all columns)
 * Row 2 = header  (frozen)
 * Row 3+ = data
 */
function writeSheet(sh, headers, rows) {
  sh.clearContents();
  sh.clearFormats();

  var ncols = headers.length;

  // ── Row 1: timestamp banner ──────────────────────────────────────────────
  var tsCell = sh.getRange(1, 1, 1, ncols);
  tsCell.merge();
  tsCell.setValue('Last synced: ' + fmtNow() + '   |   ' + rows.length + ' records');
  tsCell.setBackground('#f5f0e8');
  tsCell.setFontColor('#595c4a');
  tsCell.setFontStyle('italic');
  tsCell.setFontSize(9);
  tsCell.setHorizontalAlignment('left');

  // ── Row 2: header ────────────────────────────────────────────────────────
  var hdrRange = sh.getRange(2, 1, 1, ncols);
  hdrRange.setValues([headers]);
  hdrRange.setBackground('#1b4332');
  hdrRange.setFontColor('#ffffff');
  hdrRange.setFontWeight('bold');
  hdrRange.setFontSize(10);

  // ── Rows 3+: data ────────────────────────────────────────────────────────
  if (rows.length > 0) {
    sh.getRange(3, 1, rows.length, ncols).setValues(rows);
  }

  sh.setFrozenRows(2);
  sh.autoResizeColumns(1, ncols);
}


// ── PURCHASES ────────────────────────────────────────────────────────────────

function syncPurchases() {
  var ss = SpreadsheetApp.getActive();
  var sh = sheet(ss, 'Purchases');

  var qs = [
    'select=date,purchase_time,serial_no,quantity_kg,rate_per_kg',
    ',total_rm_amount,total_amount,payment_status,vehicle_number,remarks',
    ',suppliers(name),raw_material_types(name)',
    '&plant_id=eq.' + PLANT_ID,
    '&is_deleted=eq.false',
    '&date=gte.' + cutoffDate(),
    '&order=date.desc,purchase_time.desc',
    '&limit=2000'
  ].join('');

  var data = supabaseFetch('raw_material_purchases', qs);

  var headers = ['Date','Time','Parchi No','Supplier','Raw Material','Vehicle No',
                 'Qty (kg)','Rate ₹/kg','RM Amount ₹','Total ₹','Payment','Remarks'];
  var rows = data.map(function(r) {
    return [
      r.date || '',
      (r.purchase_time || '').slice(0,5),
      r.serial_no || '',
      (r.suppliers && r.suppliers.name) || '',
      (r.raw_material_types && r.raw_material_types.name) || '',
      r.vehicle_number || '',
      n(r.quantity_kg),
      n(r.rate_per_kg),
      n(r.total_rm_amount),
      n(r.total_amount),
      r.payment_status || '',
      r.remarks || ''
    ];
  });

  writeSheet(sh, headers, rows);

  // Highlight unpaid rows
  rows.forEach(function(row, i) {
    if (row[10] === 'Pending') {
      sh.getRange(i + 3, 1, 1, headers.length).setBackground('#fff9c4');
    }
  });
}


// ── DISPATCHES ───────────────────────────────────────────────────────────────

function syncDispatches() {
  var ss = SpreadsheetApp.getActive();
  var sh = sheet(ss, 'Dispatches');

  var qs = [
    'select=date,dispatch_time,invoice_number,truck_number,transport_charges,total_amount,remarks',
    ',customers(name)',
    ',dispatch_pellets(pellet_type_name,quantity_mt)',
    '&plant_id=eq.' + PLANT_ID,
    '&is_deleted=eq.false',
    '&date=gte.' + cutoffDate(),
    '&order=date.desc,dispatch_time.desc',
    '&limit=2000'
  ].join('');

  var data = supabaseFetch('vehicle_dispatches', qs);

  var headers = ['Date','Time','Invoice No','Truck No','Customer','Pellet Type','Qty (MT)','Transport ₹','Total ₹','Remarks'];
  var rows = [];

  data.forEach(function(r) {
    var pellets = r.dispatch_pellets || [];
    if (pellets.length === 0) {
      rows.push([r.date||'', (r.dispatch_time||'').slice(0,5), r.invoice_number||'', r.truck_number||'',
                 (r.customers&&r.customers.name)||'', '', 0, n(r.transport_charges), n(r.total_amount), r.remarks||'']);
    } else {
      pellets.forEach(function(p) {
        rows.push([r.date||'', (r.dispatch_time||'').slice(0,5), r.invoice_number||'', r.truck_number||'',
                   (r.customers&&r.customers.name)||'', p.pellet_type_name||'', n(p.quantity_mt),
                   n(r.transport_charges), n(r.total_amount), r.remarks||'']);
      });
    }
  });

  writeSheet(sh, headers, rows);
}


// ── SHIFT REPORTS ────────────────────────────────────────────────────────────

function syncShiftReports() {
  var ss = SpreadsheetApp.getActive();
  var sh = sheet(ss, 'Shift Reports');

  var qs = [
    'select=date,shift,start_time,end_time,pellet_production_mt,remarks',
    '&plant_id=eq.' + PLANT_ID,
    '&is_deleted=eq.false',
    '&order=date.desc,shift.desc',
    '&limit=500'
  ].join('');

  var data = supabaseFetch('shift_reports', qs);

  var headers = ['Date','Shift','Start','End','Production (MT)','Remarks'];
  var rows = data.map(function(r) {
    return [
      r.date||'',
      r.shift||'',
      (r.start_time||'').slice(0,5),
      (r.end_time||'').slice(0,5),
      n(r.pellet_production_mt),
      r.remarks||''
    ];
  });

  writeSheet(sh, headers, rows);
}


// ── SUPPLIERS ────────────────────────────────────────────────────────────────

function syncSuppliers() {
  var ss = SpreadsheetApp.getActive();
  var sh = sheet(ss, 'Suppliers');

  var qs = [
    'select=name,mobile,address,raw_material_type',
    '&plant_id=eq.' + PLANT_ID,
    '&is_active=eq.true',
    '&order=name'
  ].join('');

  var data = supabaseFetch('suppliers', qs);

  var headers = ['Name','Mobile','Raw Material','Address'];
  var rows = data.map(function(r) {
    return [
      r.name||'',
      (r.mobile||'').replace('+91','').trim(),
      r.raw_material_type||'',
      r.address||''
    ];
  });

  writeSheet(sh, headers, rows);
}


// ── TRANSPORTERS ─────────────────────────────────────────────────────────────

function syncTransporters() {
  var ss = SpreadsheetApp.getActive();
  var sh = sheet(ss, 'Transporters');

  var qs = [
    'select=name,phone,address',
    ',transporter_vehicles(vehicle_number,vehicle_type,driver_name,driver_phone,is_active)',
    '&org_id=eq.' + ORG_ID,
    '&is_active=eq.true',
    '&order=name'
  ].join('');

  var data = supabaseFetch('transporters', qs);

  var headers = ['Owner Name','Owner Phone','Vehicle No','Vehicle Type','Driver Name','Driver Phone','Address'];
  var rows = [];

  data.forEach(function(t) {
    var vehicles = (t.transporter_vehicles || []).filter(function(v) { return v.is_active; });
    if (vehicles.length === 0) {
      rows.push([t.name||'', (t.phone||'').replace('+91','').trim(), '','','','', t.address||'']);
    } else {
      vehicles.forEach(function(v) {
        rows.push([
          t.name||'',
          (t.phone||'').replace('+91','').trim(),
          v.vehicle_number||'',
          v.vehicle_type||'',
          v.driver_name||'',
          (v.driver_phone||'').replace('+91','').trim(),
          t.address||''
        ]);
      });
    }
  });

  writeSheet(sh, headers, rows);
}
