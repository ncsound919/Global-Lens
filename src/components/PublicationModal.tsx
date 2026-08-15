import React, { useEffect, useState } from 'react';
import { X, ExternalLink, ArrowUpRight } from 'lucide-react';
import { PaperProps, TrendProps, DiscoveryProps, MetaphorPackage } from '../types';
import { safe, tierBadgeClasses, formatConfidence, pillarLabel } from '../lib/format';
import Byline from './Byline';
import EvidenceLegend from './EvidenceLegend';
import MetaphorBox from './MetaphorBox';

export type PublicationItem =
  | { type: 'paper'; item: PaperProps }
  | { type: 'trend'; item: TrendProps }
  | { type: 'discovery'; item: DiscoveryProps };

interface PublicationModalProps {
  data: PublicationItem;
  onClose: () => void;
}

function MetaStat({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{label}</div>
      <div className="mt-0.5 text-[13px] text-zinc-300">{value || '—'}</div>
    </div>
  );
}

export default function PublicationModal({ data, onClose }: PublicationModalProps) {
  const { type } = data;
  const paper = type === 'paper' ? (data.item as PaperProps) : null;
  const trend = type === 'trend' ? (data.item as TrendProps) : null;
  const discovery = type === 'discovery' ? (data.item as DiscoveryProps) : null;

  const desk = type === 'paper' ? (paper ? pillarLabel(paper.pillar) : 'Research') : type === 'trend' ? 'Trend Intelligence' : 'Discovery';

  const [metaphor, setMetaphor] = useState<MetaphorPackage | null>(null);
  const [loadingMetaphor, setLoadingMetaphor] = useState(false);

  useEffect(() => {
    if (type !== 'paper' || !paper?.title) return;
    setLoadingMetaphor(true);
    fetch(`/api/metaphors/topic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: safe(paper.title).slice(0, 400) }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        setMetaphor(d?.metaphor || null);
        setLoadingMetaphor(false);
      })
      .catch((e) => {
        console.error(e);
        setLoadingMetaphor(false);
      });
  }, [type, paper?.title]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const title = safe(paper?.title || trend?.title || discovery?.title);
  const standfirst = safe(paper?.summary || paper?.abstract || trend?.summary || discovery?.insight);
  const sourceUrl = paper?.url || '';
  const evidenceTier = paper?.evidence_tier || trend?.evidence_tier || discovery?.evidence_tier;
  const pubDate = paper?.pub_date || trend?.pub_date || discovery?.pub_date;

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex justify-end animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl h-full overflow-y-auto bg-zinc-950/95 border-l border-zinc-800 p-8 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="text-xs uppercase font-bold tracking-widest text-zinc-500 hover:text-zinc-300 mb-6 flex items-center gap-2 cursor-pointer transition-colors"
        >
          <X className="h-4 w-4" /> Close
        </button>

        <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-amber-500 mb-4">
          {desk}
        </span>

        <h1 className="text-3xl font-serif text-white leading-tight mb-4">{title}</h1>

        {standfirst && (
          <p className="text-base leading-relaxed text-zinc-300 mb-6">{standfirst}</p>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          {evidenceTier && <span className={tierBadgeClasses(evidenceTier)}>Evidence {evidenceTier}</span>}
          {paper?.source && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {safe(paper.source)}
            </span>
          )}
          <Byline desk={desk} date={pubDate} source={paper?.source} />
        </div>

        {/* Paper specifics */}
        {paper && (
          <div className="mb-6 grid grid-cols-2 gap-4 rounded-sm border border-zinc-900 bg-[#0c0c0c] p-5 sm:grid-cols-4">
            <MetaStat label="Authors" value={safe(paper.authors).slice(0, 90)} />
            <MetaStat label="Year" value={paper.year ? String(paper.year) : '—'} />
            <MetaStat label="Pillar" value={pillarLabel(paper.pillar)} />
            <MetaStat label="DOI" value={paper.payload?.doi ? `doi.org/${paper.payload.doi}` : '—'} />
          </div>
        )}

        {/* Trend specifics */}
        {trend && (
          <div className="mb-6 grid grid-cols-3 gap-4 rounded-sm border border-zinc-900 bg-[#0c0c0c] p-5">
            <MetaStat label="Direction" value={safe(trend.direction)} />
            <MetaStat label="Slope" value={typeof trend.slope === 'number' ? trend.slope.toFixed(3) : '—'} />
            <MetaStat label="Confidence" value={formatConfidence(trend.confidence)} />
            {trend.recommended_action && (
              <div className="col-span-3 border-t border-zinc-900 pt-4">
                <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Recommended Action</div>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">{safe(trend.recommended_action)}</p>
              </div>
            )}
          </div>
        )}

        {/* Discovery specifics */}
        {discovery && (
          <div className="mb-6 grid grid-cols-1 gap-4 rounded-sm border border-zinc-900 bg-[#0c0c0c] p-5 sm:grid-cols-2">
            <MetaStat label="Source" value={safe(discovery.source)} />
            <MetaStat label="Category" value={safe(discovery.category)} />
          </div>
        )}

        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-zinc-300 transition-all hover:bg-white hover:text-black hover:border-white"
          >
            <ExternalLink className="h-4 w-4" />
            Read the source
          </a>
        )}

        {/* Comic metaphor for papers */}
        {type === 'paper' && (
          <div className="mb-8 border-t border-zinc-800/80 pt-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-fuchsia-400 mb-5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" />
              The Comic Metaphor
            </h3>
            <MetaphorBox metaphor={metaphor} loading={loadingMetaphor} />
          </div>
        )}

        <div className="mb-8 border-t border-zinc-800/80 pt-6">
          <EvidenceLegend />
        </div>

        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Back to the edition <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
