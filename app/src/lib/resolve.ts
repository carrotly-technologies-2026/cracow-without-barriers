import type { Confidence, Fact } from './types';

export interface Resolved {
  attr: string;
  /** 'conflict' when sources disagree; 'unknown' when no source – never treated as accessible */
  value: string;
  status: 'ok' | 'conflict' | 'unknown';
  facts: Fact[];
  confidence: Confidence;
}

const RANK: Record<Confidence, number> = { confirmed: 3, likely: 2, unverified: 1, unknown: 0 };

/** Group facts per attribute; flag disagreement between sources instead of silently choosing one. */
export function resolveFacts(attrs: string[], facts: Fact[]): Resolved[] {
  return attrs.map((attr) => {
    const fs = facts.filter((f) => f.attr === attr);
    if (!fs.length) return { attr, value: 'unknown', status: 'unknown', facts: [], confidence: 'unknown' };
    const values = new Set(fs.map((f) => f.value));
    const best = [...fs].sort((a, b) => RANK[b.prov.confidence] - RANK[a.prov.confidence])[0];
    return { attr, value: values.size > 1 ? 'conflict' : best.value, status: values.size > 1 ? 'conflict' : 'ok', facts: fs, confidence: values.size > 1 ? 'unverified' : best.prov.confidence };
  });
}
