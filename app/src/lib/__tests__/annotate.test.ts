import { describe, it, expect } from 'vitest';
import { annotate, buildDataset } from '../annotate';
import { PRESETS } from '../prefs';
import type { OsmNode, OsmWay } from '../osm';
import type { Report } from '../reports';

// straight 200 m line going north from (50.06, 19.94)
const line: [number, number][] = [[19.94, 50.06], [19.94, 50.0618]];
const way = (id: number, tags: Record<string, string>, geom?: [number, number][]): OsmWay => ({ type: 'way', id, tags, ts: '2025-06-01T00:00:00Z', geom: geom ?? [[50.06, 19.94], [50.0618, 19.94]] });
const run = (ways: OsmWay[], nodes: OsmNode[] = [], reports: Report[] = [], prefs = PRESETS.manual) => {
  const region = { ways, nodes, state: 'ok' as const, missingTiles: 0 };
  return annotate({ id: 'r', label: '', geometry: line, distance: 200, duration: 200, prefs, lang: 'pl', region, ds: buildDataset(region), reports });
};

describe('annotate', () => {
  it('treats steps as a blocker for step-avoiding profiles', () => {
    const r = run([way(1, { highway: 'steps', step_count: '12' })]);
    expect(r.verdict).toBe('blocked');
    expect(r.issues.some((i) => i.type === 'steps' && i.severity === 'blocker')).toBe(true);
  });
  it('flags cobblestones as a warning for "smooth" profile but not as blocker', () => {
    const r = run([way(1, { highway: 'footway', surface: 'sett' })]);
    expect(r.issues.some((i) => i.type === 'surface' && i.severity === 'warning')).toBe(true);
    expect(r.verdict).not.toBe('blocked');
  });
  it('never reports missing data as accessible', () => {
    const r = run([way(1, { highway: 'footway' })]); // no surface tag
    expect(r.coverage).toBe(0);
    expect(r.verdict).toBe('unknown');
    expect(r.issues.some((i) => i.type === 'nodata')).toBe(true);
  });
  it('smooth fully-known route is good', () => {
    const r = run([way(1, { highway: 'footway', surface: 'asphalt' })]);
    expect(r.verdict).toBe('good');
    expect(r.coverage).toBeGreaterThan(0.9);
  });
  it('marks single-user reports as unverified and conflicting with OSM kerb data', () => {
    const kerb: OsmNode = { type: 'node', id: 5, lat: 50.061, lon: 19.94, tags: { highway: 'crossing', kerb: 'lowered' }, ts: '2025-01-01T00:00:00Z' };
    const rep: Report = { id: 'x', lat: 50.061, lon: 19.94, type: 'kerb_high', createdAt: '2026-01-01T00:00:00Z', clientIds: ['a'] };
    const r = run([way(1, { highway: 'footway', surface: 'asphalt' })], [kerb], [rep]);
    const c = r.issues.find((i) => i.conflict);
    expect(c).toBeTruthy();
    expect(c!.facts.map((f) => f.prov.source).sort()).toEqual(['osm', 'user']);
    expect(c!.facts.find((f) => f.prov.source === 'user')!.prov.confidence).toBe('unverified');
  });
  it('warns about missing rest points when profile needs them', () => {
    const r = run([way(1, { highway: 'footway', surface: 'asphalt' })], [], [], { ...PRESETS.walker, restEveryM: 100 });
    expect(r.issues.some((i) => i.type === 'rest')).toBe(true);
  });
  it('counts unknown kerbs separately from lowered ones', () => {
    const nodes: OsmNode[] = [
      { type: 'node', id: 7, lat: 50.061, lon: 19.94, tags: { highway: 'crossing' } },
      { type: 'node', id: 8, lat: 50.0615, lon: 19.94, tags: { highway: 'crossing', kerb: 'flush' } },
    ];
    const r = run([way(1, { highway: 'footway', surface: 'asphalt' })], nodes);
    expect(r.stats.unknown).toBe(1);
    expect(r.stats.kerbs).toBe(1);
  });
});
