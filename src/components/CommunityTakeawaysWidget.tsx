import React from 'react';

interface TakeawayProps {
  takeaways: string[];
}

export default function CommunityTakeawaysWidget({ takeaways }: TakeawayProps) {
  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-linear-to-br from-amber-50/70 to-orange-50/30 p-5 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-zinc-900">
      
      {/* Widget Header Banner */}
      <div className="flex items-center space-x-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-amber-600 animate-pulse" />
        <h4 className="text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-400 font-mono">
          ✊🏽 What This Means For Us
        </h4>
      </div>

      {/* Bullets List Output Grid */}
      <ul className="space-y-3">
        {takeaways.map((bullet, index) => (
          <li key={index} className="flex items-start space-x-2 text-sm text-zinc-800 dark:text-zinc-300 leading-relaxed">
            <span className="text-amber-600 dark:text-amber-500 select-none font-bold mt-0.5">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

    </div>
  );
}
