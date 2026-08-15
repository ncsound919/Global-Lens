import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TrendProps } from '../types';
import { safe, relativeTime, tierBadgeClasses, formatConfidence } from '../lib/format';

export default function TrendCard({ trend, onOpen }: { trend: TrendProps; onOpen?: () => void }) {
  const dir = (trend.direction || 'flat').toLowerCase();
  const DirectionIcon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  const dirColor = dir === 'up' ? 'text-emerald-400' : dir === 'down' ? 'text-red-400' : 'text-zinc-500';
  const slope = typeof trend.slope === 'number' && !isNaN(trend.slope) ? trend.slope.toFixed(3) : null;

  return (
    <article
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
      className={`group flex flex-col overflow-hidden rounded-sm border border-zinc-900 bg-[#0c0c0c] transition-all duration-500 hover:border-zinc-700 ${onOpen ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-900 bg-[#080808] px-5 py-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-amber-500">
          {safe(trend.category || 'Trend')}
        </span>
        <span className={tierBadgeClasses(trend.evidence_tier)}>{trend.evidence_tier}</span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex items-start gap-3">
          <DirectionIcon className={`mt-1 h-5 w-5 shrink-0 ${dirColor}`} />
          <h3 className="text-xl font-serif leading-snug text-white transition-colors group-hover:text-amber-300">
            {safe(trend.title)}
          </h3>
        </div>

        {trend.summary && (
          <p className="mb-4 text-sm leading-relaxed text-zinc-400 line-clamp-3">{safe(trend.summary)}</p>
        )}

        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-sm border border-zinc-900 bg-zinc-950 p-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Slope</div>
            <div className="mt-1 font-mono text-sm text-zinc-300">{slope ?? '—'}</div>
          </div>
          <div className="rounded-sm border border-zinc-900 bg-zinc-950 p-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Confidence</div>
            <div className="mt-1 font-mono text-sm text-zinc-300">{formatConfidence(trend.confidence)}</div>
          </div>
          <div className="rounded-sm border border-zinc-900 bg-zinc-950 p-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Direction</div>
            <div className="mt-1 font-mono text-sm text-zinc-300">{dir}</div>
          </div>
        </div>

        {trend.recommended_action && (
          <p className="mb-4 border-l-2 border-amber-500/40 pl-3 text-[13px] leading-relaxed text-zinc-400">
            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500/80">Action — </span>
            {safe(trend.recommended_action)}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-zinc-900 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{safe(trend.source || 'insight')}</span>
          <span className="text-[10px] uppercase tracking-widest text-zinc-600">{relativeTime(trend.pub_date)}</span>
        </div>
      </div>
    </article>
  );
}
