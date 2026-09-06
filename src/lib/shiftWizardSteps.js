/** 1-based step numbers for the 11-step shift wizard. Keep in sync with ShiftWizard STEPS. */
export const SHIFT_STEP = {
  HEADER: 1,
  MACHINES: 2,
  RAW_MATERIAL: 3,
  PROCESSING: 4,
  PRODUCTION: 5,
  REVIEW: 6,
  DIESEL: 7,
  DISPATCH: 8,
  PELLET: 9,
  ISSUES: 10,
  SUBMIT: 11,
}

export const SHIFT_STEP_TITLES = [
  'Report Header',
  'Machine Timings',
  'Raw Material & Mix',
  'In-House Processing',
  'Production',
  'RM & Mix Review',
  'Equipment & Diesel',
  'Dispatch Summary',
  'Pellet Stock',
  'Issues',
  'Submit',
]

export const SHIFT_STEP_COUNT = SHIFT_STEP_TITLES.length
