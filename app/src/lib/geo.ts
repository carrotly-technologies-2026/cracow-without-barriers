import type { Pt } from './types';
const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
export function haversine(a: Pt, b: Pt): number {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** local equirectangular projection to metres around a reference latitude */
export function project(p: Pt, ref: Pt): [number, number] {
  return [rad(p.lon - ref.lon) * R * Math.cos(rad(ref.lat)), rad(p.lat - ref.lat) * R];
}
/** distance from point p to segment ab, plus t along segment (0..1) */
export function distToSegment(p: Pt, a: Pt, b: Pt): { d: number; t: number } {
  const [px, py] = project(p, a), [bx, by] = project(b, a);
  const len2 = bx * bx + by * by;
  let t = len2 === 0 ? 0 : (px * bx + py * by) / len2;
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(px - t * bx, py - t * by), t };
}
export interface Sampled { pt: Pt; at: number }
/** Resample a [lon,lat] polyline every `step` metres */
export function sampleLine(coords: [number, number][], step = 10): Sampled[] {
  const out: Sampled[] = [];
  let acc = 0, next = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = { lat: coords[i][1], lon: coords[i][0] }, b = { lat: coords[i + 1][1], lon: coords[i + 1][0] };
    const seg = haversine(a, b);
    while (next <= acc + seg && seg > 0) {
      const t = (next - acc) / seg;
      out.push({ pt: { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t }, at: next });
      next += step;
    }
    acc += seg;
  }
  const last = coords[coords.length - 1];
  out.push({ pt: { lat: last[1], lon: last[0] }, at: acc });
  return out;
}
export function bboxOf(pts: Pt[], padM = 0): [number, number, number, number] {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const p of pts) { minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon); }
  const dLat = (padM / R) * (180 / Math.PI), dLon = dLat / Math.cos(rad((minLat + maxLat) / 2));
  return [minLon - dLon, minLat - dLat, maxLon + dLon, maxLat + dLat];
}
/** offset a point by metres east/north */
export function offset(p: Pt, east: number, north: number): Pt {
  return { lat: p.lat + (north / R) * (180 / Math.PI), lon: p.lon + (east / (R * Math.cos(rad(p.lat)))) * (180 / Math.PI) };
}
