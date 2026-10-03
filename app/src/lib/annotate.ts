import { distToSegment, sampleLine, haversine, bboxOf, type Sampled } from './geo';
import { osmProv, type OsmNode, type OsmWay, type Region } from './osm';
import { classifySurface, isPedestrianWay, kerbHeightCm, parseIncline, parseMetres, surfaceLabel } from './tags';
import { reportFact, reportConfidence, type Report } from './reports';
import { SPEED } from './prefs';
import { t, type Lang } from './i18n';
import type { Fact, Issue, Prefs, Pt, RouteResult } from './types';

const STEP = 8; // sampling step in metres
const WAY_SNAP = 14;
const CELL = { lat: 0.0004, lon: 0.0006 };
const cellKey = (lat: number, lon: number) => `${Math.floor(lat / CELL.lat)}_${Math.floor(lon / CELL.lon)}`;

interface Seg { way: OsmWay; a: Pt; b: Pt }

class Grid<T> {
  private m = new Map<string, T[]>();
  add(lat: number, lon: number, v: T) { const k = cellKey(lat, lon); (this.m.get(k) ?? this.m.set(k, []).get(k)!).push(v); }
  near(lat: number, lon: number): T[] {
    const out: T[] = [];
    const cy = Math.floor(lat / CELL.lat), cx = Math.floor(lon / CELL.lon);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push(...(this.m.get(`${cy + dy}_${cx + dx}`) ?? []));
    return out;
  }
}

export interface Dataset { segs: Grid<Seg>; nodes: Grid<OsmNode>; ways: Map<number, OsmWay> }

export function buildDataset(region: Pick<Region, 'nodes' | 'ways'>): Dataset {
  const segs = new Grid<Seg>(), nodes = new Grid<OsmNode>(), ways = new Map<number, OsmWay>();
  for (const w of region.ways) {
    ways.set(w.id, w);
    for (let i = 0; i < w.geom.length - 1; i++) {
      const a = { lat: w.geom[i][0], lon: w.geom[i][1] }, b = { lat: w.geom[i + 1][0], lon: w.geom[i + 1][1] };
      const n = Math.max(1, Math.ceil(haversine(a, b) / 20)); // register along the segment so long segments are found
      for (let k = 0; k <= n; k++) segs.add(a.lat + ((b.lat - a.lat) * k) / n, a.lon + ((b.lon - a.lon) * k) / n, { way: w, a, b });
    }
  }
  for (const n of region.nodes) nodes.add(n.lat, n.lon, n);
  return { segs, nodes, ways };
}

function nearestWay(ds: Dataset, p: Pt): { way: OsmWay; d: number } | null {
  let best: { way: OsmWay; d: number; score: number } | null = null;
  const seen = new Set<Seg>();
  for (const s of ds.segs.near(p.lat, p.lon)) {
    if (seen.has(s)) continue;
    seen.add(s);
    const { d } = distToSegment(p, s.a, s.b);
    if (d > WAY_SNAP) continue;
    let score = d + (isPedestrianWay(s.way.tags) ? 0 : 6); // prefer footways over carriageways
    if (s.way.tags.highway === 'steps' && d > 5) score += 100; // only count stairs the route really follows
    if (!best || score < best.score) best = { way: s.way, d, score };
  }
  return best;
}

let uid = 0;
const nid = () => `i${++uid}`;

export interface AnnotateInput {
  id: string;
  label: string;
  geometry: [number, number][];
  distance: number;
  duration: number;
  prefs: Prefs;
  lang: Lang;
  region: Region;
  ds: Dataset;
  reports: Report[];
}

const REPORT_BLOCKERS = new Set(['steps', 'blocked', 'lift_broken']);

export function annotate(inp: AnnotateInput): RouteResult {
  const { prefs, lang, ds } = inp;
  const samples = sampleLine(inp.geometry, STEP);
  const issues: Issue[] = [];
  const total = samples.length ? samples[samples.length - 1].at : 0;

  // ---------- 1. way-based attributes (steps, surface, slope, width) ----------
  type Run = { way: OsmWay | null; from: Sampled; to: Sampled; proxy: boolean };
  const runs: Run[] = [];
  for (const s of samples) {
    const nw = nearestWay(ds, s.pt);
    const way = nw?.way ?? null;
    const last = runs[runs.length - 1];
    if (last && last.way?.id === way?.id) last.to = s;
    else runs.push({ way, from: s, to: s, proxy: !!way && !isPedestrianWay(way.tags) });
  }
  let knownLen = 0, roughLen = 0, stepsCount = 0;
  let prev: Issue | null = null;
  const pushMerge = (iss: Issue, key: string) => {
    if (prev && (prev as any).__key === key && iss.at - ((prev.at) + (prev.length ?? 0)) < 60) {
      prev.length = iss.at + (iss.length ?? 0) - prev.at;
      prev.facts.push(...iss.facts.filter((f) => !prev!.facts.some((x) => x.prov.ref === f.prov.ref)));
      prev.detail = mergeDetail(prev, lang);
      return;
    }
    (iss as any).__key = key; issues.push(iss); prev = iss;
  };
  const mergeDetail = (i: Issue, l: Lang) => t(l, `iss.${i.type}.merged`, { len: Math.round(i.length ?? 0) });

  for (const r of runs) {
    const len = Math.max(r.to.at - r.from.at, 0) + STEP;
    if (!r.way) continue;
    const tags = r.way.tags, prov = osmProv('way', r.way.id, tags, r.way.ts);
    if (r.proxy) prov.confidence = 'unverified';
    const pos = r.from.pt;
    const proxyNote = r.proxy ? ' ' + t(lang, 'note.proxy') : '';

    if (tags.highway === 'steps') {
      knownLen += len;
      const n = parseInt(tags.step_count ?? '', 10);
      stepsCount++;
      const ramp = tags['ramp:wheelchair'] === 'yes' || tags['ramp:stroller'] === 'yes' || tags.ramp === 'yes';
      const block = prefs.steps === 'avoid' && !ramp;
      pushMerge({ id: nid(), type: 'steps', severity: block ? 'blocker' : 'warning', at: r.from.at, length: len, pos,
        title: Number.isFinite(n) ? t(lang, 'iss.steps.titleN', { n }) : t(lang, 'iss.steps.title'),
        detail: t(lang, ramp ? 'iss.steps.ramp' : 'iss.steps.detail', { len: Math.round(len) }),
        facts: [{ attr: 'highway', value: 'steps', prov }] }, 'steps' + block);
      continue;
    }
    if (tags.wheelchair === 'no') {
      pushMerge({ id: nid(), type: 'steps', severity: 'blocker', at: r.from.at, length: len, pos, title: t(lang, 'iss.wcno.title'), detail: t(lang, 'iss.wcno.detail'), facts: [{ attr: 'wheelchair', value: 'no', prov }] }, 'wcno');
    }

    const sc = classifySurface(tags);
    if (sc.cls !== 'unknown') {
      knownLen += len;
      const label = sc.raw ? surfaceLabel(sc.raw.replace('smoothness=', '')) : '';
      const f: Fact = { attr: 'surface', value: sc.raw ?? '', prov };
      if (sc.cls === 'rough') {
        roughLen += len;
        const sev = prefs.surface === 'any' ? 'info' : 'warning';
        pushMerge({ id: nid(), type: 'surface', severity: sev, at: r.from.at, length: len, pos, title: t(lang, 'iss.surface.rough', { s: label }), detail: t(lang, 'iss.surface.roughDetail', { len: Math.round(len) }) + proxyNote, facts: [f] }, 'rough' + sev);
      } else if (sc.cls === 'moderate') {
        const sev = prefs.surface === 'smooth' && !(tags.surface && ['asphalt', 'concrete', 'paving_stones'].includes(tags.surface)) ? 'warning' : 'info';
        pushMerge({ id: nid(), type: 'surface', severity: sev, at: r.from.at, length: len, pos, title: t(lang, 'iss.surface.moderate', { s: label }), detail: t(lang, 'iss.surface.modDetail', { len: Math.round(len) }) + proxyNote, facts: [f] }, 'mod' + sev);
      }
    }

    const inc = parseIncline(tags);
    if (inc != null && inc > prefs.maxSlopePct) {
      pushMerge({ id: nid(), type: 'slope', severity: inc > prefs.maxSlopePct * 1.6 ? 'blocker' : 'warning', at: r.from.at, length: len, pos, title: t(lang, 'iss.slope.title', { p: inc.toFixed(0) }), detail: t(lang, 'iss.slope.detail', { max: prefs.maxSlopePct }), facts: [{ attr: 'incline', value: tags.incline, prov }] }, 'slope');
    }
    const w = parseMetres(tags.width) ?? parseMetres(tags['width:effective']);
    if (w != null && w < prefs.minWidthM && tags.highway !== 'steps') {
      pushMerge({ id: nid(), type: 'width', severity: w < prefs.minWidthM * 0.8 ? 'blocker' : 'warning', at: r.from.at, length: len, pos, title: t(lang, 'iss.width.title', { w: w.toFixed(2) }), detail: t(lang, 'iss.width.detail', { min: prefs.minWidthM }), facts: [{ attr: 'width', value: tags.width ?? '', prov }] }, 'width');
    }
    if (tags.ramp === 'yes' || tags['ramp:wheelchair'] === 'yes') {
      issues.push({ id: nid(), type: 'ramp', severity: 'good', at: r.from.at, length: len, pos, title: t(lang, 'iss.ramp.title'), detail: t(lang, 'iss.ramp.detail'), facts: [{ attr: 'ramp', value: 'yes', prov }] });
    }
  }
  prev = null;

  // ---------- 2. node-based attributes (kerbs, lifts) ----------
  const seenNodes = new Set<number>();
  const nearNodes: { n: OsmNode; at: number; d: number }[] = [];
  for (const s of samples) {
    for (const n of ds.nodes.near(s.pt.lat, s.pt.lon)) {
      if (seenNodes.has(n.id)) continue;
      const d = haversine(s.pt, n);
      if (d <= 25) { seenNodes.add(n.id); nearNodes.push({ n, at: s.at, d }); }
    }
  }
  // closest sample may be after the first within-radius sample; refine
  for (const e of nearNodes) {
    let best = Infinity;
    for (const s of samples) { if (Math.abs(s.at - e.at) > 40) continue; const d = haversine(s.pt, e.n); if (d < best) { best = d; e.d = d; e.at = s.at; } }
  }
  let kerbsKnownOk = 0, kerbsUnknown = 0;
  let firstUnknown: { at: number; pos: Pt } | null = null;
  const kerbNodes: { n: OsmNode; at: number; h: number | null }[] = [];
  for (const { n, at, d } of nearNodes) {
    const tg = n.tags;
    const isCrossing = tg.highway === 'crossing' || tg.barrier === 'kerb' || tg.kerb !== undefined;
    if (isCrossing && d <= 7) {
      const h = kerbHeightCm(tg);
      kerbNodes.push({ n, at, h });
      const prov = osmProv('node', n.id, tg, n.ts);
      if (h == null) {
        kerbsUnknown++;
        firstUnknown ??= { at, pos: n };
      } else if (h <= Math.max(prefs.maxKerbCm, 2) && (tg.kerb === 'flush' || tg.kerb === 'lowered' || h <= prefs.maxKerbCm)) {
        kerbsKnownOk++;
      } else {
        const over = h - prefs.maxKerbCm;
        issues.push({ id: nid(), type: 'kerb', severity: over >= 5 ? 'blocker' : 'warning', at, pos: n,
          title: t(lang, 'iss.kerb.title', { h: Math.round(h) }), detail: t(lang, 'iss.kerb.detail', { max: prefs.maxKerbCm }),
          facts: [{ attr: 'kerb', value: tg.kerb ?? `${h}cm`, prov }] });
      }
    }
    if (tg.highway === 'elevator' && d <= 15) {
      issues.push({ id: nid(), type: 'lift', severity: 'good', at, pos: n, title: t(lang, 'iss.lift.title'), detail: t(lang, 'iss.lift.detail'), facts: [{ attr: 'elevator', value: 'yes', prov: osmProv('node', n.id, tg, n.ts) }] });
    }
  }
  if (kerbsUnknown > 0) {
    issues.push({ id: nid(), type: 'kerb', severity: 'unknown', at: firstUnknown!.at, pos: firstUnknown!.pos, title: t(lang, 'iss.kerb.unknownTitle', { n: kerbsUnknown }), detail: t(lang, 'iss.kerb.unknownDetail'), facts: [] });
  }

  // ---------- 3. user reports ----------
  for (const rep of inp.reports) {
    // nearest sample
    let best: Sampled | null = null, bd = Infinity;
    for (const s of samples) { const d = haversine(s.pt, rep); if (d < bd) { bd = d; best = s; } }
    if (!best || bd > 14) continue;
    if (rep.type === 'fixed' || rep.type === 'no_bench') continue;
    const conf = reportConfidence(rep);
    const rf = reportFact(rep);
    // conflict: report says kerb is high but OSM says lowered/flush here
    const kn = kerbNodes.find((k) => haversine(k.n, rep) <= 15 && k.h != null && k.h <= 2);
    const hard = REPORT_BLOCKERS.has(rep.type) && conf !== 'unverified';
    const sev = hard ? 'blocker' : 'warning';
    if (rep.type === 'kerb_high' && kn) {
      // replace OSM-"ok" with a conflict issue
      issues.push({ id: nid(), type: 'kerb', severity: 'warning', at: best.at, pos: rep, conflict: true,
        title: t(lang, 'iss.conflict.title'), detail: t(lang, 'iss.conflict.detail'),
        facts: [{ attr: 'kerb', value: kn.n.tags.kerb ?? 'low', prov: osmProv('node', kn.n.id, kn.n.tags, kn.n.ts) }, rf] });
      kerbsKnownOk = Math.max(0, kerbsKnownOk - 1);
      continue;
    }
    issues.push({ id: nid(), type: 'report', severity: sev, at: best.at, pos: rep,
      title: t(lang, `rep.${rep.type}`) + (conf === 'unverified' ? ' · ' + t(lang, 'conf.unverifiedShort') : ''),
      detail: (rep.note ? `„${rep.note}” — ` : '') + t(lang, conf === 'unverified' ? 'iss.report.unverified' : 'iss.report.confirmed', { n: rep.clientIds.length }),
      facts: [rf] });
  }

  // ---------- 4. rest points & toilets ----------
  const rests: RouteResult['rests'] = [], toilets: RouteResult['toilets'] = [];
  for (const { n, at, d } of nearNodes) {
    if ((n.tags.amenity === 'bench' || n.tags.leisure === 'picnic_table') && d <= 25) rests.push({ pos: n, at, prov: osmProv('node', n.id, n.tags, n.ts) });
  }
  // toilets: wider radius
  const seenT = new Set<number>();
  for (const s of samples.filter((_, i) => i % 6 === 0)) {
    for (const n of ds.nodes.near(s.pt.lat, s.pt.lon)) {
      if (n.tags.amenity !== 'toilets' || seenT.has(n.id)) continue;
      if (haversine(s.pt, n) <= 150) { seenT.add(n.id); toilets.push({ pos: n, at: s.at, wheelchair: n.tags.wheelchair ?? 'unknown', prov: osmProv('node', n.id, n.tags, n.ts) }); }
    }
  }
  rests.sort((a, b) => a.at - b.at);
  const points = [0, ...rests.map((r) => r.at), total];
  let maxGap = 0, gapAt = 0;
  for (let i = 0; i < points.length - 1; i++) { const g = points[i + 1] - points[i]; if (g > maxGap) { maxGap = g; gapAt = points[i]; } }
  if (prefs.restEveryM > 0 && maxGap > prefs.restEveryM) {
    const sm = samples.reduce((b, s) => (Math.abs(s.at - (gapAt + maxGap / 2)) < Math.abs(b.at - (gapAt + maxGap / 2)) ? s : b), samples[0]);
    issues.push({ id: nid(), type: 'rest', severity: 'warning', at: sm.at, pos: sm.pt, title: t(lang, 'iss.rest.title', { m: Math.round(maxGap) }), detail: t(lang, 'iss.rest.detail', { max: prefs.restEveryM }), facts: [] });
  }

  // ---------- 5. data coverage: unknown stretches ----------
  const coverage = total > 0 ? Math.min(1, knownLen / total) : 0;
  const unknownLen = Math.max(0, total - knownLen);
  if (unknownLen >= 60 && total > 0) {
    issues.push({ id: nid(), type: 'nodata', severity: 'unknown', at: 0, pos: samples[0].pt, title: t(lang, 'iss.nodata.title', { m: Math.round(unknownLen) }), detail: t(lang, 'iss.nodata.detail'), facts: [] });
  }

  issues.sort((a, b) => a.at - b.at);

  // ---------- 6. score ----------
  const nBlock = issues.filter((i) => i.severity === 'blocker').length;
  const nKerb = issues.filter((i) => i.type === 'kerb' && i.severity === 'warning').length;
  const nOther = issues.filter((i) => i.severity === 'warning' && !['surface', 'kerb'].includes(i.type)).length;
  const share = total > 0 ? roughLen / total : 0;
  let penalty = Math.min(70, nBlock * 35)
    + Math.min(30, share * (prefs.surface === 'smooth' ? 45 : prefs.surface === 'moderate' ? 25 : 8))
    + Math.min(15, nKerb * 5) + Math.min(20, nOther * 6)
    + Math.min(8, kerbsUnknown * 0.7);
  penalty += (1 - coverage) * 15;
  const score = Math.max(0, Math.round(100 - penalty));
  const hasBlocker = issues.some((i) => i.severity === 'blocker');
  const kerbUnknownShare = kerbsUnknown / Math.max(1, kerbsUnknown + kerbsKnownOk);
  const verdict: RouteResult['verdict'] = hasBlocker ? 'blocked' : coverage < 0.4 ? 'unknown' : score >= 80 && coverage >= 0.6 && kerbUnknownShare <= 0.5 ? 'good' : 'caution';

  const speed = SPEED[prefs.preset];
  const duration = Math.round(inp.distance / speed + roughLen / speed * 0.4 + issues.filter((i) => i.type === 'kerb' && i.severity !== 'unknown').length * 20);

  return {
    id: inp.id, label: inp.label, geometry: inp.geometry, distance: Math.round(inp.distance), duration, score, verdict, issues, coverage,
    stats: { steps: stepsCount, kerbs: kerbsKnownOk, rough: Math.round(roughLen), unknown: kerbsUnknown, rests: rests.length, maxRestGap: Math.round(maxGap), toilets: toilets.length },
    rests, toilets: toilets.slice(0, 6),
  };
}

export { bboxOf };
