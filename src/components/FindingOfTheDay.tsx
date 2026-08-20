import React from 'react';
import { FindingProps } from '../types';
import { tierBadgeClasses } from '../lib/format';
import ResultSig from './ResultSig';

export default function FindingOfTheDay({ finding, day }: { finding: FindingProps | null; day: string }) {
  if (!finding) {
    return (
      <section className="rounded-sm border border-zinc-900 bg-[#0c0c0c] p-6 text-zinc-500">
        <p className="text-xs uppercase tracking-widest">Finding of the Day</p>
        <p className="mt-2 text-sm">No verified findings yet. Check back soon.</p>
      </section>
    );
  }
  return (
    <section className="rounded-sm border border-teal-900/60 bg-gradient-to-b from-[#0d1117] to-[#0c0c0c] p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-teal-400">Finding of the Day · {day}</p>
        {finding.evidence_tier && <span className={tierBadgeClasses(finding.evidence_tier)}>{finding.evidence_tier}</span>}
      </div>
      <h3 className="mt-4 text-2xl font-serif leading-snug text-white">{finding.headline}</h3>
      <p className="mt-3 text-base text-zinc-300">
        {finding.metric && <span className="text-teal-400">{finding.metric}:</span>} <span className="font-bold text-amber-300">{finding.value}{finding.unit}</span>
        {finding.reference_claim && <span className="text-zinc-500"> vs {finding.reference_claim}</span>}
      </p>
      <p className="mt-2 text-[11px] uppercase tracking-widest text-zinc-500">
        {finding.dataset}{finding.sample_size ? ` · N=${finding.sample_size}` : ''}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ResultSig label="manifest" value={finding.manifest_hash} />
        <ResultSig label="audit" value={finding.audit_signature} />
      </div>
    </section>
  );
}
