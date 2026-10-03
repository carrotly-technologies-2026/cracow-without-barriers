'use client';
import { useEffect, useRef } from 'react';
import { Clock, Route as RouteIcon, Flag } from 'lucide-react';
import type { Issue, RouteResult } from '@/lib/types';
import type { Lang } from '@/lib/i18n';
import { fmtDist, fmtMin, type TFn } from '@/lib/client';
import { SEV_STYLE, TYPE_ICON } from './icons';
import { FactList, Provenance } from './Trust';

const VERDICT: Record<RouteResult['verdict'], string> = {
  good: 'bg-emerald-100 text-emerald-950 border-emerald-500', caution: 'bg-amber-100 text-amber-950 border-amber-500',
  blocked: 'bg-red-100 text-red-950 border-red-500', unknown: 'bg-zinc-100 text-zinc-900 border-zinc-400 border-dashed',
};

export function RouteCards({ routes, selectedId, onSelect, t }: { routes: RouteResult[]; selectedId: string | null; onSelect: (id: string) => void; t: TFn }) {
  return (
    <div role="radiogroup" aria-label={t('tab.route')} className="space-y-2">
      {routes.map((r) => {
        const on = r.id === selectedId;
        const blockers = r.issues.filter((i) => i.severity === 'blocker').length, warns = r.issues.filter((i) => i.severity === 'warning').length;
        return (
          <button key={r.id} role="radio" aria-checked={on} type="button" onClick={() => onSelect(r.id)}
            className={`w-full rounded-2xl border p-3 text-left transition ${on ? 'border-brand-700 bg-white shadow-md ring-2 ring-brand-600' : 'border-slate-200 bg-white hover:border-brand-500'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold">{r.label}</div>
                <div className="mt-0.5 flex items-center gap-3 text-sm text-slate-700"><span className="inline-flex items-center gap-1"><RouteIcon size={14} aria-hidden />{fmtDist(r.distance)}</span><span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden />{fmtMin(r.duration)} {t('route.min')}</span></div>
              </div>
              <div className="text-center"><div className="text-2xl font-extrabold leading-none" aria-label={r.verdict === 'unknown' ? t('verdict.unknown') : undefined}>{r.verdict === 'unknown' ? '?' : r.score}</div><div className="text-[10px] uppercase tracking-wide text-slate-600">{t('route.score')}</div></div>
            </div>
            <div className={`mt-2 inline-block rounded-lg border px-2 py-1 text-xs font-semibold ${VERDICT[r.verdict]}`}>{t(`verdict.${r.verdict}`)}</div>
            <div className="mt-1.5 text-xs text-slate-700">
              {blockers > 0 && <span className="mr-2 font-semibold text-red-800">{blockers}× {t('sev.blocker').toLowerCase()}</span>}
              {warns > 0 && <span className="mr-2 font-semibold text-amber-900">{warns}× {t('sev.warning').toLowerCase()}</span>}
              <span>{t('route.coverage')}: {Math.round(r.coverage * 100)}%</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function RouteDetail({ route, selectedIssueId, onSelectIssue, onReport, t, lang }: { route: RouteResult; selectedIssueId: string | null; onSelectIssue: (i: Issue) => void; onReport: (i: Issue) => void; t: TFn; lang: Lang }) {
  const refs = useRef<Record<string, HTMLLIElement | null>>({});
  useEffect(() => { if (selectedIssueId) refs.current[selectedIssueId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [selectedIssueId]);
  const s = route.stats;
  const pct = Math.round(route.coverage * 100);
  const stat = (n: number | string, label: string) => <div className="rounded-xl bg-slate-50 p-2 text-center ring-1 ring-black/5"><div className="text-lg font-bold">{n}</div><div className="text-[11px] leading-tight text-slate-700">{label}</div></div>;
  return (
    <section aria-labelledby="tl-h" className="space-y-3">
      <div className={`rounded-xl border p-3 text-sm ${VERDICT[route.verdict]}`}>
        <b>{t(`verdict.${route.verdict}`)}</b>{route.verdict === 'good' && <span> — {t('verdict.goodNote')}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stat(s.steps, t('route.steps'))}{stat(s.kerbs, t('route.kerbsOk'))}{stat(s.rough, t('route.rough'))}
        {stat(s.rests, t('route.rests'))}{stat(s.maxRestGap, t('route.maxGap') + ' (m)')}{stat(s.toilets, t('route.toilets'))}
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs font-semibold"><span>{t('route.coverage')}</span><span>{pct}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200" role="img" aria-label={`${t('route.coverage')}: ${pct}%`}><div className="h-full bg-brand-600" style={{ width: pct + '%' }} /></div>
        <p className="mt-1 text-xs text-slate-700">{t('route.coverageNote')}</p>
      </div>
      <h3 id="tl-h" className="pt-1 text-base font-bold">{t('route.timeline')}</h3>
      <p className="-mt-2 text-xs text-slate-600">{t('route.timelineNote')}</p>
      {route.issues.length === 0 && <p className="rounded-xl bg-zinc-100 p-3 text-sm">{t('route.noIssues')}</p>}
      <ol className="space-y-2">
        <li className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Flag size={14} aria-hidden /> A · 0 m</li>
        {route.issues.map((i) => {
          const st = SEV_STYLE[i.severity], Icon = TYPE_ICON[i.type], SIcon = st.Icon, sel = i.id === selectedIssueId;
          return (
            <li key={i.id} ref={(el) => { refs.current[i.id] = el; }} className={`rounded-xl border-l-4 bg-white p-3 shadow-sm ring-1 ring-black/5 ${st.ring} ${sel ? 'outline outline-2 outline-blue-700' : ''}`}>
              <button type="button" onClick={() => onSelectIssue(i)} aria-label={`${i.title}, ${t(`sev.${i.severity}`)}, ${t('route.at', { m: Math.round(i.at) })}`} className="flex w-full items-start gap-2 text-left">
                <Icon size={20} aria-hidden className="mt-0.5 shrink-0 text-slate-700" />
                <span className="flex-1">
                  <span className="block text-sm font-bold">{i.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${st.chip}`}><SIcon size={12} aria-hidden />{t(`sev.${i.severity}`)}</span>
                    {i.conflict && <span className="rounded-full border border-fuchsia-500 bg-fuchsia-50 px-2 py-0.5 font-semibold text-fuchsia-900">≠ {t('iss.conflict.title')}</span>}
                    <span className="text-slate-600">{t('route.at', { m: Math.round(i.at) })}</span>
                  </span>
                </span>
              </button>
              <p className="mt-1.5 text-sm text-slate-800">{i.detail}</p>
              {i.facts.length > 0 ? (
                <details className="mt-1.5" open={sel || i.conflict}><summary className="cursor-pointer text-xs font-semibold text-brand-800">{t('details')} · {t('prov.source')}</summary>
                  <FactList facts={i.facts} t={t} lang={lang} /></details>
              ) : (
                i.severity !== 'good' && <div className="mt-1.5"><Provenance prov={{ source: 'osm', ref: '', confidence: 'unknown' }} t={t} lang={lang} /></div>
              )}
              <button type="button" onClick={() => onReport(i)} className="mt-2 text-xs font-semibold text-brand-800 underline underline-offset-2">{t('report.outdated')} / {t('report.title').toLowerCase()}</button>
            </li>
          );
        })}
        <li className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Flag size={14} aria-hidden /> B · {fmtDist(route.distance)}</li>
      </ol>
      {route.toilets.length > 0 && (
        <div><h3 className="text-base font-bold">{t('route.toilets')}</h3>
          <ul className="mt-1 space-y-1.5">{route.toilets.map((x, i) => (
            <li key={i} className="rounded-lg bg-white p-2 text-sm ring-1 ring-black/5">{t('feat.toilets')} — {t(`wc.${['yes', 'limited', 'no', 'designated'].includes(x.wheelchair) ? x.wheelchair : 'unknown'}`)} ({t('route.at', { m: Math.round(x.at) })})
              <Provenance prov={x.prov} t={t} lang={lang} /></li>))}</ul></div>
      )}
    </section>
  );
}
