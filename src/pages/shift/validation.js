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

  // Step 2: Machines — at least one machine should have timing
  const hasAnyMachineTiming = reportData.machines.some(m => m.from_time && m.to_time)
  if (!hasAnyMachineTiming && reportData.machines.length > 0) {
    errors.push({ step: 2, message: 'Enter timing for at least one machine' })
  }

  // Step 3: Production — at least one entry
  const hasProduction = reportData.production && reportData.production.length > 0 &&
    reportData.production.some(p => parseFloat(p.quantity) > 0)
  if (!hasProduction) {
    errors.push({ step: 3, message: 'Add at least one production entry' })
  }

  // Step 4: Raw Materials — used field for at least one
  const hasRMUsage = reportData.rawMaterials.some(rm => parseFloat(rm.used) > 0)
  if (!hasRMUsage && reportData.rawMaterials.length > 0) {
    errors.push({ step: 4, message: 'Enter raw material usage for at least one material' })
  }

  return errors
}
