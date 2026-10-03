'use client';
import { BadgeCheck, ShieldQuestion, ShieldAlert, Shield, Database } from 'lucide-react';
import type { Confidence, Fact, Provenance as Prov } from '@/lib/types';
import type { Lang } from '@/lib/i18n';
import { fmtDate, type TFn } from '@/lib/client';

const CONF: Record<Confidence, { cls: string; Icon: typeof Shield }> = {
  confirmed: { cls: 'bg-emerald-50 text-emerald-900 border-emerald-400', Icon: BadgeCheck },
  likely: { cls: 'bg-sky-50 text-sky-900 border-sky-400', Icon: Shield },
  unverified: { cls: 'bg-amber-50 text-amber-950 border-amber-500 border-dashed', Icon: ShieldAlert },
  unknown: { cls: 'bg-zinc-100 text-zinc-800 border-zinc-400 border-dashed', Icon: ShieldQuestion },
};

export function ConfBadge({ c, t }: { c: Confidence; t: TFn }) {
  const { cls, Icon } = CONF[c];
  return <span title={t(`conf.${c}.d`)} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}><Icon size={13} aria-hidden />{t(`conf.${c}`)}</span>;
}

export function Provenance({ prov, t, lang }: { prov: Prov; t: TFn; lang: Lang }) {
  const date = fmtDate(prov.updated, lang);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-700">
      <ConfBadge c={prov.confidence} t={t} />
      <span className={prov.source === 'sample' ? 'rounded bg-fuchsia-100 px-1.5 py-0.5 font-bold text-fuchsia-900' : 'font-medium'}>
        {prov.url ? <a className="underline underline-offset-2" href={prov.url} target="_blank" rel="noreferrer">{t(`src.${prov.source}`)}<span className="sr-only"> ({prov.ref})</span></a> : t(`src.${prov.source}`)}
      </span>
      <span>· {t('prov.updated')}: {date || t('prov.none')}{prov.freshnessBasis ? <span className="sr-only"> ({t(`prov.basis.${prov.freshnessBasis}`)})</span> : null}</span>
    </div>
  );
}

export function FactList({ facts, t, lang }: { facts: Fact[]; t: TFn; lang: Lang }) {
  if (!facts.length) return null;
  return (
    <ul className="mt-2 space-y-2">
      {facts.map((f, i) => (
        <li key={i} className="rounded-lg bg-white/70 p-2 ring-1 ring-black/5">
          <div className="mb-1 flex items-center gap-1 text-xs text-slate-600"><Database size={12} aria-hidden /><code className="rounded bg-slate-100 px-1">{f.attr}={f.value || '—'}</code></div>
          <Provenance prov={f.prov} t={t} lang={lang} />
          {f.prov.freshnessBasis && <p className="mt-1 text-[11px] text-slate-500">{t(`prov.basis.${f.prov.freshnessBasis}`)}</p>}
        </li>
      ))}
    </ul>
  );
}
