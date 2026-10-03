export type SourceKind = 'osm' | 'owner' | 'user' | 'sample';
export type Confidence = 'confirmed' | 'likely' | 'unverified' | 'unknown';
export type Severity = 'blocker' | 'warning' | 'info' | 'unknown' | 'good';
export type IssueType = 'steps' | 'kerb' | 'surface' | 'slope' | 'width' | 'lift' | 'ramp' | 'rest' | 'toilet' | 'crossing' | 'report' | 'nodata';

export interface Provenance {
  source: SourceKind;
  /** human readable reference, e.g. "OSM node 123" */
  ref: string;
  url?: string;
  /** ISO date of last edit / confirmation */
  updated?: string;
  confidence: Confidence;
  /** where freshness comes from, e.g. check_date tag, last OSM edit */
  freshnessBasis?: 'check_date' | 'osm_edit' | 'report' | 'owner_declaration' | 'sample';
}

export interface Fact {
  attr: string; // e.g. "kerb", "surface", "wheelchair"
  value: string;
  prov: Provenance;
}

export interface Pt { lat: number; lon: number }

export interface Prefs {
  preset: 'manual' | 'electric' | 'stroller' | 'walker' | 'custom';
  steps: 'avoid' | 'allow'; // avoid = hard block
  maxKerbCm: number; // 0 = only flush/lowered
  surface: 'smooth' | 'moderate' | 'any'; // smooth = avoid cobbles
  maxSlopePct: number;
  minWidthM: number;
  restEveryM: number; // 0 = don't care
}

export interface Issue {
  id: string;
  type: IssueType;
  severity: Severity;
  at: number; // metres along route
  length?: number; // metres affected (segments)
  pos: Pt;
  title: string;
  detail: string;
  facts: Fact[];
  conflict?: boolean;
}

export interface RouteResult {
  id: string;
  label: string;
  geometry: [number, number][]; // [lon, lat]
  distance: number;
  duration: number;
  score: number; // 0-100
  verdict: 'good' | 'caution' | 'blocked' | 'unknown';
  issues: Issue[];
  coverage: number; // 0..1 share of route with known surface data
  stats: { steps: number; kerbs: number; rough: number; unknown: number; rests: number; maxRestGap: number; toilets: number };
  rests: { pos: Pt; at: number; prov: Provenance }[];
  toilets: { pos: Pt; at: number; wheelchair: string; prov: Provenance }[];
}

export interface DataStatus {
  osm: 'ok' | 'cache' | 'unavailable';
  router: 'ok' | 'unavailable';
  fetchedAt?: string;
  notes: string[];
}
