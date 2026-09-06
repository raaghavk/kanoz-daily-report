import { describe, it, expect } from 'vitest'
import {
  CHECK_IN_GEOFENCE_RADIUS_M,
  distanceMeters,
  evaluateCheckInGeofence,
  gpsErrorMessage,
  prepareSelfCheckIn,
} from '../geofence'

describe('CHECK_IN_GEOFENCE_RADIUS_M', () => {
  it('is a named 400 m default (no settings column exists)', () => {
    expect(CHECK_IN_GEOFENCE_RADIUS_M).toBe(400)
  })
})

describe('distanceMeters', () => {
  it('is 0 for the same point', () => {
    expect(distanceMeters(25.199314, 81.587749, 25.199314, 81.587749)).toBeCloseTo(0, 5)
  })

  it('matches 1° of longitude at the equator (~111195 m)', () => {
    expect(distanceMeters(0, 0, 0, 1)).toBeCloseTo(111194.93, 0)
  })
})

describe('evaluateCheckInGeofence', () => {
  const plant = { plantLat: 25.199314, plantLng: 81.587749 }

  it('rejects missing plant GPS', () => {
    const r = evaluateCheckInGeofence({ plantLat: null, plantLng: null, checkLat: 25.2, checkLng: 81.59 })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('missing_plant_gps')
    expect(r.message).toMatch(/Plant location is not set/)
  })

  it('rejects incomplete plant GPS', () => {
    expect(evaluateCheckInGeofence({ plantLat: 25.2, plantLng: null, checkLat: 25.2, checkLng: 81.59 }).code).toBe('missing_plant_gps')
    expect(evaluateCheckInGeofence({ plantLat: '', plantLng: 81.59, checkLat: 25.2, checkLng: 81.59 }).code).toBe('missing_plant_gps')
  })

  it('rejects missing device GPS', () => {
    const r = evaluateCheckInGeofence({ ...plant, checkLat: null, checkLng: null })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('missing_device_gps')
    expect(r.message).toMatch(/Could not read your GPS/)
  })

  it('allows check-in at the plant pin', () => {
    const r = evaluateCheckInGeofence({ ...plant, checkLat: plant.plantLat, checkLng: plant.plantLng })
    expect(r.ok).toBe(true)
    expect(r.distanceM).toBeCloseTo(0, 5)
    expect(r.radiusM).toBe(400)
  })

  it('allows check-in ~200 m away (inside the fence)', () => {
    // ~200 m north: 1° lat ≈ 111195 m
    const checkLat = plant.plantLat + 200 / 111195
    const r = evaluateCheckInGeofence({ ...plant, checkLat, checkLng: plant.plantLng })
    expect(r.ok).toBe(true)
    expect(r.distanceM).toBeGreaterThan(190)
    expect(r.distanceM).toBeLessThan(210)
  })

  it('allows check-in exactly on the radius', () => {
    const checkLat = plant.plantLat + CHECK_IN_GEOFENCE_RADIUS_M / 111195
    const r = evaluateCheckInGeofence({ ...plant, checkLat, checkLng: plant.plantLng })
    expect(r.ok).toBe(true)
    expect(r.distanceM).toBeLessThanOrEqual(CHECK_IN_GEOFENCE_RADIUS_M + 0.5)
  })

  it('blocks check-in ~800 m away', () => {
    const checkLat = plant.plantLat + 800 / 111195
    const r = evaluateCheckInGeofence({ ...plant, checkLat, checkLng: plant.plantLng })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('outside_geofence')
    expect(r.message).toMatch(/800 m from the plant/)
    expect(r.message).toMatch(/within 400 m/)
  })
})

describe('prepareSelfCheckIn', () => {
  const plant = { plantLat: 25.199314, plantLng: 81.587749 }

  it('sets status present and stores check-in coords when inside the fence', () => {
    const payload = prepareSelfCheckIn({
      ...plant,
      coords: { lat: 25.199314, lng: 81.587749 },
    })
    expect(payload.status).toBe('present')
    expect(payload.check_in_lat).toBe(25.199314)
    expect(payload.check_in_lng).toBe(81.587749)
    expect(payload.distanceM).toBeCloseTo(0, 5)
  })

  it('does not return a payload when outside the fence', () => {
    expect(() => prepareSelfCheckIn({
      ...plant,
      coords: { lat: 25.3, lng: 81.587749 },
    })).toThrow(/from the plant/)
  })

  it('does not skip the fence when GPS is missing', () => {
    expect(() => prepareSelfCheckIn({ ...plant, coords: null })).toThrow(/Could not read your GPS/)
    expect(() => prepareSelfCheckIn({ plantLat: null, plantLng: null, coords: { lat: 1, lng: 1 } })).toThrow(/Plant location is not set/)
  })
})

describe('gpsErrorMessage', () => {
  it('maps GeolocationPositionError codes', () => {
    expect(gpsErrorMessage({ code: 1 })).toMatch(/permission denied/i)
    expect(gpsErrorMessage({ code: 2 })).toMatch(/Could not read your GPS/)
    expect(gpsErrorMessage({ code: 3 })).toMatch(/timed out/i)
    expect(gpsErrorMessage({})).toMatch(/Enable location/)
  })
})
