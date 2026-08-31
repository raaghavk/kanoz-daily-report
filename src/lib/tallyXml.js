export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tallyDate(iso) {
  const d = String(iso || '').slice(0, 10).replace(/-/g, '')
  return d.length === 8 ? d : ''
}

export function voucherToTallyXml(v, companyName) {
  const date = tallyDate(v.voucher_date)
  const type = v.voucher_type || 'Journal'
  const party = escapeXml(v.party_ledger || 'Unknown')
  const account = escapeXml(v.account_ledger || 'Suspense')
  const amount = Number(v.amount) || 0
  const narration = escapeXml(v.narration || '')
  const isDebitParty = type === 'Payment' || type === 'Journal'
  return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${escapeXml(type)}" ACTION="Create">
            <DATE>${date}</DATE>
            <VOUCHERTYPENAME>${escapeXml(type)}</VOUCHERTYPENAME>
            <NARRATION>${narration}</NARRATION>
            ${companyName ? `<PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>` : `<PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>`}
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${isDebitParty ? party : account}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${isDebitParty ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
              <AMOUNT>${isDebitParty ? -amount : amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${isDebitParty ? account : party}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${isDebitParty ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
              <AMOUNT>${isDebitParty ? amount : -amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`
}

export function buildTallyEnvelope(vouchers, companyName) {
  const included = (vouchers || []).filter(v => v.status !== 'skipped')
  const body = included.map(v => voucherToTallyXml(v, companyName)).join('\n')
  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName || '')}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${body}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
`
}

export function mapPurchaseToVoucher(p, settings, ledgerName) {
  const amount = Number(p.total_amount) || 0
  const freight = Number(p.transport_expense) || 0
  const rmAmount = amount - freight
  return {
    voucher_type: 'Purchase',
    voucher_date: p.date,
    source_table: 'raw_material_purchases',
    source_id: p.id,
    party_ledger: ledgerName || p.supplier_name || p.suppliers?.name || settings.sundry_creditors_ledger || 'Sundry Creditors',
    account_ledger: settings.purchase_ledger || 'Purchase Accounts',
    amount: rmAmount > 0 ? rmAmount : amount,
    narration: `RM purchase ${p.raw_material_type || p.raw_material_types?.name || ''} ${p.quantity_kg || 0} kg · ${p.vehicle_number || ''} · ${p.serial_no || ''}`.trim(),
    status: 'pending',
  }
}

export function mapDispatchToVoucher(d, settings, ledgerName, qtyMt) {
  const amount = Number(d.invoice_amount) || Number(d.total_amount) || 0
  return {
    voucher_type: 'Sales',
    voucher_date: d.dispatch_date || d.date,
    source_table: 'vehicle_dispatches',
    source_id: d.id,
    party_ledger: ledgerName || d.customers?.name || d.customer_name || settings.sundry_debtors_ledger || 'Sundry Debtors',
    account_ledger: settings.sales_ledger || 'Sales Accounts',
    amount,
    narration: `Dispatch ${d.truck_number || ''} · ${qtyMt || 0} MT · inv ${d.invoice_no || ''}`.trim(),
    status: amount > 0 ? 'pending' : 'skipped',
  }
}

export function mapCostToVoucher(row, settings) {
  return {
    voucher_type: 'Payment',
    voucher_date: String(row.cost_date || row.created_at || '').slice(0, 10),
    source_table: 'finance_costs',
    source_id: row.id,
    party_ledger: row.category || 'Expense',
    account_ledger: settings.bank_ledger || 'Bank',
    amount: Number(row.amount) || 0,
    narration: row.description || row.category,
    status: 'pending',
  }
}

export function mapPaymentToVoucher(p, settings, kind) {
  const amount = kind === 'transport' ? Number(p.transport_expense) : Number(p.total_rm_amount || p.total_amount)
  if (!amount) return null
  const paid = kind === 'transport' ? p.transport_payment_status === 'Paid' : (p.rm_payment_status === 'Paid' || p.payment_status === 'Paid')
  if (!paid) return null
  return {
    voucher_type: 'Payment',
    voucher_date: String((kind === 'transport' ? p.transport_paid_at : p.rm_paid_at) || p.date).slice(0, 10),
    source_table: 'raw_material_purchases',
    source_id: p.id,
    party_ledger: p.supplier_name || p.suppliers?.name || settings.sundry_creditors_ledger || 'Sundry Creditors',
    account_ledger: settings.bank_ledger || 'Bank',
    amount,
    narration: `${kind === 'transport' ? 'Freight' : 'RM'} payment · ${p.serial_no || p.vehicle_number || ''}`.trim(),
    status: 'pending',
  }
}
