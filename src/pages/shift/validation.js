/**
 * Validate shift report data before submission.
 * Returns array of {step, message} for incomplete required fields.
 */
export function getValidationErrors(reportData) {
  const errors = []
  // Step 1: Header
  if (!reportData.date) errors.push({ step: 1, message: 'Date is required' })
  if (!reportData.shift) errors.push({ step: 1, message: 'Shift is required' })
  if (!reportData.start_time) errors.push({ step: 1, message: 'Start time is required' })
  if (!reportData.end_time) errors.push({ step: 1, message: 'End time is required' })

  // Step 2: Machines — at least one machine should have from/to timing
  const machines = reportData.machines || []
  const hasAnyMachineTiming = machines.some(m => m.from_time && m.to_time)
  const allMachinesIdle = machines.length > 0 && !hasAnyMachineTiming
  const remarksProvided = (reportData.remarks || '').trim().length > 0

  if (!hasAnyMachineTiming && machines.length > 0 && !allMachinesIdle) {
    // Some machines exist but none have timing (and not all-idle scenario)
    errors.push({ step: 2, message: 'Enter timing for at least one machine' })
  }

  // If all machines are idle, require a reason in remarks (Step 9)
  if (allMachinesIdle && !remarksProvided) {
    errors.push({ step: 9, message: 'No machines running — provide a reason in the Remarks field' })
  }

  // Step 4: Production validation — skip if all machines idle (no-production shift)
  const production = (reportData.production || []).filter(Boolean)
  const mixes = reportData.mixes || []
  const hasProduction = production.length > 0 && production.some(p => parseFloat(p.quantity) > 0)
  if (!hasProduction && !allMachinesIdle) {
    errors.push({ step: 4, message: 'Add at least one production entry' })
  } else if (hasProduction && mixes.length > 0) {
    // Only require mix usage if mixes were defined for this shift
    const hasMixUsageForProducedEntry = production.some(p => {
      const quantity = parseFloat(p.quantity) || 0
      if (quantity <= 0) return false
      return (p.mix_usages || []).some(mu => (parseFloat(mu.quantity_kg) || 0) > 0)
    })
    if (!hasMixUsageForProducedEntry) {
      errors.push({ step: 4, message: 'Add mix usage for at least one production entry' })
    }
  }

  return errors
}
