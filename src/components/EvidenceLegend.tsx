import { tierBadgeClasses } from '../lib/format';

const LEGEND: { tier: string; label: string }[] = [
  { tier: 'E1', label: 'Measured' },
  { tier: 'E2', label: 'Validated' },
  { tier: 'E3', label: 'In progress' },
  { tier: 'E4', label: 'Speculative' },
];

export default function EvidenceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">Evidence</span>
      {LEGEND.map(({ tier, label }) => (
        <span key={tier} className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-zinc-400">
          <span className={tierBadgeClasses(tier)}>{tier}</span>
          {label}
        </span>
      ))}
    </div>
  );
}
