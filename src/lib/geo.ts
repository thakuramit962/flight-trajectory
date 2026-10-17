const EARTH_RADIUS_M = 6_371_008.8;

export interface LatLngLike {
  lat: number;
  lng: number;
}

/** Great-circle distance in meters. */
export function haversineMeters(a: LatLngLike, b: LatLngLike): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
