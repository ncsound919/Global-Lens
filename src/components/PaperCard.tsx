import { PaperProps } from '../types';
import { safe, relativeTime, tierBadgeClasses, pillarLabel } from '../lib/format';

export default function PaperCard({ paper, onOpen }: { paper: PaperProps; onOpen?: () => void }) {
  const doi = paper.payload?.doi || '';
  const sourceLabel = safe(paper.source).toUpperCase();
  return (
    <article
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
      className={`group flex flex-col overflow-hidden rounded-sm border border-zinc-900 bg-ink-900 transition-all duration-500 hover:border-zinc-700 ${onOpen ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-900 bg-ink-750 px-5 py-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-teal-500">
          {pillarLabel(paper.pillar)}
        </span>
        <div className="flex items-center gap-2">
          {paper.evidence_tier && <span className={tierBadgeClasses(paper.evidence_tier)}>{paper.evidence_tier}</span>}
          {paper.year && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{paper.year}</span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="mb-3 text-xl font-serif leading-snug text-white transition-colors group-hover:text-amber-300">
          {safe(paper.title)}
        </h3>

        {paper.authors && (
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            {safe(paper.authors).slice(0, 160)}
          </p>
        )}

        {paper.summary && (
          <p className="mb-4 text-sm leading-relaxed text-zinc-400 line-clamp-3">{safe(paper.summary)}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-900 pt-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">{sourceLabel}</span>
            <span className="text-[10px] uppercase tracking-widest text-zinc-400">{relativeTime(paper.pub_date)}</span>
          </div>
          <div className="flex items-center gap-3">
            {doi && <span className="text-[10px] font-mono text-zinc-400 max-w-[120px] truncate" title={doi}>doi:{doi}</span>}
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="rounded-full border border-zinc-800 bg-zinc-950 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400 transition-all hover:bg-white hover:text-black hover:border-white"
              >
                Read paper →
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
