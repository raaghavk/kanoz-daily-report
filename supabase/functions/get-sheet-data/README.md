# get-sheet-data — Google Sheet / Apps Script pull

The public anon key must not read `customers` (or any other plant table).
Sheet sync goes through this edge function, which uses the service role after
checking a shared secret.

Live URL (unchanged):

```
https://coguzmhpfmjkxmuasuoj.supabase.co/functions/v1/get-sheet-data
```

CSV contract (unchanged query params):

| Param | Example | Meaning |
|---|---|---|
| `plant` | `Prayagraj` | Plant name. Omit only with the secret (all plants). |
| `date` | `2026-10-20` | Filter day for daily sections / running stock. |
| `format` | `csv` or `json` | Default `json`. |
| `section` | `kpis` `production` `raw_material` `dispatch` `raw_stock` `pellet_stock` | Required when `format=csv`. |

## Exact Apps Script change

1. In Supabase → Edge Functions → Secrets, add `SHEET_SYNC_SECRET` (long random string). Do not put it in the Sheet or in this repo.
2. In the Apps Script project: **Project Settings → Script properties** → add `SHEET_SYNC_SECRET` with the same value.
3. Stop calling `/rest/v1/customers`, `/rest/v1/vehicle_dispatches`, or any other table with the anon key. Those policies are dropped.
4. Keep calling the same function URL. Add the secret header. `apikey` may still be the **anon** key (gateway); it is not enough by itself.

```javascript
function fetchSheetSection(plant, date, section) {
  const props = PropertiesService.getScriptProperties()
  const url =
    'https://coguzmhpfmjkxmuasuoj.supabase.co/functions/v1/get-sheet-data'
    + '?plant=' + encodeURIComponent(plant)
    + '&date=' + encodeURIComponent(date)
    + '&format=csv&section=' + encodeURIComponent(section)
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      apikey: props.getProperty('SUPABASE_ANON_KEY'),
      'x-sheet-sync-secret': props.getProperty('SHEET_SYNC_SECRET'),
    },
    muteHttpExceptions: true,
  })
  if (res.getResponseCode() >= 400) {
    throw new Error('get-sheet-data ' + res.getResponseCode() + ': ' + res.getContentText())
  }
  return res.getContentText()
}
```

Alternative: `Authorization: Bearer <SHEET_SYNC_SECRET>` instead of `x-sheet-sync-secret`. Do **not** send the service role key from Apps Script.

5. Deploy `get-sheet-data` **with `verify_jwt = false`** (see `config.toml`) so the gateway does not demand a user JWT. Auth is enforced inside the function.
6. Order after merge: set `SHEET_SYNC_SECRET` → deploy this function → update Apps Script → **then** apply `20261020_drop_anon_read_policies.sql`. Applying the migration first, without the header, breaks the Sheet.

## Undo

Redeploy the previous `get-sheet-data` version and/or remove the header check. Recreating `sheet_sync_read` is the nuclear undo and re-opens the tables to the anon key — only if the function path cannot be restored.
