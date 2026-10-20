# get-sheet-data — Google Sheet / Apps Script pull

The public anon key must not read plant tables. Sheet sync goes through this
edge function, which uses the service role after checking a shared secret.

Live URL:

```
https://coguzmhpfmjkxmuasuoj.supabase.co/functions/v1/get-sheet-data
```

## Daily Report Import (Apps Script) — REST proxy

This is the path the live Sheet uses. It does **not** call CSV `section=`.
`needsSync` and `supabaseFetch` used to hit `/rest/v1/<table>` with the anon key.
Point them at this function instead.

```javascript
function supabaseFetch(table, qs, extraHeaders) {
  const props = PropertiesService.getScriptProperties()
  const url =
    'https://coguzmhpfmjkxmuasuoj.supabase.co/functions/v1/get-sheet-data'
    + '?mode=rest&table=' + table
    + '&' + qs
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: Object.assign({
      apikey: props.getProperty('SUPABASE_ANON_KEY'),
      'x-sheet-sync-secret': props.getProperty('SHEET_SYNC_SECRET'),
    }, extraHeaders || {}),
    muteHttpExceptions: true,
  })
  return res
}

function needsSync(table, qs) {
  const res = supabaseFetch(table, qs, {
    Prefer: 'count=exact',
    Range: '0-0',
  })
  // Content-Range still comes back, e.g. 0-0/1234
  const range = res.getHeaders()['Content-Range'] || res.getHeaders()['content-range']
  // ...
}
```

Rules:

- `apikey` is still the **anon** key (gateway). Do **not** send `Authorization: Bearer <anon>`.
- Secret is only `x-sheet-sync-secret` from `PropertiesService.getScriptProperties().getProperty('SHEET_SYNC_SECRET')`.
- Allowed `table` values: `raw_material_purchases`, `vehicle_dispatches`, `shift_reports`, `suppliers`, `transporters`. Embeds in `select=` (`customers(name)`, `dispatch_pellets(...)`, `pellet_stock(...,pellet_types(name))`, `transporters!transporter_id(name)`, `transporter_vehicles(...)`) are forwarded as-is.
- GET only. `Prefer: count=exact` and `Range` are passed through; `Content-Range` is returned so `needsSync()` can read the total.

**`syncAllForce()` / `deleteAllProperties()`:** do not wipe every script property. That would delete `SHEET_SYNC_SECRET` (and the anon key if stored there). Delete only the `cnt_*` keys.

```javascript
function deleteCountProperties() {
  const props = PropertiesService.getScriptProperties()
  const all = props.getProperties()
  const toDelete = Object.keys(all).filter(function (k) { return k.indexOf('cnt_') === 0 })
  if (toDelete.length) props.deleteProperties(toDelete)
}
```

## CSV mode (unchanged)

| Param | Example | Meaning |
|---|---|---|
| `plant` | `Prayagraj` | Plant name. Omit only with the secret (all plants). |
| `date` | `2026-10-20` | Filter day for daily sections / running stock. |
| `format` | `csv` or `json` | Default `json`. |
| `section` | `kpis` `production` `raw_material` `dispatch` `raw_stock` `pellet_stock` | Required when `format=csv`. |

## Secrets and deploy

1. Supabase → Edge Functions → Secrets → `SHEET_SYNC_SECRET` (long random). Same value in Apps Script **Project Settings → Script properties**.
2. Deploy `get-sheet-data` with **`verify_jwt = false`** (see `config.toml`).
3. Order: set secret → deploy this function → update Apps Script (`mode=rest`) → then apply `20261020_drop_anon_read_policies.sql` if it is not already applied.

## Undo

Redeploy the previous `get-sheet-data` without `mode=rest`. Recreating `sheet_sync_read` re-opens tables to the anon key — last resort only.
