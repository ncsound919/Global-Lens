export const safe = (val: any): string => {
  if (typeof val === 'string') return val;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return Object.values(val).filter((v) => typeof v === 'string').join(' ') || JSON.stringify(val);
  return String(val);
};

export function relativeTime(date?: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 60) return `${Math.max(1, diff)}m ago`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const EVIDENCE_TIER_COLORS: Record<string, string> = {
  E1: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  E2: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  E3: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  E4: 'bg-zinc-700/20 text-zinc-400 border-zinc-600/30',
};

export function tierBadgeClasses(tier?: string): string {
  const base = 'inline-flex items-center rounded-sm border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest';
  return `${base} ${EVIDENCE_TIER_COLORS[tier || 'E4'] || EVIDENCE_TIER_COLORS.E4}`;
}

export function formatConfidence(conf?: number | null): string {
  if (typeof conf !== 'number' || isNaN(conf)) return '—';
  return `${Math.round(conf * 100)}%`;
}

export const PILLAR_LABELS: Record<string, string> = {
  science: 'Science',
  sport: 'Sport',
  health: 'Health',
  wealth: 'Wealth',
  music: 'Music',
  writing: 'Writing',
  justice: 'Justice',
  research: 'Research',
};

export function pillarLabel(pillar?: string): string {
  return PILLAR_LABELS[(pillar || '').toLowerCase()] || safe(pillar) || 'Research';
}
