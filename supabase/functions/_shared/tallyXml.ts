/** Minimal Tally XML builder for edge functions (mirrors src/lib/tallyXml.js). */

export function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tallyDate(iso: unknown): string {
  const d = String(iso || '').slice(0, 10).replace(/-/g, '')
  return d.length === 8 ? d : ''
}

export type TallyVoucherRow = {
  voucher_type?: string
  voucher_date?: string
  party_ledger?: string
  account_ledger?: string
  amount?: number | string
  narration?: string
  status?: string
}

export function voucherToTallyXml(v: TallyVoucherRow, _companyName?: string): string {
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
            <PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>
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

export function buildTallyEnvelope(vouchers: TallyVoucherRow[], companyName?: string): string {
  const included = (vouchers || []).filter((v) => v.status !== 'skipped')
  const body = included.map((v) => voucherToTallyXml(v, companyName)).join('\n')
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
