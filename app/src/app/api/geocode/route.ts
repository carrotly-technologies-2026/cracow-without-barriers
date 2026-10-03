import { NextResponse } from 'next/server';
import { logged, type LogMeta } from '@/lib/log';

import fs from 'node:fs/promises';
import path from 'node:path';
export const dynamic = 'force-dynamic';

const PHOTON = process.env.PHOTON_URL ?? 'https://photon.komoot.io/api/';

export const GET = logged('search', async (req: Request, meta: LogMeta) => {
  const u = new URL(req.url);
  const q = u.searchParams.get('q')?.trim();
  meta.q = q?.slice(0, 60);
  if (!q || q.length < 2) return NextResponse.json({ results: [] });
  let samples: any[] = [];
  try { samples = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'sample-places.json'), 'utf8')); } catch { /* none */ }
  const ql = q.toLowerCase();
  const sampleHits = samples.filter((s) => s.name.toLowerCase().includes(ql) || ql === 'demo').map((s) => ({ name: s.name, sub: 'DANE PRZYKŁADOWE · Kraków', lat: s.lat, lon: s.lon, osm: null, sample: s.id }));
  const lat = u.searchParams.get('lat'), lon = u.searchParams.get('lon');
  const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=6${lat && lon ? `&lat=${lat}&lon=${lon}` : ''}&lang=default`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'krakow-bez-barier/0.1' }, signal: AbortSignal.timeout(8000) });
    const j = await res.json();
    const results = (j.features ?? []).filter((f: any) => f.properties.countrycode === 'PL').map((f: any) => {
      const p = f.properties;
      return {
        name: p.name ?? [p.street, p.housenumber].filter(Boolean).join(' '),
        sub: [p.street && p.name ? [p.street, p.housenumber].filter(Boolean).join(' ') : null, p.city ?? p.district, p.postcode].filter(Boolean).join(', '),
        lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
        osm: p.osm_type && p.osm_id ? `${({ N: 'node', W: 'way', R: 'relation' } as any)[p.osm_type]}/${p.osm_id}` : null,
      };
    });
    meta.n = results.length;
    return NextResponse.json({ results: [...sampleHits, ...results] });
  } catch {
    meta.error = 'geocoder_unavailable';
    return NextResponse.json({ results: sampleHits, error: 'geocoder_unavailable' }, { status: 200 });
  }
});
