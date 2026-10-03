import { annotate, buildDataset } from './annotate';
import { bboxOf, haversine, offset, sampleLine } from './geo';
import { loadRegion } from './osm';
import { listReports } from './reports';
import { t, type Lang } from './i18n';
import type { DataStatus, Pt, Prefs, RouteResult } from './types';

// comma-separated list, tried in order (e.g. own OSRM first, public instance as fallback)
const ROUTERS = (process.env.ROUTER_URL ?? 'https://routing.openstreetmap.de/routed-foot').split(',').map((u) => u.trim()).filter(Boolean);
const UA = 'krakow-bez-barier/0.1 (HackYeah 2026 prototype)';

interface Cand { geometry: [number, number][]; distance: number; duration: number }

async function osrm(points: Pt[], alternatives = false): Promise<Cand[]> {
  const coords = points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  let lastErr: unknown;
  for (const base of ROUTERS) {
    const url = `${base}/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false&alternatives=${alternatives ? 3 : 0}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(base.includes('osrm:') || base.includes('localhost') ? 8000 : 15000) });
      if (!res.ok) { lastErr = new Error('router ' + res.status); continue; }
      const j = await res.json();
      if (j.code !== 'Ok') return [];
      return j.routes.map((r: any) => ({ geometry: r.geometry.coordinates, distance: r.distance, duration: r.duration }));
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const sig = (c: Cand) => `${Math.round(c.distance / 15)}_${c.geometry[Math.floor(c.geometry.length / 2)].map((n) => n.toFixed(4)).join(',')}`;

export interface RouteResponse { routes: RouteResult[]; status: DataStatus; blockedOnly: boolean }

export async function findRoutes(from: Pt, to: Pt, prefs: Prefs, lang: Lang): Promise<RouteResponse> {
  const direct = haversine(from, to);
  if (direct > 8000) throw Object.assign(new Error('too_far'), { code: 'too_far' });

  const base = await osrm([from, to], true); // throws if router down
  if (!base.length) throw Object.assign(new Error('no_route'), { code: 'no_route' });

  const pad = Math.max(500, direct * 0.35);
  const region = await loadRegion(bboxOf([from, to], pad));
  const ds = buildDataset(region);
  const reports = await listReports();

  const seen = new Set<string>();
  const results: RouteResult[] = [];
  const add = (cands: Cand[]) => {
    for (const c of cands) {
      const k = sig(c);
      if (seen.has(k)) continue;
      seen.add(k);
      results.push(annotate({ id: 'r' + results.length, label: '', geometry: c.geometry, distance: c.distance, duration: c.duration, prefs, lang, region, ds, reports }));
    }
  };
  add(base);

  // Barrier-aware re-routing: if the best candidate still has a blocker, try detours around it.
  for (let round = 0; round < 2; round++) {
    const best = [...results].sort((a, b) => b.score - a.score)[0];
    const blockers = best.issues.filter((i) => i.severity === 'blocker');
    if (!blockers.length) break;
    const b = blockers[0];
    const line = sampleLine(best.geometry, 10);
    const idx = Math.max(0, line.findIndex((s) => s.at >= b.at));
    const a = line[Math.max(0, idx - 2)].pt, c = line[Math.min(line.length - 1, idx + 2)].pt;
    const dx = (c.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180), dy = c.lat - a.lat;
    const norm = Math.hypot(dx, dy) || 1;
    const px = -dy / norm, py = dx / norm; // perpendicular (east, north)
    const vias: Pt[] = [];
    for (const dist of [70, 140, 240]) for (const sgn of [1, -1]) vias.push(offset(b.pos, px * dist * sgn, py * dist * sgn));
    const detours = await Promise.all(vias.map((v) => osrm([from, v, to]).catch(() => [])));
    // load any extra area the detours reach
    const extra = bboxOf(detours.flat().flatMap((d) => d.geometry.filter((_, i) => i % 10 === 0).map(([lon, lat]) => ({ lat, lon }))), 30);
    const region2 = await loadRegion(extra);
    const merged = { nodes: [...region.nodes, ...region2.nodes], ways: [...region.ways, ...region2.ways] };
    const ds2 = buildDataset(merged);
    for (const d of detours.flat()) {
      if (d.distance > Math.max(direct * 2.2, direct + 900)) continue; // silly detours
      const k = sig(d);
      if (seen.has(k)) continue;
      seen.add(k);
      results.push(annotate({ id: 'r' + results.length, label: '', geometry: d.geometry, distance: d.distance, duration: d.duration, prefs, lang, region: region2, ds: ds2, reports }));
    }
  }

  const ranked = [...results].sort((a, b) => b.score - a.score || a.distance - b.distance);
  const top: RouteResult[] = [];
  const bestR = ranked[0];
  bestR.label = t(lang, 'route.best');
  top.push(bestR);
  const shortest = [...results].sort((a, b) => a.distance - b.distance)[0];
  if (shortest.id !== bestR.id) { shortest.label = t(lang, 'route.shortest'); top.push(shortest); }
  for (const r of ranked) { if (top.length >= 3) break; if (!top.includes(r)) { r.label = t(lang, 'route.alt'); top.push(r); } }

  const notes: string[] = [];
  if (region.state === 'cache') notes.push('osm-cache');
  if (region.missingTiles) notes.push('osm-partial');
  return {
    routes: top,
    status: { osm: region.state, router: 'ok', fetchedAt: region.fetchedAt, notes },
    blockedOnly: top.every((r) => r.verdict === 'blocked'),
  };
}
