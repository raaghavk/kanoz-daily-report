import { DEMO_GEOFENCE_LAT, DEMO_GEOFENCE_LNG } from './mode.js'

/** Fictional device GPS used for demo check-in (same pin as the sample plant). */
export function demoDeviceCoords() {
  return { lat: DEMO_GEOFENCE_LAT, lng: DEMO_GEOFENCE_LNG }
}

/**
 * Replace navigator.geolocation so no screen can capture a real device pin
 * during the prospect tour (attendance, purchases, suppliers, admin GPS).
 */
export function installDemoGeolocation() {
  if (typeof navigator === 'undefined') return
  const coords = {
    latitude: DEMO_GEOFENCE_LAT,
    longitude: DEMO_GEOFENCE_LNG,
    accuracy: 12,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  }
  const position = { coords, timestamp: Date.now() }
  const geo = {
    getCurrentPosition(success) {
      if (typeof success === 'function') success(position)
    },
    watchPosition(success) {
      if (typeof success === 'function') success(position)
      return 1
    },
    clearWatch() {},
  }
  try {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geo })
  } catch {
    navigator.geolocation = geo
  }
}
