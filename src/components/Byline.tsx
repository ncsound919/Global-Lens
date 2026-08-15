import React from 'react';

interface BylineProps {
  desk?: string;
  date?: string;
  source?: string;
  tone?: 'muted' | 'bright';
}

export default function Byline({ desk, date, source, tone = 'muted' }: BylineProps) {
  const parts: string[] = [];
  if (desk) parts.push(`By the ${desk} Desk`);
  if (date) parts.push(date);
  if (source) parts.push(`Source: ${source}`);

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
        tone === 'bright' ? 'text-zinc-300' : 'text-zinc-500'
      }`}
    >
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-zinc-700">·</span>}
          <span>{p}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
