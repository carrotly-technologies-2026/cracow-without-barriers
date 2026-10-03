'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Lang } from './i18n';
import { t as tr } from './i18n';
import { DEFAULT_PREFS } from './prefs';
import type { Prefs } from './types';

export interface PlaceRef { name: string; sub?: string; lat: number; lon: number; osm?: string | null; sample?: string }

export function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } }

export function clientId(): string {
  let id = load<string>('kbb.cid', '');
  if (!id) { id = crypto.randomUUID(); save('kbb.cid', id); }
  return id;
}

export function useStored<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  useEffect(() => { setV(load(key, initial)); /* eslint-disable-next-line */ }, [key]);
  const set = useCallback((n: T) => { setV(n); save(key, n); }, [key]);
  return [v, set];
}

export const useTr = (lang: Lang) => useCallback((k: string, p?: Record<string, string | number>) => tr(lang, k, p), [lang]);
export type TFn = (k: string, p?: Record<string, string | number>) => string;
export { DEFAULT_PREFS };
export type { Prefs };

export function fmtDate(iso: string | undefined, lang: Lang) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}
export const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
export const fmtMin = (s: number) => Math.max(1, Math.round(s / 60));
