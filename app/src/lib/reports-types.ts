// client-safe subset (reports.ts imports node:fs)
export const REPORT_TYPES = ['steps', 'kerb_high', 'blocked', 'rough', 'narrow', 'lift_broken', 'fixed'] as const;
