import { useState } from 'react';

export default function ResultSig({ label, value }: { label: string; value?: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const shown = open ? value : `${value.slice(0, 12)}â€¦`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
  };
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[10px] font-mono text-teal-400">
      <span className="uppercase tracking-widest text-zinc-500">{label}</span>
      <span title={value}>{shown}</span>
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="text-amber-400 hover:text-amber-300" aria-label={open ? 'Collapse' : 'Expand'}>{open ? 'âˆ’' : '+'}</button>
      <button onClick={(e) => { e.stopPropagation(); copy(); }} className="text-amber-400 hover:text-amber-300" aria-label="Copy">{copied ? 'âœ“' : 'â§‰'}</button>
    </span>
  );
}
