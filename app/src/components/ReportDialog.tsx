'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { REPORT_TYPES } from '@/lib/reports-types';
import { clientId, type TFn } from '@/lib/client';

export interface ReportTarget { lat: number; lon: number; presetType?: string }

export default function ReportDialog({ target, onClose, onDone, t }: { target: ReportTarget; onClose: () => void; onDone: () => void; t: TFn }) {
  const [type, setType] = useState(target.presetType ?? 'steps');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  async function send() {
    setState('sending');
    try {
      const r = await fetch('/api/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: target.lat, lon: target.lon, type, note, clientId: clientId() }) });
      if (!r.ok) throw new Error();
      setState('done'); onDone();
    } catch { setState('error'); }
  }
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="rep-h" className="m-auto w-[min(92vw,440px)] rounded-2xl p-0 shadow-2xl backdrop:bg-black/50">
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); if (state !== 'done') send(); else ref.current?.close(); }} className="p-5">
        <div className="flex items-start justify-between"><h2 id="rep-h" className="text-lg font-bold">{t('report.title')}</h2>
          <button type="button" aria-label={t('close')} onClick={() => ref.current?.close()} className="rounded-full p-1 hover:bg-slate-100"><X /></button></div>
        {state === 'done' ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950" role="status">{t('report.thanks')}</p> : (
          <>
            <fieldset className="mt-3"><legend className="text-sm font-semibold">{t('report.type')}</legend>
              <div className="mt-1 grid grid-cols-1 gap-1.5">{REPORT_TYPES.map((r) => (
                <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${type === r ? 'border-brand-700 bg-brand-50 font-semibold' : 'border-slate-300'}`}>
                  <input type="radio" name="rt" value={r} checked={type === r} onChange={() => setType(r)} className="accent-brand-700" />{t(`rep.${r}`).replace(/^[^:]+:\s*/, '')}</label>))}</div></fieldset>
            <label className="mt-3 block text-sm font-semibold">{t('report.note')}
              <textarea value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" /></label>
            <p className="mt-2 text-xs text-slate-600">{t('report.privacy')}</p>
            {state === 'error' && <p role="alert" className="mt-2 text-sm text-red-800">{t('route.error')}</p>}
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => ref.current?.close()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">{t('close')}</button>
          {state !== 'done' && <button type="submit" disabled={state === 'sending'} className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">{t('report.send')}</button>}
        </div>
      </form>
    </dialog>
  );
}
