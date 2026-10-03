'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { LocateFixed, MapPin, X } from 'lucide-react';
import type { PlaceRef, TFn } from '@/lib/client';

interface Props { label: string; value: PlaceRef | null; onChange: (p: PlaceRef | null) => void; t: TFn; center: [number, number]; onPick: () => void; picking: boolean; allowLocate?: boolean }

export default function PlaceSearch({ label, value, onChange, t, center, onPick, picking, allowLocate }: Props) {
  const id = useId();
  const [q, setQ] = useState(value?.name ?? '');
  const [res, setRes] = useState<PlaceRef[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const timer = useRef<any>(null);
  useEffect(() => { setQ(value?.name ?? ''); }, [value]);

  function onInput(v: string) {
    setQ(v); setOpen(true); setActive(-1);
    clearTimeout(timer.current);
    if (v.trim().length < 2) { setRes([]); return; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try { const r = await fetch(`/api/geocode?q=${encodeURIComponent(v)}&lat=${center[1]}&lon=${center[0]}`); setRes((await r.json()).results ?? []); } catch { setRes([]); }
      setBusy(false);
    }, 300);
  }
  function choose(p: PlaceRef) { onChange(p); setQ(p.name); setOpen(false); }
  function locate() {
    navigator.geolocation?.getCurrentPosition((pos) => choose({ name: t('route.locate'), lat: pos.coords.latitude, lon: pos.coords.longitude }), () => alert(t('geo.denied')), { enableHighAccuracy: true, timeout: 8000 });
  }
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-slate-800">{label}</label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <input id={id} value={q} onChange={(e) => onInput(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
            role="combobox" aria-expanded={open && res.length > 0} aria-controls={id + '-l'} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-o${active}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(res.length - 1, a + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              else if (e.key === 'Enter' && active >= 0 && res[active]) { e.preventDefault(); choose(res[active]); }
              else if (e.key === 'Escape') setOpen(false);
            }}
            placeholder={t('search.placeholder')} autoComplete="off"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-base shadow-sm placeholder:text-slate-500 focus:border-brand-600" />
          {q && <button type="button" aria-label={t('route.clear')} onClick={() => { onChange(null); setQ(''); setRes([]); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-600 hover:bg-slate-100"><X size={16} /></button>}
        </div>
        <button type="button" onClick={onPick} aria-pressed={picking} title={t('route.pickOnMap')} aria-label={`${t('route.pickOnMap')}: ${label}`} className={`rounded-xl border px-3 ${picking ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}><MapPin size={18} /></button>
        {allowLocate && <button type="button" onClick={locate} title={t('route.locate')} aria-label={t('route.locate')} className="rounded-xl border border-slate-300 bg-white px-3 text-slate-800 hover:bg-slate-50"><LocateFixed size={18} /></button>}
      </div>
      {open && (res.length > 0 || (busy && q.length > 1)) && (
        <ul id={id + '-l'} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {res.map((r, i) => (
            <li key={i} id={`${id}-o${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(r); }}
              className={`cursor-pointer rounded-lg px-3 py-2 ${i === active ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
              <div className="text-sm font-semibold">{r.name}</div><div className="text-xs text-slate-600">{r.sub}</div>
            </li>
          ))}
          {!res.length && busy && <li className="px-3 py-2 text-sm text-slate-600">{t('loading')}</li>}
        </ul>
      )}
    </div>
  );
}
