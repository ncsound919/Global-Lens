import { FindingProps } from '../types';
import { tierBadgeClasses } from '../lib/format';
import ResultSig from './ResultSig';

export default function FindingCard({ finding }: { finding: FindingProps }) {
  return (
    <article className="flex flex-col rounded-sm border border-zinc-900 bg-ink-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-amber-500">{finding.kind}</span>
        {finding.evidence_tier && <span className={tierBadgeClasses(finding.evidence_tier)}>{finding.evidence_tier}</span>}
      </div>
      <h4 className="mt-3 text-base font-serif leading-snug text-white">{finding.headline}</h4>
      <p className="mt-2 text-sm text-zinc-400">
        {finding.metric && <span className="text-teal-400">{finding.metric}:</span>} <span className="text-white">{finding.value}{finding.unit}</span>
        {finding.reference_claim && <span className="text-zinc-500"> vs {finding.reference_claim}</span>}
      </p>
      <p className="mt-2 text-[11px] uppercase tracking-widest text-zinc-500">
        {finding.dataset}{finding.sample_size ? ` Â· N=${finding.sample_size}` : ''}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ResultSig label="manifest" value={finding.manifest_hash} />
        <ResultSig label="audit" value={finding.audit_signature} />
      </div>
    </article>
  );
}
