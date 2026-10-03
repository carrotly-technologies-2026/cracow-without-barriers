import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { haversine, bboxOf } from '@/lib/geo';
import { loadRegion, osmProv } from '@/lib/osm';
import { resolveFacts } from '@/lib/resolve';
import { listReports, reportProv } from '@/lib/reports';
import type { Fact, Provenance } from '@/lib/types';
export const dynamic = 'force-dynamic';

const UA = 'krakow-bez-barier/0.1';
const SNAPSHOT_TTL_MS = 1000 * 60 * 60 * 24 * Number(process.env.OSM_TTL_DAYS ?? 3);
const ATTRS = ['wheelchair', 'entrance_step', 'door_width', 'automatic_door', 'lift', 'toilet', 'level'];

async function samplePlaces(): Promise<any[]> {
  try { return JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'sample-places.json'), 'utf8')); } catch { return []; }
}

async function featuredSnapshot(ref: string): Promise<any | null> {
  try {
    const j = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'featured-places.json'), 'utf8'));
    const p = j.places.find((x: any) => x.osm === ref);
    if (!p) return null;
    const [type, id] = ref.split('/');
    return { type, id: Number(id), tags: { name: p.name, ...p.tags }, timestamp: p.timestamp, fetchedAt: j.fetchedAt };
  } catch { return null; }
}

async function featuredDeclared(ref: string): Promise<{ attr: string; value: string; updated: string; confidence: 'confirmed' | 'likely' }[]> {
  try {
    const j = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'featured-places.json'), 'utf8'));
    return j.places.find((x: any) => x.osm === ref)?.declared ?? [];
  } catch { return []; }
}

async function fetchElement(ref: string): Promise<any | null> {
  const [type, id] = ref.split('/');
  if (!['node', 'way', 'relation'].includes(type) || !/^\d+$/.test(id)) return null;
  for (const url of ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter']) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, Accept: '*/*', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(`[out:json][timeout:20];${type}(${id});out center meta;`), signal: AbortSignal.timeout(5000) });
      if (res.ok) return (await res.json()).elements?.[0] ?? null;
    } catch { /* try next */ }
  }
  return null;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const sampleId = u.searchParams.get('sample');
  const osmRef = u.searchParams.get('osm');
  const lat = Number(u.searchParams.get('lat')), lon = Number(u.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const facts: Fact[] = [];
  let name = u.searchParams.get('name') ?? '';
  let sample = false, osmState: 'ok' | 'unavailable' | 'cache' = 'ok';
  let osmTags: Record<string, string> = {};
  const here = { lat, lon };

  if (sampleId) {
    const sp = (await samplePlaces()).find((s) => s.id === sampleId);
    if (!sp) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    sample = true; name = sp.name;
    for (const d of sp.declared) facts.push({ attr: d.attr, value: d.value, prov: { source: 'sample', ref: 'Deklaracja właściciela (DANE PRZYKŁADOWE)', updated: new Date(d.updated).toISOString(), confidence: 'likely', freshnessBasis: 'sample' } });
    for (const r of sp.reportsNearby) facts.push({ attr: r.type === 'steps' ? 'entrance_step' : 'report', value: r.type === 'steps' ? 'yes' : r.type, prov: { source: 'sample', ref: 'Zgłoszenie użytkownika (DANE PRZYKŁADOWE)', updated: r.createdAt, confidence: 'unverified', freshnessBasis: 'sample' } });
  } else if (osmRef) {
    // featured venues: answer instantly from the bundled OSM snapshot while it is fresh (same TTL as map tiles); otherwise try live, then fall back
    const snap = await featuredSnapshot(osmRef);
    const fresh = snap && Date.now() - new Date(snap.fetchedAt).getTime() < SNAPSHOT_TTL_MS;
    let el = fresh ? snap : await fetchElement(osmRef);
    if (!el && snap) { el = snap; osmState = 'cache'; }
    if (!el) osmState = 'unavailable';
    else {
      osmTags = el.tags ?? {};
      const prov = osmProv(el.type, el.id, osmTags, el.timestamp);
      if (osmTags.wheelchair) facts.push({ attr: 'wheelchair', value: osmTags.wheelchair, prov });
      if (osmTags['door:width'] || osmTags.width) facts.push({ attr: 'door_width', value: (osmTags['door:width'] ?? osmTags.width).replace(/[^0-9.,]/g, ''), prov });
      if (osmTags.automatic_door) facts.push({ attr: 'automatic_door', value: osmTags.automatic_door === 'no' ? 'no' : 'yes', prov });
      if (osmTags.elevator === 'yes' || osmTags['wheelchair:description']) facts.push({ attr: 'lift', value: osmTags.elevator ?? 'yes', prov });
      if (osmTags['toilets:wheelchair']) facts.push({ attr: 'toilet', value: osmTags['toilets:wheelchair'], prov });
      if (osmTags.level) facts.push({ attr: 'level', value: osmTags.level, prov });
      name ||= osmTags.name ?? '';
    }
  }

  if (osmRef) {
    for (const dc of await featuredDeclared(osmRef)) facts.push({ attr: dc.attr, value: dc.value, prov: { source: 'owner', ref: 'Deklaracja właściciela', updated: new Date(dc.updated).toISOString(), confidence: dc.confidence, freshnessBasis: 'owner_declaration' } });
  }
  // entrances, toilets & user reports around the place (from the same tile data used for routing)
  const region = await loadRegion(bboxOf([here], 120));
  if (region.state !== 'ok' && osmState === 'ok') osmState = region.state;
  const toilets: any[] = [];
  for (const n of region.nodes) {
    const d = haversine(here, n);
    if (n.tags.entrance && d <= 40 && !sample) {
      const prov = osmProv('node', n.id, n.tags, n.ts);
      if (n.tags.wheelchair) facts.push({ attr: 'wheelchair', value: n.tags.wheelchair, prov });
      if (n.tags.kerb || n.tags['step_count']) facts.push({ attr: 'entrance_step', value: n.tags.step_count && n.tags.step_count !== '0' ? 'yes' : 'no', prov });
      if (n.tags['door:width'] || n.tags.width) facts.push({ attr: 'door_width', value: (n.tags['door:width'] ?? n.tags.width).replace(/[^0-9.,]/g, ''), prov });
      if (n.tags.automatic_door) facts.push({ attr: 'automatic_door', value: n.tags.automatic_door === 'no' ? 'no' : 'yes', prov });
    }
    if (n.tags.amenity === 'toilets' && d <= 200) toilets.push({ lat: n.lat, lon: n.lon, dist: Math.round(d), wheelchair: n.tags.wheelchair ?? 'unknown', prov: osmProv('node', n.id, n.tags, n.ts) });
  }
  if (!sample) {
    for (const r of await listReports()) {
      if (haversine(here, r) <= 30 && (r.type === 'steps' || r.type === 'blocked')) facts.push({ attr: 'entrance_step', value: r.type === 'steps' ? 'yes' : 'blocked', prov: reportProv(r) });
    }
  }
  toilets.sort((a, b) => a.dist - b.dist);
  const resolved = resolveFacts(ATTRS, facts);
  return NextResponse.json({ name, lat, lon, sample, resolved, toilets: toilets.slice(0, 3), osm: osmState, tags: osmTags, hasData: facts.length > 0 });
}
