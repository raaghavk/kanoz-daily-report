import { memo } from 'react';

const C = {
  green: '#2d6a4f',
  text: '#2c2c2c',
  muted: '#595c4a',
  dim: '#8a8d7a',
  bg: '#fefae0',
  border: '#e5ddd0',
  card: '#fff',
}

function Step5RawMaterialReview({ data, updateData }) {
  const rawMaterials = data.rawMaterials || [];
  const mixes = data.mixes || [];

  const updateUsed = (idx, value) => {
    const updated = [...rawMaterials];
    const numValue = parseFloat(value) || 0;
    const rm = updated[idx];
    const opening = parseFloat(rm.opening_kg) || 0;
    const purchased = parseFloat(rm.purchased_kg) || 0;
    updated[idx] = {
      ...rm,
      used_override_kg: numValue,
      closing_kg: opening + purchased - numValue,
    };
    updateData('rawMaterials', updated);
  };

  const getMixStats = (mix) => {
    const production = data.production || [];
    let totalUsed = 0;
    production.forEach((p) => {
      if (p.mix_usages && Array.isArray(p.mix_usages)) {
        p.mix_usages.forEach((mu) => {
          if (mu.mix_local_id === mix.local_id) {
            totalUsed += parseFloat(mu.quantity_kg) || 0;
          }
        });
      }
    });
    const opening = parseFloat(mix.opening_kg) || 0;
    const prepared = parseFloat(mix.prepared_kg) || 0;
    return { used: totalUsed, closing: opening + prepared - totalUsed };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>

      {/* RAW MATERIAL STOCK TABLE */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Raw Material Stock
        </div>
        <div style={{ background: C.card, borderRadius: 14, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', background: C.green, padding: '9px 12px' }}>
            {['Material', 'Open', 'Purch', 'Used', 'Close'].map((h, i) => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#fff', textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>

          {rawMaterials.length === 0 ? (
            <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: '#b5b8a8' }}>
              No raw materials configured
            </div>
          ) : (
            rawMaterials.map((rm, idx) => {
              const opening = parseFloat(rm.opening_kg) || 0;
              const purchased = parseFloat(rm.purchased_kg) || 0;
              const used = parseFloat(rm.used_override_kg ?? rm.used_kg) || 0;
              const closing = opening + purchased - used;

              return (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr repeat(4, 1fr)',
                    padding: '8px 12px',
                    borderTop: idx > 0 ? `1px solid ${C.border}` : 'none',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{rm.name || `Material ${idx + 1}`}</span>
                  <span style={{ fontSize: 12, color: C.muted, textAlign: 'right' }}>{opening.toFixed(0)}</span>
                  <span style={{ fontSize: 12, color: C.muted, textAlign: 'right' }}>{purchased.toFixed(0)}</span>
                  {/* Editable Used */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <input
                      type="number"
                      value={used}
                      onChange={(e) => updateUsed(idx, e.target.value)}
                      step="0.01"
                      style={{
                        width: 60,
                        padding: '4px 6px',
                        borderRadius: 7,
                        border: `1.5px solid ${C.border}`,
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.text,
                        textAlign: 'right',
                        background: '#fefae0',
                        outline: 'none',
                        fontFamily: 'Inter, sans-serif',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.green, textAlign: 'right' }}>{closing.toFixed(0)}</span>
                </div>
              );
            })
          )}
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 5 }}>Used is auto-calculated from mix ingredients. Tap to override.</div>
      </div>

      {/* MIX STOCK TABLE */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Mix Stock
        </div>

        {mixes.length === 0 ? (
          <div style={{ background: C.card, borderRadius: 14, border: `2px dashed ${C.border}`, padding: '20px 16px', textAlign: 'center', fontSize: 12, color: '#b5b8a8' }}>
            No mixes were created in Step 3
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mixes.map((mix, idx) => {
              const stats = getMixStats(mix);
              const opening = parseFloat(mix.opening_kg) || 0;
              const prepared = parseFloat(mix.prepared_kg) || 0;

              return (
                <div key={idx} style={{ background: C.card, borderRadius: 14, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
                  {/* Green header */}
                  <div style={{ background: C.green, padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{mix.name || `Mix ${idx + 1}`}</span>
                    {mix.type && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)', padding: '3px 8px', borderRadius: 6 }}>
                        {mix.type}
                      </span>
                    )}
                  </div>

                  {/* Compact 4-cell stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    {[
                      { label: 'Opening', value: opening, color: C.muted },
                      { label: 'Prepared', value: prepared, color: C.text },
                      { label: 'Used', value: stats.used, color: C.text },
                      { label: 'Closing', value: stats.closing, color: C.green },
                    ].map((cell, i) => (
                      <div key={cell.label} style={{ padding: '9px 8px', borderLeft: i > 0 ? `1px solid ${C.border}` : 'none', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{cell.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: cell.color }}>{cell.value.toFixed(0)} kg</div>
                      </div>
                    ))}
                  </div>

                  {/* Ingredients summary */}
                  {mix.ingredients?.length > 0 && (
                    <div style={{ padding: '7px 14px', borderTop: `1px solid ${C.border}`, background: '#faf9f4' }}>
                      <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.6 }}>
                        {mix.ingredients.map((ing, i) => (
                          <span key={i}>{i > 0 ? ' · ' : ''}<strong>{ing.name}</strong> {ing.quantity_kg}kg</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(Step5RawMaterialReview);
