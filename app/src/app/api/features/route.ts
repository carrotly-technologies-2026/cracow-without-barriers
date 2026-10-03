import { NextResponse } from 'next/server';
import { loadRegion, osmProv } from '@/lib/osm';
import { kerbHeightCm } from '@/lib/tags';
import { listReports, reportProv } from '@/lib/reports';
export const dynamic = 'force-dynamic';

/** Map overlay features (benches, toilets, steps, kerbs, lifts) for a viewport, with provenance. */
export async function GET(req: Request) {
  const bb = (new URL(req.url).searchParams.get('bbox') ?? '').split(',').map(Number);
  if (bb.length !== 4 || bb.some((n) => !Number.isFinite(n))) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const [w, s, e, n] = bb;
  if ((e - w) * (n - s) > 0.0008) return NextResponse.json({ error: 'too_large' }, { status: 422 });
  const region = await loadRegion([w, s, e, n]);
  const inView = (lat: number, lon: number) => lat >= s && lat <= n && lon >= w && lon <= e;
  const features: any[] = [];
  for (const nd of region.nodes) {
    if (!inView(nd.lat, nd.lon)) continue;
    const tg = nd.tags;
    let kind: string | null = null, label = '';
    if (tg.amenity === 'bench' || tg.leisure === 'picnic_table') kind = 'bench';
    else if (tg.amenity === 'toilets') { kind = 'toilets'; label = tg.wheelchair ?? 'unknown'; }
    else if (tg.highway === 'elevator') kind = 'elevator';
    else if (tg.highway === 'crossing' || tg.kerb || tg.barrier === 'kerb') { kind = 'kerb'; const h = kerbHeightCm(tg); label = h == null ? 'unknown' : h <= 2 ? 'low' : 'high'; }
    if (kind) features.push({ kind, label, lat: nd.lat, lon: nd.lon, prov: osmProv('node', nd.id, tg, nd.ts), tags: pick(tg) });
  }
  for (const wy of region.ways) {
    if (wy.tags.highway !== 'steps') continue;
    const [lat, lon] = wy.geom[Math.floor(wy.geom.length / 2)];
    if (inView(lat, lon)) features.push({ kind: 'steps', label: wy.tags.step_count ?? '', lat, lon, prov: osmProv('way', wy.id, wy.tags, wy.ts), tags: pick(wy.tags) });
  }
  const reports = (await listReports()).filter((r) => inView(r.lat, r.lon)).map((r) => ({ ...r, prov: reportProv(r) }));
  return NextResponse.json({ features, reports, state: region.state, fetchedAt: region.fetchedAt });
}
function pick(t: Record<string, string>) {
  const keys = ['wheelchair', 'kerb', 'kerb:height', 'surface', 'smoothness', 'step_count', 'ramp', 'ramp:wheelchair', 'handrail', 'backrest', 'fee', 'opening_hours', 'crossing', 'tactile_paving', 'check_date', 'width'];
  return Object.fromEntries(keys.filter((k) => t[k] !== undefined).map((k) => [k, t[k]]));
}
