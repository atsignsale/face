import { GeoLocationData, OfficeConfig } from '../types';

/**
 * Calculates the great-circle distance between two points in meters using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Evaluates whether a location is within the office geofence radius.
 */
export function evaluateLocation(
  lat: number,
  lon: number,
  accuracy: number,
  office: OfficeConfig
): GeoLocationData {
  const distance = calculateDistanceMeters(lat, lon, office.latitude, office.longitude);
  const inOfficeZone = distance <= office.radiusMeters;

  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lon.toFixed(6)),
    accuracy: Math.round(accuracy),
    address: inOfficeZone
      ? `${office.name} (รัศมี ${distance} เมตร)`
      : `นอกเขตหน่วยงาน (${distance} เมตร จาก ${office.name})`,
    inOfficeZone,
    distanceFromOfficeMeters: distance,
  };
}

/**
 * Formats coordinates for display (e.g., 13.7563° N, 100.5018° E).
 */
export function formatCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}`;
}
