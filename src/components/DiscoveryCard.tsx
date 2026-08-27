import { Lightbulb } from 'lucide-react';
import { DiscoveryProps } from '../types';
import { safe, relativeTime, tierBadgeClasses } from '../lib/format';

export default function DiscoveryCard({ discovery, onOpen }: { discovery: DiscoveryProps; onOpen?: () => void }) {
  return (
    <article
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
      className={`group flex flex-col overflow-hidden rounded-sm border border-zinc-900 bg-ink-900 transition-all duration-500 hover:border-zinc-700 ${onOpen ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-900 bg-ink-750 px-5 py-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-cyan-500">
          {safe(discovery.category || 'Discovery')}
        </span>
        <span className={tierBadgeClasses(discovery.evidence_tier)}>{discovery.evidence_tier}</span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-4 flex items-start gap-3">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
          <h3 className="text-xl font-serif leading-snug text-white transition-colors group-hover:text-cyan-300">
            {safe(discovery.title)}
          </h3>
        </div>

        {discovery.insight && (
          <p className="mb-4 text-sm leading-relaxed text-zinc-400">{safe(discovery.insight)}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-zinc-900 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{safe(discovery.source || 'insight')}</span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400">{relativeTime(discovery.pub_date)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
