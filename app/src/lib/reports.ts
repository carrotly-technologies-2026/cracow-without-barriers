import fs from 'node:fs/promises';
import path from 'node:path';
import type { Confidence, Fact, Provenance } from './types';

export type ReportType = 'steps' | 'kerb_high' | 'blocked' | 'rough' | 'narrow' | 'lift_broken' | 'no_bench' | 'fixed';
export const REPORT_TYPES: ReportType[] = ['steps', 'kerb_high', 'blocked', 'rough', 'narrow', 'lift_broken', 'fixed'];

export interface Report {
  id: string;
  lat: number;
  lon: number;
  type: ReportType;
  note?: string;
  createdAt: string;
  clientIds: string[]; // anonymous random ids that reported / confirmed (no accounts, no personal data)
  sample?: boolean;
}

const FILE = process.env.REPORTS_FILE ?? path.join(process.cwd(), 'data', 'reports.json');
const SEED_FILE = path.join(process.cwd(), 'data', 'sample-reports.json');
let writing: Promise<unknown> = Promise.resolve();

export async function listReports(): Promise<Report[]> {
  let seed: Report[] = [];
  let user: Report[] = [];
  try { seed = JSON.parse(await fs.readFile(SEED_FILE, 'utf8')); } catch { /* none */ }
  try { user = JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { /* none */ }
  return [...seed, ...user];
}

async function saveUser(mutate: (list: Report[]) => Report[]) {
  writing = writing.then(async () => {
    let user: Report[] = [];
    try { user = JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { /* new */ }
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(mutate(user), null, 2));
  });
  return writing;
}

const hits = new Map<string, number[]>();
export function rateLimited(clientId: string, max = 10, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(clientId) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(clientId, arr);
  return arr.length > max;
}

export async function addReport(input: { lat: number; lon: number; type: ReportType; note?: string; clientId: string }): Promise<Report> {
  const r: Report = {
    id: 'r_' + Math.random().toString(36).slice(2, 10),
    lat: input.lat, lon: input.lon, type: input.type,
    note: input.note?.slice(0, 280),
    createdAt: new Date().toISOString(),
    clientIds: [input.clientId],
  };
  await saveUser((l) => [...l, r]);
  return r;
}

export async function confirmReport(id: string, clientId: string): Promise<Report | null> {
  let found: Report | null = null;
  await saveUser((l) => l.map((r) => { if (r.id === id) { if (!r.clientIds.includes(clientId)) r.clientIds.push(clientId); found = r; } return r; }));
  return found;
}

/** Trust model: 1 reporter = unverified; ≥2 independent anonymous reporters = likely (community-confirmed). Never "confirmed". */
export function reportConfidence(r: Report): Confidence {
  return r.clientIds.length >= 2 ? 'likely' : 'unverified';
}

export function reportProv(r: Report): Provenance {
  return { source: r.sample ? 'sample' : 'user', ref: `${r.sample ? 'Dane przykładowe' : 'Zgłoszenie użytkownika'} ${r.id} (${r.clientIds.length}×)`, updated: r.createdAt, confidence: reportConfidence(r), freshnessBasis: r.sample ? 'sample' : 'report' };
}

export function reportFact(r: Report): Fact {
  return { attr: 'report:' + r.type, value: r.note ?? r.type, prov: reportProv(r) };
}
