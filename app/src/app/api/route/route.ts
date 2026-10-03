import { NextResponse } from 'next/server';
import { logged, type LogMeta } from '@/lib/log';

import { findRoutes } from '@/lib/router';
import { DEFAULT_PREFS } from '@/lib/prefs';
import type { Prefs } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export const POST = logged('route', async (req: Request, meta: LogMeta) => {
  const body = await req.json().catch(() => null);
  const from = body?.from, to = body?.to;
  if (!from || !to || !Number.isFinite(from.lat) || !Number.isFinite(to.lat)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const p = body.prefs ?? {};
  const prefs: Prefs = {
    preset: ['manual', 'electric', 'stroller', 'walker', 'custom'].includes(p.preset) ? p.preset : DEFAULT_PREFS.preset,
    steps: p.steps === 'allow' ? 'allow' : 'avoid',
    maxKerbCm: num(p.maxKerbCm, 0, 15, 2), surface: ['smooth', 'moderate', 'any'].includes(p.surface) ? p.surface : 'smooth',
    maxSlopePct: num(p.maxSlopePct, 2, 20, 6), minWidthM: num(p.minWidthM, 0.5, 1.5, 0.9), restEveryM: num(p.restEveryM, 0, 2000, 0),
  };
  const lang = body.lang === 'en' ? 'en' : 'pl';
  Object.assign(meta, { preset: prefs.preset, from: [+from.lat.toFixed(4), +from.lon.toFixed(4)], to: [+to.lat.toFixed(4), +to.lon.toFixed(4)], lang });
  try {
    const out = await findRoutes({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }, prefs, lang);
    Object.assign(meta, { routes: out.routes.length, best: { score: out.routes[0]?.score, verdict: out.routes[0]?.verdict }, osm: out.status.osm });
    return NextResponse.json(out);
  } catch (e: any) {
    const code = e?.code ?? 'router_unavailable';
    meta.error = code;
    return NextResponse.json({ error: code }, { status: code === 'too_far' || code === 'no_route' ? 422 : 502 });
  }
});
