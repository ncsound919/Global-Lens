import { BookOpen, TrendingUp, Sparkles, ArrowUpRight } from 'lucide-react';
import { PaperProps, TrendProps, DiscoveryProps } from '../types';
import { safe, relativeTime, tierBadgeClasses, formatConfidence } from '../lib/format';

interface ResearchDeskRailProps {
  papers: PaperProps[];
  trends: TrendProps[];
  discoveries: DiscoveryProps[];
  onOpenPaper: (p: PaperProps) => void;
  onOpenTrend: (t: TrendProps) => void;
  onOpenDiscovery: (d: DiscoveryProps) => void;
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-xs text-zinc-400 italic">{label} â€” the desk is still populating.</p>
  );
}

export default function ResearchDeskRail({
  papers,
  trends,
  discoveries,
  onOpenPaper,
  onOpenTrend,
  onOpenDiscovery,
}: ResearchDeskRailProps) {
  const paper = papers[0];
  const trend = trends[0];
  const discovery = discoveries[0];

  return (
    <aside className="flex flex-col gap-6">
      <div className="rounded-sm border border-zinc-900 bg-ink-900">
        <div className="flex items-center gap-2 border-b border-zinc-900 bg-ink-750 px-5 py-3">
          <BookOpen className="h-4 w-4 text-teal-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-200">The Research Desk</span>
        </div>
        <div className="space-y-6 p-5">
          <div>
            <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.2em] text-teal-500">Featured Paper</span>
            {paper ? (
              <button onClick={() => onOpenPaper(paper)} className="group block w-full text-left">
                <h4 className="text-sm font-serif leading-snug text-zinc-200 transition-colors group-hover:text-teal-300">
                  {safe(paper.title)}
                </h4>
                <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400 transition-colors group-hover:text-teal-400">
                  Read the study <ArrowUpRight className="h-3 w-3" />
                </span>
              </button>
            ) : (
              <EmptyState label="Papers" />
            )}
          </div>

          <div className="border-t border-zinc-900 pt-5">
            <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.2em] text-amber-500">Trend Watch</span>
            {trend ? (
              <button onClick={() => onOpenTrend(trend)} className="group block w-full text-left">
                <h4 className="text-sm font-serif leading-snug text-zinc-200 transition-colors group-hover:text-amber-300">
                  {safe(trend.title)}
                </h4>
                <span className="mt-2 inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                  <TrendingUp className="h-3 w-3" /> {safe(trend.direction || 'flat')} Â· {formatConfidence(trend.confidence)}
                </span>
              </button>
            ) : (
              <EmptyState label="Trends" />
            )}
          </div>

          <div className="border-t border-zinc-900 pt-5">
            <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-500">Discovery Spotlight</span>
            {discovery ? (
              <button onClick={() => onOpenDiscovery(discovery)} className="group block w-full text-left">
                <h4 className="text-sm font-serif leading-snug text-zinc-200 transition-colors group-hover:text-cyan-300">
                  {safe(discovery.title)}
                </h4>
                {discovery.evidence_tier && (
                  <span className={`mt-2 inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest ${tierBadgeClasses(discovery.evidence_tier)}`}>
                    <Sparkles className="h-3 w-3" /> {discovery.evidence_tier}
                  </span>
                )}
              </button>
            ) : (
              <EmptyState label="Discoveries" />
            )}
          </div>

          {!paper && !trend && !discovery && (
            <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
              NEW RESEARCH BEING PREPARED
            </p>
          )}
        </div>
      </div>

      <div className="rounded-sm border border-zinc-900 bg-ink-900 p-5">
        <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">Editorial Standards</span>
        <p className="text-xs leading-relaxed text-zinc-400">
          Every research item carries an evidence tier (E1â€“E4) and traces to its source. Findings are measured, never
          fabricated. Original reporting is linked under fair use.
        </p>
        <p className="mt-3 text-[10px] text-zinc-400">{relativeTime(new Date().toISOString())} Â· Global Edition</p>
      </div>
    </aside>
  );
}
