import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse, requireCaller } from '../_shared/callerAuth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

interface VoiceContext {
  suppliers?: Array<{ id: string; name: string }>
  customers?: Array<{ id: string; name: string }>
  transporters?: Array<{ id: string; name: string }>
  rawMaterials?: Array<{ id: string; name: string }>
  pelletTypes?: Array<{ id: string; name: string }>
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('OK', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const caller = await requireCaller(req)
    if (caller instanceof Response) return caller

    const { transcript, context } = await req.json() as {
      transcript?: string;
      context?: VoiceContext;
    };

    if (!transcript?.trim()) return json({ error: 'Missing transcript' }, 400);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'GEMINI_API_KEY not configured' }, 500);

    const ctx = context || {};

    const supplierList = (ctx.suppliers || []).map(s => `- ${s.id}: ${s.name}`).join('\n') || 'None';
    const customerList = (ctx.customers || []).map(c => `- ${c.id}: ${c.name}`).join('\n') || 'None';
    const transporterList = (ctx.transporters || []).map(t => `- ${t.id}: ${t.name}`).join('\n') || 'None';
    const materialList = (ctx.rawMaterials || []).map(m => `- ${m.id}: ${m.name}`).join('\n') || 'None';
    const pelletList = (ctx.pelletTypes || []).map(p => `- ${p.id}: ${p.name}`).join('\n') || 'None';

    const prompt = `You are a smart data entry assistant for an Indian biomass pellet manufacturing plant. The user spoke in Hindi, English, or a mix of both. Parse their words into a structured plant entry.

AVAILABLE SUPPLIERS (id: name):
${supplierList}

AVAILABLE CUSTOMERS (id: name):
${customerList}

AVAILABLE TRANSPORTERS (id: name):
${transporterList}

AVAILABLE RAW MATERIALS (id: name):
${materialList}

AVAILABLE PELLET TYPES (id: name):
${pelletList}

USER SAID: "${transcript}"

INSTRUCTIONS:
- Determine the entry type: "purchase" (buying raw material), "dispatch" (sending pellets out), "issue" (plant problem/breakdown), or "unknown"
- Fuzzy-match names to the available lists above. "Ram ji", "Ramesh bhai" etc. should match the closest supplier name
- Vehicle numbers: remove spaces/dashes, uppercase (UP70MT6151, not "U P 70 M T 6151")
- Weights in kg unless user says MT/tonne (then convert to kg for purchase, keep MT for dispatch)
- For rates: ₹X per kg → rate_per_kg
- Return ONLY valid JSON, no explanation

Return this exact JSON structure:
{
  "type": "purchase" | "dispatch" | "issue" | "unknown",
  "confidence": "high" | "medium" | "low",
  "summary": "One line summary in the same language the user used",
  "fields": {
    // purchase fields (include only if detected):
    "supplier_id": "uuid or null",
    "supplier_name": "matched name or null",
    "raw_material_type_id": "uuid or null",
    "raw_material_name": "matched name or null",
    "net_weight": 500,
    "rate_per_kg": 8,
    "vehicle_number": "UP70MT6151",
    "serial_no": "8501",
    "vehicle_type": "other",

    // dispatch fields (include only if detected):
    "customer_id": "uuid or null",
    "customer_name": "matched name or null",
    "pellet_type_id": "uuid or null",
    "pellet_type_name": "matched name or null",
    "quantity_mt": 10.5,
    "truck_number": "UP70MT6151",
    "transporter_id": "uuid or null",
    "transporter_name": "matched name or null",

    // issue fields:
    "description": "free text description of the issue"
  }
}`;

    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini error: ${response.status} - ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

    // Parse the JSON response
    const cleaned = text.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Could not parse Gemini response as JSON');
      parsed = JSON.parse(match[0]);
    }

    return json({ success: true, result: parsed });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('parse-voice-entry error:', message);
    return json({ success: false, error: message }, 500);
  }
});
