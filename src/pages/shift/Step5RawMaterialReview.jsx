import { memo } from 'react';

function Step5RawMaterialReview({ data, updateData }) {
  const updateRM = (idx, field, value) => {
    const updated = [...(data.rawMaterials || [])];
    const numValue = parseFloat(value) || 0;

    if (field === 'used') {
      const rm = updated[idx];
      const opening = parseFloat(rm.opening_kg) || 0;
      const purchased = parseFloat(rm.purchased_kg) || 0;
      const closing = opening + purchased - numValue;

      updated[idx] = {
        ...rm,
        used_override_kg: numValue,
        closing_kg: closing,
      };
    } else {
      updated[idx] = { ...updated[idx], [field]: numValue };
    }

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
    const closing = opening + prepared - totalUsed;

    return { used: totalUsed, closing };
  };

  const rawMaterials = data.rawMaterials || [];
  const mixes = data.mixes || [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        paddingBottom: '80px',
      }}
    >
      {/* RAW MATERIAL STOCK SECTION */}
      <div>
        <div style={{ marginBottom: '8px' }}>
          <p
            style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.5px',
              color: '#595c4a',
              textTransform: 'uppercase',
              margin: '0 0 8px 0',
            }}
          >
            Raw Material Stock
          </p>
          <p
            style={{
              fontSize: '13px',
              color: '#595c4a',
              margin: 0,
              lineHeight: '1.4',
            }}
          >
            Used is calculated from mix ingredients. You can override if needed.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {rawMaterials.length === 0 ? (
            <p
              style={{
                fontSize: '13px',
                color: '#595c4a',
                textAlign: 'center',
                padding: '20px',
                backgroundColor: '#fafaf8',
                borderRadius: '12px',
              }}
            >
              No raw materials added yet.
            </p>
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
                    backgroundColor: '#fff',
                    border: '1px solid #e5ddd0',
                    borderRadius: '14px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Material name header */}
                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#f8f8f6',
                      borderBottom: '1px solid #e5ddd0',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#2c2c2c',
                      }}
                    >
                      {rm.name || `Material ${idx + 1}`}
                    </p>
                  </div>

                  {/* 4-column grid: Opening | Purchased | Used | Closing */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(70px, 1fr))',
                      gap: '1px',
                      backgroundColor: '#e5ddd0',
                      padding: '1px',
                    }}
                  >
                    {/* Opening */}
                    <div style={{ backgroundColor: '#fff', padding: '12px' }}>
                      <p
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          color: '#595c4a',
                          textTransform: 'uppercase',
                          margin: '0 0 6px 0',
                          letterSpacing: '0.3px',
                        }}
                      >
                        Opening
                      </p>
                      <div
                        style={{
                          backgroundColor: '#fafaf8',
                          padding: '8px',
                          borderRadius: '8px',
                          minHeight: '32px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: '13px',
                            color: '#2c2c2c',
                            fontWeight: '500',
                          }}
                        >
                          {opening.toFixed(2)} kg
                        </p>
                      </div>
                    </div>

                    {/* Purchased */}
                    <div style={{ backgroundColor: '#fff', padding: '12px' }}>
                      <p
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          color: '#595c4a',
                          textTransform: 'uppercase',
                          margin: '0 0 6px 0',
                          letterSpacing: '0.3px',
                        }}
                      >
                        Purchased
                      </p>
                      <div
                        style={{
                          backgroundColor: '#fafaf8',
                          padding: '8px',
                          borderRadius: '8px',
                          minHeight: '32px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: '13px',
                            color: '#2c2c2c',
                            fontWeight: '500',
                          }}
                        >
                          {purchased.toFixed(2)} kg
                        </p>
                      </div>
                    </div>

                    {/* Used (editable) */}
                    <div style={{ backgroundColor: '#fff', padding: '12px' }}>
                      <p
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          color: '#595c4a',
                          textTransform: 'uppercase',
                          margin: '0 0 6px 0',
                          letterSpacing: '0.3px',
                        }}
                      >
                        Used
                      </p>
                      <input
                        type="number"
                        value={used.toFixed(2)}
                        onChange={(e) => updateRM(idx, 'used', e.target.value)}
                        step="0.01"
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px solid #e5ddd0',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#2c2c2c',
                          boxSizing: 'border-box',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      />
                    </div>

                    {/* Closing */}
                    <div style={{ backgroundColor: '#fff', padding: '12px' }}>
                      <p
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          color: '#2d6a4f',
                          textTransform: 'uppercase',
                          margin: '0 0 6px 0',
                          letterSpacing: '0.3px',
                        }}
                      >
                        Closing
                      </p>
                      <div
                        style={{
                          backgroundColor: '#f0f7f4',
                          padding: '8px',
                          borderRadius: '8px',
                          minHeight: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          border: '1px solid #2d6a4f',
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: '13px',
                            color: '#2d6a4f',
                            fontWeight: '600',
                          }}
                        >
                          {closing.toFixed(2)} kg
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MIX STOCK SECTION */}
      <div>
        <div style={{ marginBottom: '8px' }}>
          <p
            style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.5px',
              color: '#595c4a',
              textTransform: 'uppercase',
              margin: '0 0 8px 0',
            }}
          >
            Mix Stock
          </p>
          <p
            style={{
              fontSize: '13px',
              color: '#595c4a',
              margin: 0,
              lineHeight: '1.4',
            }}
          >
            Used is calculated from production entries.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mixes.length === 0 ? (
            <p
              style={{
                fontSize: '13px',
                color: '#595c4a',
                textAlign: 'center',
                padding: '20px',
                backgroundColor: '#fafaf8',
                borderRadius: '12px',
              }}
            >
              No mixes were created in Step 3.
            </p>
          ) : (
            mixes.map((mix, idx) => {
              const stats = getMixStats(mix);
              const opening = parseFloat(mix.opening_kg) || 0;
              const prepared = parseFloat(mix.prepared_kg) || 0;

              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5ddd0',
                    borderRadius: '14px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Mix name + type chip header */}
                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#2d6a4f',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#fff',
                      }}
                    >
                      {mix.name || `Mix ${idx + 1}`}
                    </p>
                    {mix.type && (
                      <span
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          textTransform: 'capitalize',
                        }}
                      >
                        {mix.type}
                      </span>
                    )}
                  </div>

                  {/* 4-column stats row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(70px, 1fr))',
                      gap: '1px',
                      backgroundColor: '#e5ddd0',
                      padding: '1px',
                    }}
                  >
                    {/* Opening */}
                    <div style={{ backgroundColor: '#fff', padding: '12px' }}>
                      <p
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          color: '#595c4a',
                          textTransform: 'uppercase',
                          margin: '0 0 6px 0',
                          letterSpacing: '0.3px',
                        }}
                      >
                        Opening
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          color: '#2c2c2c',
                          fontWeight: '500',
                        }}
                      >
                        {opening.toFixed(2)} kg
                      </p>
                    </div>

                    {/* Prepared */}
                    <div style={{ backgroundColor: '#fff', padding: '12px' }}>
                      <p
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          color: '#595c4a',
                          textTransform: 'uppercase',
                          margin: '0 0 6px 0',
                          letterSpacing: '0.3px',
                        }}
                      >
                        Prepared
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          color: '#2c2c2c',
                          fontWeight: '500',
                        }}
                      >
                        {prepared.toFixed(2)} kg
                      </p>
                    </div>

                    {/* Used */}
                    <div style={{ backgroundColor: '#fff', padding: '12px' }}>
                      <p
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          color: '#595c4a',
                          textTransform: 'uppercase',
                          margin: '0 0 6px 0',
                          letterSpacing: '0.3px',
                        }}
                      >
                        Used
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          color: '#2c2c2c',
                          fontWeight: '500',
                        }}
                      >
                        {stats.used.toFixed(2)} kg
                      </p>
                    </div>

                    {/* Closing */}
                    <div style={{ backgroundColor: '#fff', padding: '12px' }}>
                      <p
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          color: '#2d6a4f',
                          textTransform: 'uppercase',
                          margin: '0 0 6px 0',
                          letterSpacing: '0.3px',
                        }}
                      >
                        Closing
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          color: '#2d6a4f',
                          fontWeight: '600',
                        }}
                      >
                        {stats.closing.toFixed(2)} kg
                      </p>
                    </div>
                  </div>

                  {/* Ingredients list */}
                  {mix.ingredients && mix.ingredients.length > 0 && (
                    <div
                      style={{
                        padding: '12px 16px',
                        backgroundColor: '#fafaf8',
                        borderTop: '1px solid #e5ddd0',
                      }}
                    >
                      <p
                        style={{
                          fontSize: '11px',
                          color: '#595c4a',
                          margin: '0 0 6px 0',
                          fontWeight: '500',
                        }}
                      >
                        Ingredients:
                      </p>
                      <p
                        style={{
                          fontSize: '12px',
                          color: '#595c4a',
                          margin: 0,
                          lineHeight: '1.4',
                        }}
                      >
                        {mix.ingredients
                          .map(
                            (ing) =>
                              `${ing.name} (${parseFloat(ing.quantity_kg || 0).toFixed(2)} kg)`
                          )
                          .join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(Step5RawMaterialReview);
