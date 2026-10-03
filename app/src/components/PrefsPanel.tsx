'use client';
import { Accessibility, Baby, Zap, Footprints, SlidersHorizontal } from 'lucide-react';
import { PRESETS } from '@/lib/prefs';
import type { Prefs } from '@/lib/types';
import type { TFn } from '@/lib/client';

const ICON = { manual: Accessibility, electric: Zap, stroller: Baby, walker: Footprints, custom: SlidersHorizontal } as const;

export default function PrefsPanel({ prefs, onChange, t }: { prefs: Prefs; onChange: (p: Prefs) => void; t: TFn }) {
  const set = (patch: Partial<Prefs>) => onChange({ ...prefs, ...patch, preset: 'custom' });
  const sel = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm';
  return (
    <section aria-labelledby="prof-h" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h2 id="prof-h" className="text-base font-bold">{t('profile.title')}</h2>
      <p className="mt-0.5 text-xs text-slate-600">{t('profile.note')}</p>
      <div role="radiogroup" aria-labelledby="prof-h" className="mt-3 grid grid-cols-2 gap-2">
        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => {
          const I = ICON[k]; const on = prefs.preset === k;
          return (
            <button key={k} role="radio" aria-checked={on} type="button" onClick={() => onChange(PRESETS[k])}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${on ? 'border-brand-700 bg-brand-700 text-white shadow' : 'border-slate-300 bg-white text-slate-900 hover:border-brand-600'}`}>
              <I size={18} aria-hidden className="shrink-0" /><span>{t(`preset.${k}`)}</span>
            </button>
          );
        })}
      </div>
      <details className="mt-3 group" open={prefs.preset === 'custom'}>
        <summary className="cursor-pointer text-sm font-semibold text-brand-800">{t('prefs.customise')}</summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">{t('prefs.steps')}
            <select className={sel + ' mt-1 block w-full'} value={prefs.steps} onChange={(e) => set({ steps: e.target.value as any })}>
              <option value="avoid">{t('prefs.steps.avoid')}</option><option value="allow">{t('prefs.steps.allow')}</option></select></label>
          <label className="text-sm">{t('prefs.surface')}
            <select className={sel + ' mt-1 block w-full'} value={prefs.surface} onChange={(e) => set({ surface: e.target.value as any })}>
              {['smooth', 'moderate', 'any'].map((s) => <option key={s} value={s}>{t(`prefs.surface.${s}`)}</option>)}</select></label>
          <label className="text-sm">{t('prefs.kerb')}: <b>{prefs.maxKerbCm} cm</b>
            <input type="range" min={0} max={12} step={1} value={prefs.maxKerbCm} onChange={(e) => set({ maxKerbCm: +e.target.value })} className="mt-1 block w-full accent-brand-700" /></label>
          <label className="text-sm">{t('prefs.slope')}: <b>{prefs.maxSlopePct}%</b>
            <input type="range" min={3} max={15} step={1} value={prefs.maxSlopePct} onChange={(e) => set({ maxSlopePct: +e.target.value })} className="mt-1 block w-full accent-brand-700" /></label>
          <label className="text-sm">{t('prefs.width')}: <b>{prefs.minWidthM.toFixed(2)} m</b>
            <input type="range" min={0.6} max={1.2} step={0.05} value={prefs.minWidthM} onChange={(e) => set({ minWidthM: +e.target.value })} className="mt-1 block w-full accent-brand-700" /></label>
          <label className="text-sm">{t('prefs.rest')}: <b>{prefs.restEveryM ? `${prefs.restEveryM} m` : t('prefs.rest.off')}</b>
            <input type="range" min={0} max={600} step={50} value={prefs.restEveryM} onChange={(e) => set({ restEveryM: +e.target.value })} className="mt-1 block w-full accent-brand-700" /></label>
        </div>
      </details>
    </section>
  );
}
