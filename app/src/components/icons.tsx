import { CircleCheck, CircleHelp, OctagonX, TriangleAlert, Info, ArrowUpDown, Footprints, Armchair, Bath, Waves, Accessibility, MessageSquareWarning, ChevronsUp, MoveHorizontal, Mountain, Database } from 'lucide-react';
import type { IssueType, Severity } from '@/lib/types';

export const SEV_STYLE: Record<Severity, { chip: string; ring: string; hex: string; Icon: typeof Info }> = {
  blocker: { chip: 'bg-red-50 text-red-900 border-red-300', ring: 'border-l-red-600', hex: '#b91c1c', Icon: OctagonX },
  warning: { chip: 'bg-amber-50 text-amber-950 border-amber-400', ring: 'border-l-amber-500', hex: '#b45309', Icon: TriangleAlert },
  info: { chip: 'bg-slate-50 text-slate-800 border-slate-300', ring: 'border-l-slate-400', hex: '#475569', Icon: Info },
  unknown: { chip: 'bg-zinc-100 text-zinc-800 border-zinc-400 border-dashed', ring: 'border-l-zinc-400', hex: '#52525b', Icon: CircleHelp },
  good: { chip: 'bg-emerald-50 text-emerald-900 border-emerald-300', ring: 'border-l-emerald-600', hex: '#047857', Icon: CircleCheck },
};

export const TYPE_ICON: Record<IssueType, typeof Info> = {
  steps: Footprints, kerb: ArrowUpDown, surface: Waves, slope: Mountain, width: MoveHorizontal, lift: ChevronsUp, ramp: Accessibility,
  rest: Armchair, toilet: Bath, crossing: ArrowUpDown, report: MessageSquareWarning, nodata: Database,
};
