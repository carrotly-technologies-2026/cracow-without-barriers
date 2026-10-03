'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Accessibility, ArrowDownUp, Languages, Loader2, Map as MapIcon, Info, Navigation, Sparkles, Megaphone } from 'lucide-react';
import { CITIES, DEFAULT_CITY } from '@/lib/cities';
import { DEFAULT_PREFS, clientId, useStored, useTr, type PlaceRef } from '@/lib/client';
import type { Lang } from '@/lib/i18n';
import type { DataStatus, Issue, Prefs, RouteResult } from '@/lib/types';
import PlaceSearch from './PlaceSearch';
import PrefsPanel from './PrefsPanel';
import { RouteCards, RouteDetail } from './RouteView';
import ReportDialog, { type ReportTarget } from './ReportDialog';
import { AboutPanel, ExplorePanel, FeatureCard, PlaceCard, StatusBanner } from './Panels';
import type { Layers, MapFeature } from './MapView';

const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-brand-50" /> });

type Tab = 'route' | 'explore' | 'about';
const DEMO_FROM: PlaceRef = { name: 'Galeria Krakowska', lat: 50.0664, lon: 19.9457 };
const DEMO_TO: PlaceRef = { name: 'Plac Nowy (Kazimierz)', lat: 50.0512, lon: 19.9449 };

export default function App() {
  const [lang, setLang] = useStored<Lang>('kbb.lang', 'pl');
  const t = useTr(lang);
  const [cityId, setCityId] = useStored('kbb.city', DEFAULT_CITY.id);
  const city = CITIES.find((c) => c.id === cityId) ?? DEFAULT_CITY;
  const [prefs, setPrefs] = useStored<Prefs>('kbb.prefs', DEFAULT_PREFS);
  const [tab, setTab] = useState<Tab>('route');
  const [from, setFrom] = useState<PlaceRef | null>(null);
  const [to, setTo] = useState<PlaceRef | null>(null);
  const [pick, setPick] = useState<null | 'from' | 'to' | 'report'>(null);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [issueId, setIssueId] = useState<string | null>(null);
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; k: number } | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [place, setPlace] = useState<any | null>(null);
  const [layers, setLayers] = useState<Layers>({ bench: true, toilets: true, steps: true, kerb: false, reports: true });
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [selFeature, setSelFeature] = useState<MapFeature | null>(null);
  const [zoom, setZoom] = useState(city.zoom);
  const [samples, setSamples] = useState<{ id: string; name: string; lat: number; lon: number }[]>([]);
  const viewport = useRef<[number, number, number, number] | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { fetch('/api/geocode?q=demo').then((r) => r.json()).then((j) => setSamples((j.results ?? []).filter((x: any) => x.sample).map((x: any) => ({ id: x.sample, name: x.name, lat: x.lat, lon: x.lon })))).catch(() => {}); }, []);

  const selected = routes.find((r) => r.id === selId) ?? null;

  const search = useCallback(async (f = from, to_ = to, p = prefs) => {
    if (!f || !to_) return;
    setLoading(true); setError(null); setPlace(null);
    try {
      const res = await fetch('/api/route', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from: f, to: to_, prefs: p, lang }) });
      const j = await res.json();
      if (!res.ok) { setError(j.error === 'router_unavailable' ? t('route.errorRouter') : t('route.error')); setRoutes([]); return; }
      setRoutes(j.routes); setStatus(j.status); setBlockedOnly(j.blockedOnly); setSelId(j.routes[0]?.id ?? null); setIssueId(null); setFitKey((k) => k + 1);
      setTimeout(() => resultsRef.current?.focus(), 50);
      if (liveRef.current) liveRef.current.textContent = `${j.routes.length} ${t('tab.route').toLowerCase()}`;
    } catch { setError(t('route.errorRouter')); }
    finally { setLoading(false); }
  }, [from, to, prefs, lang, t]);

  // re-run when preferences change and a route is shown
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (routes.length && from && to) { const h = setTimeout(() => search(from, to, prefs), 400); return () => clearTimeout(h); } /* eslint-disable-next-line */ }, [prefs, lang]);

  // viewport features for Explore
  const loadFeatures = useCallback(async () => {
    const v = viewport.current; if (!v || zoom < 15) { setFeatures([]); return; }
    try {
      const r = await fetch(`/api/features?bbox=${v.map((n) => n.toFixed(5)).join(',')}`);
      if (!r.ok) return;
      const j = await r.json();
      setFeatures([...j.features, ...j.reports.map((rp: any) => ({ kind: 'report', label: rp.type, lat: rp.lat, lon: rp.lon, prov: rp.prov, tags: {}, report: rp }))]);
    } catch { /* offline */ }
  }, [zoom]);
  useEffect(() => { if (tab === 'explore') loadFeatures(); }, [tab, zoom, loadFeatures]);

  async function openPlace(p: PlaceRef) {
    setPlace({ loading: true, name: p.name, resolved: [], osm: 'ok' });
    const qs = new URLSearchParams({ lat: String(p.lat), lon: String(p.lon), name: p.name });
    if (p.osm) qs.set('osm', p.osm); if (p.sample) qs.set('sample', p.sample);
    try { const r = await fetch('/api/place?' + qs); const j = await r.json(); setPlace({ ...j, ref: p }); setFlyTo({ lat: p.lat, lon: p.lon, k: Date.now() }); } catch { setPlace(null); }
  }
  function onSelectPlace(setter: (p: PlaceRef | null) => void) { return (p: PlaceRef | null) => { setter(p); if (p) { openPlace(p); setTab('route'); } }; }

  async function confirm(id: string) {
    await fetch('/api/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmId: id, clientId: clientId() }) });
    if (liveRef.current) liveRef.current.textContent = t('report.confirmed');
    loadFeatures();
  }

  function mapPick(lat: number, lon: number) {
    if (pick === 'report') { setReportTarget({ lat, lon }); setPick(null); return; }
    const p: PlaceRef = { name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };
    if (pick === 'from') setFrom(p); else if (pick === 'to') setTo(p);
    setPick(null);
  }

  function demo() { setFrom(DEMO_FROM); setTo(DEMO_TO); setPlace(null); search(DEMO_FROM, DEMO_TO, prefs); }
  const swap = () => { setFrom(to); setTo(from); };

  const tabs: { id: Tab; icon: any; label: string }[] = [{ id: 'route', icon: Navigation, label: t('tab.route') }, { id: 'explore', icon: MapIcon, label: t('tab.explore') }, { id: 'about', icon: Info, label: t('tab.about') }];
  const issueFocus = (i: Issue) => { setIssueId(i.id); setFlyTo({ lat: i.pos.lat, lon: i.pos.lon, k: Date.now() }); };
  const samplePlaces = useMemo(() => samples, [samples]);

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      <a href="#results" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:p-2">{t('skip')}</a>
      <div ref={liveRef} className="sr-only" role="status" aria-live="polite" />

      {/* map */}
      <div className="relative h-[42dvh] shrink-0 lg:order-2 lg:h-full lg:flex-1">
        <MapView center={city.center} zoom={city.zoom} routes={routes} selectedId={selId} selectedIssueId={issueId} onSelectIssue={(id) => { setIssueId(id); setTab('route'); }} onPickRoute={(id) => { setSelId(id); }}
          from={from} to={to} features={tab === 'explore' ? features : []} layers={layers} onFeature={(f) => { setSelFeature(f); setTab('explore'); }} pickMode={!!pick} onPick={mapPick}
          onViewport={(b, z) => { viewport.current = b; setZoom(z); if (tab === 'explore') loadFeatures(); }} samplePlaces={samplePlaces} onSamplePlace={(id) => { const s = samples.find((x) => x.id === id)!; openPlace({ name: s.name, lat: s.lat, lon: s.lon, sample: id }); setTab('route'); }}
          fitKey={fitKey} flyTo={flyTo} label={t('a11y.mapAlt')} />
        {pick && <div role="status" className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">{pick === 'report' ? t('report.pick') : t('route.pickOnMap')} ·{' '}<button className="underline" onClick={() => setPick(null)}>{t('close')}</button></div>}
        <button type="button" onClick={() => setPick('report')} className="absolute bottom-6 right-3 z-10 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-brand-900 shadow-lg ring-1 ring-black/10 hover:bg-brand-50"><Megaphone size={16} aria-hidden />{t('report.here')}</button>
      </div>

      {/* panel */}
      <div className="flex min-h-0 flex-1 flex-col bg-paper lg:order-1 lg:w-[460px] lg:flex-none lg:border-r lg:border-slate-200">
        <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-brand-700 text-white"><Accessibility size={20} aria-hidden /></span>
            <div><h1 className="text-base font-extrabold leading-tight">{lang === 'pl' ? `${city.name} bez barier` : `${city.name} Without Barriers`}</h1><p className="hidden text-[11px] leading-tight text-slate-600 sm:block">{t('app.tagline')}</p></div></div>
          <div className="flex items-center gap-1.5">
            <label className="sr-only" htmlFor="city">{t('city')}</label>
            <select id="city" value={cityId} onChange={(e) => { setCityId(e.target.value); setRoutes([]); setFrom(null); setTo(null); }} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm">{CITIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <button type="button" onClick={() => setLang(lang === 'pl' ? 'en' : 'pl')} aria-label={`${t('lang')}: ${lang === 'pl' ? 'English' : 'Polski'}`} className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-sm font-semibold"><Languages size={15} aria-hidden />{lang === 'pl' ? 'EN' : 'PL'}</button>
          </div>
        </header>
        <nav className="flex border-b border-slate-200 bg-white" role="tablist" aria-label="Sections">
          {tabs.map((x) => <button key={x.id} role="tab" aria-selected={tab === x.id} type="button" onClick={() => setTab(x.id)} className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm font-semibold ${tab === x.id ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}><x.icon size={16} aria-hidden />{x.label}</button>)}
        </nav>

        <div className="sheet-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4" role="tabpanel">
          {tab === 'route' && (<>
            {place && !place.loading && <PlaceCard place={place} t={t} lang={lang} onClose={() => setPlace(null)} onRoute={() => { const r = place.ref as PlaceRef; if (r) { setTo(r); setPlace(null); } }} />}
            {place?.loading && <p className="text-sm text-slate-600" role="status">{t('loading')}</p>}
            <PrefsPanel prefs={prefs} onChange={setPrefs} t={t} />
            <section aria-label={t('tab.route')} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <PlaceSearch label={t('route.from')} value={from} onChange={onSelectPlace(setFrom)} t={t} center={city.center} onPick={() => setPick(pick === 'from' ? null : 'from')} picking={pick === 'from'} allowLocate />
              <div className="flex justify-center"><button type="button" onClick={swap} aria-label={t('route.swap')} className="rounded-full border border-slate-300 p-1.5 hover:bg-slate-50"><ArrowDownUp size={16} /></button></div>
              <PlaceSearch label={t('route.to')} value={to} onChange={onSelectPlace(setTo)} t={t} center={city.center} onPick={() => setPick(pick === 'to' ? null : 'to')} picking={pick === 'to'} />
              <button type="button" disabled={!from || !to || loading} onClick={() => search()} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 text-base font-bold text-white shadow hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? <><Loader2 className="animate-spin" size={18} aria-hidden />{t('route.searching')}</> : <><Navigation size={18} aria-hidden />{t('route.search')}</>}</button>
              {city.id === 'krakow' && <button type="button" onClick={demo} className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-300 bg-brand-50 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-100"><Sparkles size={15} aria-hidden />{t('route.demo')}</button>}
            </section>
            {error && <p role="alert" className="rounded-xl border border-red-400 bg-red-50 p-3 text-sm text-red-950">{error}</p>}
            <StatusBanner status={status} t={t} lang={lang} />
            <div id="results" ref={resultsRef} tabIndex={-1} className="space-y-3 outline-none">
              {blockedOnly && routes.length > 0 && <p role="status" className="rounded-xl border border-red-400 bg-red-50 p-3 text-sm text-red-950">{t('route.noStepFree')}</p>}
              {routes.length > 0 && <RouteCards routes={routes} selectedId={selId} onSelect={(id) => { setSelId(id); setIssueId(null); setFitKey((k) => k + 1); }} t={t} />}
              {selected && <RouteDetail route={selected} selectedIssueId={issueId} onSelectIssue={issueFocus} onReport={(i) => setReportTarget({ lat: i.pos.lat, lon: i.pos.lon, presetType: i.type === 'kerb' ? 'kerb_high' : i.type === 'steps' ? 'steps' : 'fixed' })} t={t} lang={lang} />}
            </div>
          </>)}
          {tab === 'explore' && <ExplorePanel layers={layers} onLayers={setLayers} features={features} zoom={zoom} selected={selFeature} onSelect={(f) => { setSelFeature(f); setFlyTo({ lat: f.lat, lon: f.lon, k: Date.now() }); }} onConfirm={confirm} t={t} lang={lang} />}
          {tab === 'about' && <AboutPanel t={t} lang={lang} status={status} />}
        </div>
      </div>
      {reportTarget && <ReportDialog target={reportTarget} t={t} onClose={() => setReportTarget(null)} onDone={() => { loadFeatures(); }} />}
    </div>
  );
}
