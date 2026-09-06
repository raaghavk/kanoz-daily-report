import { computeProcessingDeltas } from '../../lib/processingDeltas'
import { SHIFT_STEP } from '../../lib/shiftWizardSteps'

/**
 * Validate shift report data before submission.
 * Returns array of {step, message} for incomplete required fields.
 */
export function getValidationErrors(reportData) {
  const errors = []
  // Step 1: Header — unique-index date is shift end date
  const reportDate = reportData.shift_end_date || reportData.shift_start_date || reportData.date
  if (!reportDate) errors.push({ step: 1, message: 'Date is required' })
  if (!reportData.shift) errors.push({ step: 1, message: 'Shift is required' })
  if (!reportData.start_time) errors.push({ step: 1, message: 'Start time is required' })
  if (!reportData.end_time) errors.push({ step: 1, message: 'End time is required' })

  // Step 2: Machines — at least one machine should have from/to timing
  const machines = reportData.machines || []
  const hasAnyMachineTiming = machines.some(m => m.from_time && m.to_time)
  const allMachinesIdle = machines.length > 0 && !hasAnyMachineTiming
  const remarksProvided = (reportData.remarks || '').trim().length > 0

  // If all machines are idle, require a reason in remarks (Submit step)
  if (allMachinesIdle && !remarksProvided) {
    errors.push({ step: SHIFT_STEP.SUBMIT, message: 'No machines running — provide a reason in the Remarks field' })
  }

  // Production validation — skip if all machines idle (no-production shift)
  const production = (reportData.production || []).filter(Boolean)
  const mixes = reportData.mixes || []
  const hasProduction = production.length > 0 && production.some(p => parseFloat(p.quantity) > 0)
  if (!hasProduction && !allMachinesIdle) {
    errors.push({ step: SHIFT_STEP.PRODUCTION, message: 'Add at least one production entry' })
  } else if (hasProduction && mixes.length > 0) {
    // Only require mix usage if mixes were defined for this shift
    const hasMixUsageForProducedEntry = production.some(p => {
      const quantity = parseFloat(p.quantity) || 0
      if (quantity <= 0) return false
      return (p.mix_usages || []).some(mu => (parseFloat(mu.quantity_kg) || 0) > 0)
    })
    if (!hasMixUsageForProducedEntry) {
      errors.push({ step: SHIFT_STEP.PRODUCTION, message: 'Add mix usage for at least one production entry' })
    }
  }

  return errors
}


/**
 * Non-blocking warnings: values that are suspicious but physically possible.
 * These are surfaced to the user but do NOT prevent submission.
 * Returns array of {step, message}.
 */
export function getValidationWarnings(reportData) {
  const warnings = []
  const num = v => parseFloat(v) || 0

  // Shift length in hours (used to sanity-check machine run hours)
  let shiftHours = null
  try {
    const sd = reportData.shift_start_date
    const ed = reportData.shift_end_date || reportData.shift_start_date
    if (sd && reportData.start_time && reportData.end_time) {
      const st = new Date(`${sd}T${(reportData.start_time || '').substring(0,5)}:00`)
      const en = new Date(`${ed}T${(reportData.end_time || '').substring(0,5)}:00`)
      const h = (en - st) / 3600000
      if (h > 0 && h < 48) shiftHours = h
    }
  } catch { /* ignore */ }

  // Step 1: power meter end reading should not be below the start reading
  if (num(reportData.end_power_reading) < num(reportData.start_power_reading)) {
    warnings.push({ step: 1, message: 'End power reading is lower than the start reading — please double-check.' })
  }

  // Step 2: machine run hours greater than the shift length
  if (shiftHours != null) {
    for (const m of (reportData.machines || [])) {
      const hrs = num(m.total_hours) || num(m.production_hours)
      if (hrs > shiftHours + 0.5) {
        warnings.push({ step: 2, message: `${m.name || 'A machine'} shows ${hrs}h run time, more than the ${shiftHours.toFixed(1)}h shift.` })
      }
    }
  }

  // Step 3: raw material closing stock went negative (used more than available)
  const procDeltas = computeProcessingDeltas(reportData.processing, reportData.rawMaterials)
  for (const rm of (reportData.rawMaterials || [])) {
    const d = procDeltas[rm.id] || { produced: 0, procUsed: 0 }
    const closing = num(rm.opening) + num(rm.purchased) + num(d.produced) - num(rm.used) - num(d.procUsed)
    if (closing < -0.5) {
      warnings.push({ step: SHIFT_STEP.RAW_MATERIAL, message: `${rm.name || 'A raw material'} closing stock is negative (${(closing/1000).toFixed(2)} MT) — used more than available.` })
    }
  }

  // Diesel used more than opening + added (closing negative)
  for (const eq of (reportData.diesel || [])) {
    const closing = num(eq.opening) + num(eq.added) - num(eq.used)
    if (closing < -0.01) {
      warnings.push({ step: SHIFT_STEP.DIESEL, message: `${eq.equipment_name || 'Equipment'} diesel closing is negative (${closing.toFixed(1)} L) — used more than available.` })
    }
  }

  // Pellet closing stock went negative
  for (const p of (reportData.pelletStock || [])) {
    const closing = num(p.opening) + num(p.production) - num(p.dispatch) - num(p.wastage) + num(p.adjustment)
    if (closing < -0.01) {
      warnings.push({ step: SHIFT_STEP.PELLET, message: `${p.name || 'A pellet'} closing stock is negative (${closing.toFixed(2)} MT) — dispatched/wasted more than available.` })
    }
  }

  return warnings
}
