'use client';
import { CircleHelp, TriangleAlert, X, Route as RouteIcon, ThumbsUp } from 'lucide-react';
import type { Lang } from '@/lib/i18n';
import { clientId, fmtDate, type TFn } from '@/lib/client';
import type { DataStatus } from '@/lib/types';
import { ConfBadge, FactList, Provenance } from './Trust';
import type { Layers, MapFeature } from './MapView';

export function StatusBanner({ status, t, lang }: { status: DataStatus | null; t: TFn; lang: Lang }) {
  if (!status || (status.osm === 'ok' && status.router === 'ok')) return null;
  const bad = status.osm === 'unavailable';
  return (
    <div role="status" className={`flex gap-2 rounded-xl border p-3 text-sm ${bad ? 'border-red-400 bg-red-50 text-red-950' : 'border-amber-400 bg-amber-50 text-amber-950'}`}>
      <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div><b>{t(`status.osm.${status.osm}`)}</b>{status.fetchedAt && <div className="text-xs">{t('status.fetched', { d: fmtDate(status.fetchedAt, lang) })}</div>}</div>
    </div>
  );
}

const WC_KEYS = ['yes', 'limited', 'no', 'designated'];
export function PlaceCard({ place, onClose, onRoute, t, lang }: { place: any; onClose: () => void; onRoute: () => void; t: TFn; lang: Lang }) {
  const labels: Record<string, string> = { wheelchair: t('place.title'), entrance_step: t('place.step'), door_width: t('place.door'), automatic_door: t('place.automatic'), lift: t('place.lift'), toilet: t('feat.toilets') };
  const show = (r: any) => {
    if (r.status === 'conflict') return t('place.conflict');
    if (r.value === 'unknown') return t('wc.unknown');
    if (r.attr === 'wheelchair') return t(`wc.${WC_KEYS.includes(r.value) ? r.value : 'unknown'}`);
    if (r.attr === 'door_width') return `${r.value} m`;
    return r.value === 'yes' ? (lang === 'pl' ? 'tak' : 'yes') : r.value === 'no' ? (lang === 'pl' ? 'nie' : 'no') : r.value;
  };
  return (
    <section aria-labelledby="pl-h" className="rounded-2xl bg-white p-4 shadow-md ring-1 ring-black/10">
      <div className="flex items-start justify-between gap-2">
        <div><h2 id="pl-h" className="text-lg font-bold">{place.name || '—'}</h2>
          {place.sample && <span className="mt-1 inline-block rounded bg-fuchsia-100 px-2 py-0.5 text-xs font-bold text-fuchsia-900">{t('src.sample')}</span>}</div>
        <button type="button" aria-label={t('place.close')} onClick={onClose} className="rounded-full p-1 hover:bg-slate-100"><X /></button>
      </div>
      {place.osm !== 'ok' && <p role="status" className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-950">{t(`status.osm.${place.osm}`)}</p>}
      {!place.hasData && <p className="mt-2 flex gap-2 rounded-lg bg-zinc-100 p-2 text-sm"><CircleHelp size={18} aria-hidden className="shrink-0" />{t('place.noData')}</p>}
      <dl className="mt-3 space-y-2">
        {place.resolved.map((r: any) => (
          <div key={r.attr} className={`rounded-xl border p-2.5 ${r.status === 'conflict' ? 'border-fuchsia-500 bg-fuchsia-50' : r.status === 'unknown' ? 'border-dashed border-zinc-400 bg-zinc-50' : 'border-slate-200'}`}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{labels[r.attr]}</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold">{show(r)} <ConfBadge c={r.confidence} t={t} /></dd>
            {r.facts.length > 0 && <details className="mt-1" open={r.status === 'conflict'}><summary className="cursor-pointer text-xs font-semibold text-brand-800">{t('prov.source')}</summary><FactList facts={r.facts} t={t} lang={lang} /></details>}
          </div>
        ))}
      </dl>
      {place.toilets?.length > 0 && <div className="mt-3"><h3 className="text-sm font-bold">{t('place.toilet')}</h3>
        {place.toilets.map((x: any, i: number) => <div key={i} className="mt-1 rounded-lg bg-slate-50 p-2 text-sm">{x.dist} m — {t(`wc.${WC_KEYS.includes(x.wheelchair) ? x.wheelchair : 'unknown'}`)}<Provenance prov={x.prov} t={t} lang={lang} /></div>)}</div>}
      <button type="button" onClick={onRoute} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-2.5 font-semibold text-white hover:bg-brand-800"><RouteIcon size={18} aria-hidden />{t('place.route')}</button>
    </section>
  );
}

const LAYER_KEYS: (keyof Layers)[] = ['bench', 'toilets', 'steps', 'kerb', 'reports'];
const LAYER_COLOR: Record<string, string> = { bench: '#0f766e', toilets: '#1d4ed8', steps: '#b91c1c', kerb: '#7c3aed', reports: '#c2410c' };
export function ExplorePanel({ layers, onLayers, features, zoom, selected, onSelect, onConfirm, t, lang }: { layers: Layers; onLayers: (l: Layers) => void; features: MapFeature[]; zoom: number; selected: MapFeature | null; onSelect: (f: MapFeature) => void; onConfirm: (id: string) => void; t: TFn; lang: Lang }) {
  const visible = features.filter((f) => (f.kind === 'elevator' ? true : (layers as any)[f.kind === 'report' ? 'reports' : f.kind]));
  return (
    <div className="space-y-3">
      <fieldset className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><legend className="px-1 text-base font-bold">{t('explore.layers')}</legend>
        <div className="mt-1 grid grid-cols-1 gap-1.5">
          {LAYER_KEYS.map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={layers[k]} onChange={(e) => onLayers({ ...layers, [k]: e.target.checked })} className="size-4 accent-brand-700" />
              <span className="inline-block size-3 rounded-full ring-2 ring-white" style={{ background: LAYER_COLOR[k], outline: '1px solid #333' }} aria-hidden />{t(k === 'bench' ? 'explore.benches' : k === 'kerb' ? 'explore.kerbs' : `explore.${k}`)}</label>))}
        </div>
        {zoom < 15 && <p className="mt-2 text-xs text-amber-900">{t('explore.zoom')}</p>}
      </fieldset>
      {selected && <FeatureCard f={selected} t={t} lang={lang} onConfirm={onConfirm} />}
      <section aria-labelledby="fl-h"><h3 id="fl-h" className="mb-1 text-sm font-bold">{t('explore.list')} ({visible.length})</h3>
        {visible.length === 0 ? <p className="text-sm text-slate-600">{t('explore.none')}</p> : (
          <ul className="max-h-72 space-y-1 overflow-auto sheet-scroll">{visible.slice(0, 60).map((f, i) => (
            <li key={i}><button type="button" onClick={() => onSelect(f)} className="w-full rounded-lg bg-white px-3 py-2 text-left text-sm ring-1 ring-black/5 hover:bg-brand-50">
              <b>{f.kind === 'report' ? t(`rep.${f.report?.type}`) : t(`feat.${f.kind}`)}</b>{f.label && f.label !== 'unknown' && f.kind !== 'report' ? ` · ${f.kind === 'toilets' ? t(`wc.${WC_KEYS.includes(f.label) ? f.label : 'unknown'}`) : f.label}` : ''} <span className="text-xs text-slate-600">({f.lat.toFixed(4)}, {f.lon.toFixed(4)})</span></button></li>))}</ul>)}
      </section>
    </div>
  );
}

export function FeatureCard({ f, t, lang, onConfirm }: { f: MapFeature; t: TFn; lang: Lang; onConfirm: (id: string) => void }) {
  const isReport = f.kind === 'report';
  return (
    <section className="rounded-2xl border border-brand-300 bg-white p-3 shadow-sm" aria-live="polite">
      <h3 className="font-bold">{isReport ? t(`rep.${f.report.type}`) : t(`feat.${f.kind}`)}</h3>
      {isReport && f.report.note && <p className="mt-1 text-sm">„{f.report.note}”</p>}
      {!isReport && f.kind === 'toilets' && <p className="text-sm">{t(`wc.${WC_KEYS.includes(f.label) ? f.label : 'unknown'}`)}</p>}
      {Object.keys(f.tags ?? {}).length > 0 && <p className="mt-1 text-xs text-slate-700">{Object.entries(f.tags).map(([k, v]) => `${k}=${v}`).join(' · ')}</p>}
      <div className="mt-2"><Provenance prov={f.prov} t={t} lang={lang} /></div>
      {isReport && !f.report.sample && <button type="button" onClick={() => onConfirm(f.report.id)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-brand-700 px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"><ThumbsUp size={14} aria-hidden />{t('report.confirm')}</button>}
    </section>
  );
}

export function AboutPanel({ t, lang, status }: { t: TFn; lang: Lang; status: DataStatus | null }) {
  return (
    <div className="space-y-4 text-sm">
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><h2 className="text-base font-bold">{t('about.how')}</h2>
        <ul className="mt-2 space-y-2">{(['confirmed', 'likely', 'unverified', 'unknown'] as const).map((c) => <li key={c} className="flex items-start gap-2"><ConfBadge c={c} t={t} /><span className="text-slate-700">{t(`conf.${c}.d`)}</span></li>)}</ul></section>
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><h2 className="text-base font-bold">{t('about.sources')}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-800">
          <li><b>OpenStreetMap</b> (ODbL) – kerb, surface, steps, benches, toilets, entrances</li>
          <li><b>OSRM</b> (BSD-2) – pedestrian geometry; <b>Photon/Komoot</b> – geocoding</li>
          <li>{lang === 'pl' ? 'Zgłoszenia użytkowników (anonimowe, niezweryfikowane do potwierdzenia przez 2. osobę)' : 'User reports (anonymous, unverified until a 2nd person confirms)'}</li>
          <li>{lang === 'pl' ? 'Deklaracje właścicieli obiektów (planowane – w demo: DANE PRZYKŁADOWE)' : 'Venue-owner declarations (planned – in the demo: SAMPLE DATA)'}</li>
          <li>dane.gov.pl / otwartedane.krakow.pl / GTFS ZTP – {lang === 'pl' ? 'adaptery planowane (przystanki, windy, tramwaje niskopodłogowe)' : 'adapters planned (stops, lifts, low-floor trams)'}</li></ul>
        <p className="mt-2 text-xs text-slate-600">{t('about.osmAttr')}</p></section>
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><h2 className="text-base font-bold">{t('status.title')}</h2>
        <p className="mt-1">{status ? t(`status.osm.${status.osm}`) : '—'}{status?.fetchedAt ? ` · ${t('status.fetched', { d: fmtDate(status.fetchedAt, lang) })}` : ''}</p></section>
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><h2 className="text-base font-bold">{t('about.limits')}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">{t('about.limitsList').split('|').map((x, i) => <li key={i}>{x}</li>)}</ul></section>
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><h2 className="text-base font-bold">{t('about.privacy')}</h2><p className="mt-1">{t('about.privacyText')}</p></section>
    </div>
  );
}
