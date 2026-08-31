import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, jsonResponse, requireCaller } from '../_shared/callerAuth.ts'

// extract-receipt — OCR via Gemini. Requires JWT and only fetches images from our Storage bucket.

type DocumentType = 'katta_parchi' | 'diesel_receipt';

const CORS = corsHeaders;

function json(body: unknown, status = 200): Response {
  return jsonResponse(body, status);
}

function isAllowedImageUrl(imageUrl: string): boolean {
  let parsed: URL
  try { parsed = new URL(imageUrl) } catch { return false }
  if (parsed.protocol !== 'https:') return false
  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return false
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/.test(host)) return false
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  let allowedHost = ''
  try { allowedHost = new URL(supabaseUrl).hostname.toLowerCase() } catch { /* ignore */ }
  if (allowedHost && host === allowedHost) return true
  if (host.endsWith('.supabase.co') && parsed.pathname.includes('/storage/v1/object/')) return true
  return false
}

function getPromptForType(type: DocumentType): string {
  if (type === 'katta_parchi') {
    return `You are an OCR expert analyzing Indian weighbridge slips (kanta parchi / dharam kanta slip). Text is a Hindi/English mix, often printed by dot-matrix printers, sometimes handwritten, sometimes photographed at an angle.

Extract these fields from the image:
- vehicle_number: truck/tractor registration number (e.g. UP70MT6151). Remove spaces/dashes, uppercase.
- gross_weight: "Gross Wt" / "Loaded" / "पहली तौल" in KILOGRAMS (convert if in quintals: 1 quintal = 100 kg)
- tare_weight: "Tare Wt" / "Empty" / "दूसरी तौल" in KILOGRAMS
- net_weight: "Net Wt" / "नेट" in KILOGRAMS. If not printed, compute gross_weight - tare_weight.
- material_name: material being weighed (e.g. sarson bhusa, mustard husk, corn cob, paddy straw)
- party_name: customer/party/supplier name if printed
- date: date on the slip in YYYY-MM-DD format. CRITICAL: Indian weight bridge slips commonly use DD.MM.YY format (e.g., "15.05.26" means 15 May 2026, NOT 26 May 2015). The 2-digit year 26 = 2026, 25 = 2025, 24 = 2024. NEVER interpret the 2-digit year as a day. If you see "15.05.26 14:22", the date is 2026-05-15 and time is 14:22. Always return date as YYYY-MM-DD.
- time: time in 24h HH:MM format
- serial_no: the printed receipt/slip serial number (often labeled as Sr.No, Serial No, S.No, Parchi No, Slip No, Receipt No). Return as a string. Use null if not found.

Return ONLY valid JSON with exactly these keys. Use null for anything not readable. Numbers must be plain numbers, not strings.`;
  }
  return `You are an OCR expert analyzing Indian fuel-pump diesel receipts. Text is a Hindi/English mix.

Extract these fields from the image:
- litres: diesel volume in litres
- cost_per_litre: price per litre in rupees
- total_cost: total amount paid in rupees. If missing, compute litres * cost_per_litre.
- date: date in YYYY-MM-DD format
- time: time in 24h HH:MM format

Return ONLY valid JSON with exactly these keys. Use null for anything not readable. Numbers must be plain numbers, not strings.`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchImage(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  const mimeType = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.length > 15_000_000) throw new Error('Image too large (max ~15 MB)');
  return { base64: toBase64(buffer), mimeType };
}

function parseModelJson(text: string): Record<string, unknown> {
  // Model is asked for pure JSON, but strip markdown fences / stray text just in case.
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Model did not return JSON');
    return JSON.parse(match[0]);
  }
}

async function extractWithGemini(
  base64: string,
  mimeType: string,
  type: DocumentType,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: getPromptForType(type) },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429) {
      throw new Error('Gemini free-tier limit reached. Wait a minute and try again.');
    }
    throw new Error(`Gemini API error: ${response.status} - ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('');
  if (!text) throw new Error('Empty response from Gemini');
  return parseModelJson(text);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('OK', { headers: CORS });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  try {
    const caller = await requireCaller(req)
    if (caller instanceof Response) return caller

    const { imageUrl, type } = await req.json() as { imageUrl?: string; type?: DocumentType };

    if (!imageUrl || !type) return json({ success: false, error: 'Missing imageUrl or type' }, 400);
    if (type !== 'katta_parchi' && type !== 'diesel_receipt') {
      return json({ success: false, error: 'Invalid type. Must be katta_parchi or diesel_receipt' }, 400);
    }
    if (!isAllowedImageUrl(imageUrl)) {
      return json({ success: false, error: 'imageUrl must be a HTTPS object in this project\'s Storage' }, 400);
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return json({ success: false, error: 'GEMINI_API_KEY not configured. Add it in Supabase Dashboard → Edge Functions → Secrets.' }, 500);
    }

    const { base64, mimeType } = await fetchImage(imageUrl);
    const extracted = await extractWithGemini(base64, mimeType, type, apiKey);

    return json({ success: true, data: extracted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('extract-receipt error:', message);
    return json({ success: false, error: message }, 500);
  }
});
