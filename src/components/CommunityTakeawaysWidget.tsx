
interface TakeawayProps {
  takeaways: string[];
}

const safe = (val: any): string => {
  if (typeof val === 'string') return val;
  if (val === null || val === undefined) return '';
  return JSON.stringify(val);
};

export default function CommunityTakeawaysWidget({ takeaways }: TakeawayProps) {
  const items = Array.isArray(takeaways) ? takeaways.filter(Boolean) : [];
  if (items.length === 0) return null;

  return (
    <div className="relative mt-8 rounded-sm border border-zinc-800 bg-ink-850 overflow-hidden">
      {/* Top accent bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-amber-500 via-amber-400/50 to-transparent" />

      <div className="p-6 sm:p-7">
        {/* Widget Header */}
        <div className="flex items-center space-x-3 mb-6">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-500">
              What this means for you
            </h4>
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400 mt-0.5">
              Community perspective
            </p>
          </div>
        </div>

        {/* Points */}
        <ul className="space-y-3.5">
          {items.map((point, index) => (
            <li key={index} className="flex items-start gap-3.5 text-zinc-300">
              <span className="mt-[3px] shrink-0 flex h-5 w-5 items-center justify-center rounded-sm bg-amber-500/10 text-amber-500">
                <span className="text-[9px] font-black">›</span>
              </span>
              <span className="text-[14px] font-sans leading-relaxed">{safe(point)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
