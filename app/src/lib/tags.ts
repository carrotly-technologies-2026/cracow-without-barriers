/** Interpretation of OSM tags relevant for wheeled mobility. Missing tag ⇒ 'unknown', never 'ok'. */
export type SurfaceClass = 'smooth' | 'moderate' | 'rough' | 'unknown';

const SMOOTH = new Set(['asphalt', 'concrete', 'paved', 'concrete:plates', 'paving_stones', 'metal', 'wood', 'tartan', 'rubber', 'concrete:lanes', 'bricks', 'brick']);
const MODERATE = new Set(['compacted', 'fine_gravel', 'cobblestone:flattened', 'paving_stones:lanes', 'grass_paver', 'clay', 'ground_compacted']);
const ROUGH = new Set(['sett', 'cobblestone', 'unhewn_cobblestone', 'gravel', 'pebblestone', 'dirt', 'earth', 'ground', 'sand', 'grass', 'mud', 'unpaved', 'woodchips', 'rock', 'stepping_stones']);

const SURFACE_PL: Record<string, string> = {
  sett: 'kostka brukowa', cobblestone: 'bruk (kocie łby)', unhewn_cobblestone: 'nieobrobiony bruk', 'cobblestone:flattened': 'bruk spłaszczony',
  asphalt: 'asfalt', concrete: 'beton', paving_stones: 'płyty chodnikowe', gravel: 'żwir', dirt: 'ziemia', sand: 'piasek', grass: 'trawa',
  compacted: 'ubita nawierzchnia', fine_gravel: 'drobny żwir', unpaved: 'nieutwardzona', paved: 'utwardzona', bricks: 'cegła/klinkier', brick: 'cegła/klinkier', ground: 'grunt', earth: 'grunt',
};
export const surfaceLabel = (s: string) => SURFACE_PL[s] ?? s;

export function classifySurface(tags: Record<string, string>): { cls: SurfaceClass; raw?: string } {
  const sm = tags['smoothness'];
  if (sm && ['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable'].includes(sm)) return { cls: 'rough', raw: `smoothness=${sm}` };
  const s = tags['surface'];
  if (!s) {
    if (sm === 'excellent' || sm === 'good') return { cls: 'smooth', raw: `smoothness=${sm}` };
    return { cls: 'unknown' };
  }
  if (ROUGH.has(s)) return { cls: 'rough', raw: s };
  if (MODERATE.has(s) || sm === 'intermediate') return { cls: 'moderate', raw: s };
  if (SMOOTH.has(s)) return { cls: 'smooth', raw: s };
  return { cls: 'unknown', raw: s };
}

export function parseIncline(tags: Record<string, string>): number | null {
  const v = tags['incline'];
  if (!v) return null;
  const m = v.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  if (m) return Math.abs(parseFloat(m[1].replace(',', '.')));
  const d = v.match(/(-?\d+(?:[.,]\d+)?)\s*°/);
  if (d) return Math.abs(Math.tan((parseFloat(d[1].replace(',', '.')) * Math.PI) / 180) * 100);
  return null;
}

export function parseMetres(v?: string): number | null {
  if (!v) return null;
  const m = v.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return /cm/.test(v) ? n / 100 : n;
}

/** kerb height in cm; null when unknown */
export function kerbHeightCm(tags: Record<string, string>): number | null {
  const k = tags['kerb'];
  if (k === 'flush' || k === 'lowered') return k === 'flush' ? 0 : 1;
  const h = parseMetres(tags['kerb:height'] ?? tags['height']);
  if (h != null && (tags['kerb:height'] || tags['barrier'] === 'kerb')) return h * 100;
  if (k === 'raised') return 6;
  if (k === 'rolled') return 3;
  return null;
}

export const isPedestrianWay = (t: Record<string, string>) => ['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'corridor', 'living_street', 'track'].includes(t.highway);
