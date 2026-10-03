import type { Prefs } from './types';

// Presets are only *preference bundles about barriers* – the app never asks about disability.
export const PRESETS: Record<Exclude<Prefs['preset'], 'custom'>, Prefs> = {
  manual:   { preset: 'manual',   steps: 'avoid', maxKerbCm: 2, surface: 'smooth',   maxSlopePct: 6,  minWidthM: 0.9, restEveryM: 0 },
  electric: { preset: 'electric', steps: 'avoid', maxKerbCm: 5, surface: 'moderate', maxSlopePct: 8,  minWidthM: 0.9, restEveryM: 0 },
  stroller: { preset: 'stroller', steps: 'avoid', maxKerbCm: 3, surface: 'moderate', maxSlopePct: 8,  minWidthM: 0.8, restEveryM: 0 },
  walker:   { preset: 'walker',   steps: 'avoid', maxKerbCm: 5, surface: 'moderate', maxSlopePct: 6,  minWidthM: 0.8, restEveryM: 250 },
};
export const DEFAULT_PREFS = PRESETS.manual;
export const SPEED: Record<Prefs['preset'], number> = { manual: 1.0, electric: 1.4, stroller: 1.2, walker: 0.8, custom: 1.1 }; // m/s on good surface
