import React from 'react';
import { VenetianMask } from 'lucide-react';
import { MetaphorPackage } from '../types';
import { safe, formatConfidence } from '../lib/format';

interface MetaphorBoxProps {
  metaphor: MetaphorPackage | null;
  loading?: boolean;
}

function Score({ label, value }: { label: string; value?: number | null }) {
  if (typeof value !== 'number' || isNaN(value)) return null;
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-1.5 w-full max-w-[48px] overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-fuchsia-500 transition-all"
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
      <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">{label} {pct}</span>
    </div>
  );
}

export default function MetaphorBox({ metaphor, loading }: MetaphorBoxProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-1/3 rounded bg-zinc-800/60" />
        <div className="h-10 w-full rounded bg-zinc-800/40" />
        <div className="h-4 w-5/6 rounded bg-zinc-800/40" />
      </div>
    );
  }

  if (!metaphor || metaphor._unavailable || !metaphor.protocol_id) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-5 py-4">
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
          STORYLINE NOT YET AVAILABLE
        </span>
      </div>
    );
  }

  const beats = Array.isArray(metaphor.beat_structure) ? metaphor.beat_structure : [];
  const scores = metaphor.codex_scores;

  return (
    <div className="overflow-hidden rounded-xl border border-fuchsia-900/40 bg-gradient-to-br from-fuchsia-950/20 via-zinc-900/40 to-zinc-950">
      <div className="border-b border-fuchsia-900/30 px-5 py-3">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-fuchsia-400">
          <VenetianMask className="h-4 w-4" />
          The Comic Metaphor
        </span>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Storyline</span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-fuchsia-400/80">{safe(metaphor.protocol_id)}</span>
          </div>
          <p className="text-[15px] leading-relaxed text-zinc-200 font-serif">
            {safe(metaphor.core_tension)}
          </p>
        </div>

        {metaphor.lesson && (
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-3">
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-emerald-400">Business Lesson</span>
            <p className="text-[12.5px] leading-relaxed text-emerald-100/90">{safe(metaphor.lesson)}</p>
          </div>
        )}

        {metaphor.narrative && (
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">The Story</span>
            <p className="text-[12.5px] leading-relaxed text-zinc-400 font-serif">{safe(metaphor.narrative)}</p>
          </div>
        )}

        {metaphor.mappings && metaphor.mappings.length > 0 && (
          <div className="space-y-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Mappings</span>
            {metaphor.mappings.map((m, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-zinc-300">{safe(m.real_world)}</span>
                  <span className="text-[9px] font-mono text-fuchsia-400/70">→</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-serif text-fuchsia-200">{safe(m.comic_analog)}</span>
                  {typeof m.confidence === 'number' && (
                    <span className="text-[9px] font-mono text-zinc-500">{formatConfidence(m.confidence)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {beats.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Beat Structure</span>
            <div className="flex flex-wrap gap-1.5">
              {beats.map((b, i) => (
                <span
                  key={i}
                  className="rounded-sm border border-zinc-800 bg-zinc-950 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400"
                >
                  {safe(typeof b === 'string' ? b : b?.name || b?.title || `Beat ${i + 1}`)}
                </span>
              ))}
            </div>
          </div>
        )}

        {scores && (
          <div className="border-t border-zinc-800/60 pt-3">
            <span className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">Codex Fit</span>
            <div className="flex justify-between gap-2">
              <Score label="Fit" value={scores.overall_fit} />
              <Score label="Trueness" value={scores.trueness} />
              <Score label="Flow" value={scores.flow} />
              <Score label="PCS" value={scores.pcs} />
              <Score label="TAP" value={scores.tap} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
