import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import path from 'node:path';
import type { Confidence, Provenance } from './types';

export interface OsmNode { type: 'node'; id: number; lat: number; lon: number; tags: Record<string, string>; ts?: string }
export interface OsmWay { type: 'way'; id: number; geom: [number, number][]; tags: Record<string, string>; ts?: string } // geom = [lat, lon]
export interface TileData { nodes: OsmNode[]; ways: OsmWay[]; fetchedAt: string }

const MIRRORS = (process.env.OVERPASS_URLS ?? 'https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass.openstreetmap.fr/api/interpreter,https://overpass.kumi.systems/api/interpreter').split(',');
const CACHE_DIR = process.env.CACHE_DIR ?? path.join(process.cwd(), 'data', 'cache'); // writable, refreshed at runtime
const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR ?? path.join(process.cwd(), 'data', 'snapshot'); // shipped with the image (offline fallback)
const TTL_MS = 1000 * 60 * 60 * 24 * Number(process.env.OSM_TTL_DAYS ?? 3);
export const TILE = { lat: 0.012, lon: 0.018 };
const UA = 'krakow-bez-barier/0.1 (HackYeah 2026 prototype)';

const mem = new Map<string, { data: TileData; at: number }>();
const inflight = new Map<string, Promise<TileData>>();

export const tileKey = (x: number, y: number) => `${x}_${y}`;
export function tilesForBbox([minLon, minLat, maxLon, maxLat]: [number, number, number, number]) {
  const out: { x: number; y: number }[] = [];
  for (let x = Math.floor(minLon / TILE.lon); x <= Math.floor(maxLon / TILE.lon); x++)
    for (let y = Math.floor(minLat / TILE.lat); y <= Math.floor(maxLat / TILE.lat); y++) out.push({ x, y });
  return out;
}

function query(x: number, y: number) {
  const s = (y * TILE.lat).toFixed(5), w = (x * TILE.lon).toFixed(5), n = ((y + 1) * TILE.lat).toFixed(5), e = ((x + 1) * TILE.lon).toFixed(5);
  const bb = `${s},${w},${n},${e}`;
  return `[out:json][timeout:50];(
way["highway"~"^(footway|path|pedestrian|steps|cycleway|living_street|residential|service|track|unclassified|tertiary|secondary|primary|corridor)$"](${bb});
node["amenity"~"^(bench|toilets)$"](${bb});
node["leisure"="picnic_table"](${bb});
node["highway"~"^(crossing|elevator)$"](${bb});
node["kerb"](${bb});
node["barrier"="kerb"](${bb});
node["entrance"](${bb});
);out geom meta;`;
}

async function fetchOverpass(q: string): Promise<any> {
  let lastErr: unknown;
  for (const url of MIRRORS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': UA, Accept: '*/*', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(q),
          signal: AbortSignal.timeout(45000),
        });
        if (res.ok) return await res.json();
        lastErr = new Error(`Overpass ${res.status}`);
        if (res.status === 429 || res.status === 504) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      } catch (e) { lastErr = e; }
    }
  }
  throw lastErr;
}

function normalise(json: any): TileData {
  const nodes: OsmNode[] = [], ways: OsmWay[] = [];
  for (const el of json.elements ?? []) {
    if (el.type === 'node') nodes.push({ type: 'node', id: el.id, lat: el.lat, lon: el.lon, tags: el.tags ?? {}, ts: el.timestamp });
    else if (el.type === 'way' && el.geometry) ways.push({ type: 'way', id: el.id, geom: el.geometry.map((g: any) => [g.lat, g.lon]), tags: el.tags ?? {}, ts: el.timestamp });
  }
  return { nodes, ways, fetchedAt: new Date().toISOString() };
}

export type TileResult = { data: TileData | null; state: 'ok' | 'cache' | 'unavailable' };

/** Load one tile: memory → fresh disk → Overpass → stale disk (state 'cache') → nothing ('unavailable'). */
async function readGz(file: string): Promise<TileData | null> {
  try { return JSON.parse(zlib.gunzipSync(await fs.readFile(file)).toString('utf8')); } catch { return null; }
}
const age = (d: TileData) => Date.now() - new Date(d.fetchedAt).getTime();

/** Load one tile: memory → fresh cache → fresh snapshot → live Overpass → stale cache/snapshot ('cache') → nothing ('unavailable'). */
export async function loadTile(x: number, y: number): Promise<TileResult> {
  const key = tileKey(x, y);
  const m = mem.get(key);
  if (m && Date.now() - m.at < TTL_MS) return { data: m.data, state: 'ok' };
  const file = path.join(CACHE_DIR, `tile_${key}.json.gz`);
  const [cached, snap] = await Promise.all([readGz(file), readGz(path.join(SNAPSHOT_DIR, `tile_${key}.json.gz`))]);
  const freshest = [cached, snap].filter(Boolean).sort((a, b) => age(a!) - age(b!))[0] ?? null;
  if (freshest && age(freshest) < TTL_MS) { mem.set(key, { data: freshest, at: Date.now() }); return { data: freshest, state: 'ok' }; }
  if (process.env.FORCE_OSM_OFFLINE === '1') return { data: freshest, state: freshest ? 'cache' : 'unavailable' };
  try {
    let p = inflight.get(key);
    if (!p) {
      p = fetchOverpass(query(x, y)).then(normalise);
      inflight.set(key, p);
      p.finally(() => inflight.delete(key)).catch(() => {});
    }
    const data = await p;
    mem.set(key, { data, at: Date.now() });
    fs.mkdir(CACHE_DIR, { recursive: true }).then(() => fs.writeFile(file, zlib.gzipSync(JSON.stringify(data)))).catch(() => {});
    return { data, state: 'ok' };
  } catch {
    return { data: freshest, state: freshest ? 'cache' : 'unavailable' };
  }
}

export interface Region { nodes: OsmNode[]; ways: OsmWay[]; state: 'ok' | 'cache' | 'unavailable'; fetchedAt?: string; missingTiles: number }

export async function loadRegion(bbox: [number, number, number, number]): Promise<Region> {
  const tiles = tilesForBbox(bbox);
  if (tiles.length > 40) throw new Error('Area too large');
  const results: TileResult[] = [];
  // modest concurrency to be polite to Overpass
  for (let i = 0; i < tiles.length; i += 2) results.push(...(await Promise.all(tiles.slice(i, i + 2).map((t) => loadTile(t.x, t.y)))));
  const nodes = new Map<number, OsmNode>(), ways = new Map<number, OsmWay>();
  let state: Region['state'] = 'ok', fetchedAt: string | undefined, missing = 0;
  for (const r of results) {
    if (!r.data) { missing++; continue; }
    if (r.state === 'cache') state = 'cache';
    if (!fetchedAt || r.data.fetchedAt < fetchedAt) fetchedAt = r.data.fetchedAt;
    r.data.nodes.forEach((n) => nodes.set(n.id, n));
    r.data.ways.forEach((w) => ways.set(w.id, w));
  }
  if (missing === results.length) state = 'unavailable';
  else if (missing > 0 && state === 'ok') state = 'cache';
  return { nodes: [...nodes.values()], ways: [...ways.values()], state, fetchedAt, missingTiles: missing };
}

/** Build provenance for an OSM element. check_date is a deliberate survey; otherwise we only know the last edit. */
export function osmProv(type: 'node' | 'way', id: number, tags: Record<string, string>, ts?: string): Provenance {
  const cd = tags['check_date'] || tags['check_date:wheelchair'] || tags['survey:date'];
  const now = Date.now();
  const ageYears = (iso?: string) => (iso ? (now - new Date(iso).getTime()) / 3.15e10 : Infinity);
  let confidence: Confidence = 'unverified';
  let updated = ts, basis: Provenance['freshnessBasis'] = 'osm_edit';
  if (cd && !Number.isNaN(Date.parse(cd))) {
    updated = new Date(cd).toISOString();
    basis = 'check_date';
    confidence = ageYears(cd) < 2 ? 'confirmed' : 'likely';
  } else if (ageYears(ts) < 3) confidence = 'likely';
  return { source: 'osm', ref: `OSM ${type} ${id}`, url: `https://www.openstreetmap.org/${type}/${id}`, updated, confidence, freshnessBasis: basis };
}
