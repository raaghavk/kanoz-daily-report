/** Default self-check-in radius around plants.location_lat/lng. No settings field exists yet. */
export const CHECK_IN_GEOFENCE_RADIUS_M = 400

function toCoord(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Haversine distance in metres. */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function gpsErrorMessage(err) {
  if (err?.code === 1) return 'Location permission denied. Enable location for this site and try again.'
  if (err?.code === 2) return 'Could not read your GPS. Move to an open area and try again.'
  if (err?.code === 3) return 'GPS timed out. Try again with a clearer signal.'
  return 'Could not read your GPS. Enable location and try again.'
}

/**
 * Gate self check-in: plant GPS and device GPS are both required; distance must be
 * within radiusM of the plant. Does not silently skip the fence.
 */
export function evaluateCheckInGeofence({
  plantLat,
  plantLng,
  checkLat,
  checkLng,
  radiusM = CHECK_IN_GEOFENCE_RADIUS_M,
} = {}) {
  const pLat = toCoord(plantLat)
  const pLng = toCoord(plantLng)
  if (pLat == null || pLng == null) {
    return {
      ok: false,
      code: 'missing_plant_gps',
      message: 'Plant location is not set. Ask an admin to save plant GPS in Settings before you can check in.',
    }
  }

  const cLat = toCoord(checkLat)
  const cLng = toCoord(checkLng)
  if (cLat == null || cLng == null) {
    return {
      ok: false,
      code: 'missing_device_gps',
      message: 'Could not read your GPS. Enable location and try again.',
    }
  }

  const distanceM = distanceMeters(pLat, pLng, cLat, cLng)
  if (distanceM > radiusM) {
    return {
      ok: false,
      code: 'outside_geofence',
      distanceM,
      radiusM,
      message: `You are about ${Math.round(distanceM)} m from the plant. Check-in is only allowed within ${radiusM} m.`,
    }
  }

  return { ok: true, code: 'ok', distanceM, radiusM }
}

/** Throws with a user-facing message if the fence fails; otherwise returns coords + status. */
export function prepareSelfCheckIn({ plantLat, plantLng, coords, radiusM = CHECK_IN_GEOFENCE_RADIUS_M } = {}) {
  const result = evaluateCheckInGeofence({
    plantLat,
    plantLng,
    checkLat: coords?.lat,
    checkLng: coords?.lng,
    radiusM,
  })
  if (!result.ok) {
    const err = new Error(result.message)
    err.code = result.code
    throw err
  }
  return {
    status: 'present',
    check_in_lat: Number(coords.lat),
    check_in_lng: Number(coords.lng),
    distanceM: result.distanceM,
  }
}
