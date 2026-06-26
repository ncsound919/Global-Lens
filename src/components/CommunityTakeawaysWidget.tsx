import React from 'react';

interface TakeawayProps {
  takeaways: string[];
}

const safe = (val: any): string => {
  if (typeof val === 'string') return val;
  if (val === null || val === undefined) return '';
  return JSON.stringify(val);
};

export default function CommunityTakeawaysWidget({ takeaways }: TakeawayProps) {
  return (
    <div className="relative mt-8 p-6 rounded-sm border border-zinc-900 bg-[#0f0f0f]">
      
      {/* Widget Header Banner */}
      <div className="flex items-center space-x-3 mb-5 pb-4 border-b border-zinc-900">
        <span className="h-4 w-1 bg-amber-500 rounded-full" />
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 font-mono">
          Actionable Takeaways
        </h4>
      </div>

      {/* Bullets List Output Grid */}
      <ul className="space-y-4">
        {(takeaways ?? []).map((bullet, index) => (
          <li key={index} className="flex items-start space-x-4 text-zinc-300">
            <span className="text-amber-500 mt-1 font-bold text-[10px]">■</span>
            <span className="text-sm font-sans leading-relaxed">{safe(bullet)}</span>
          </li>
        ))}
      </ul>

    </div>
  );
}
