
interface PublicationFooterProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onSelectSection?: (section: string) => void;
}

const PILLARS = ['Health', 'Wealth', 'Justice', 'Science', 'Writing', 'Music', 'Sport', 'Finance', 'AI-Safety'];
const SECTIONS = ['News', 'Research', 'Environment', 'Trends', 'Discoveries'];

export default function PublicationFooter({ onOpenPrivacy, onOpenTerms, onSelectSection }: PublicationFooterProps) {
  return (
    <footer className="w-full border-t border-zinc-900 bg-zinc-950">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <h2 className="text-2xl font-serif text-white">Overlay Global Lens</h2>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.25em] text-amber-500">
              An Overlay365 Publication
            </p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-500">
              Global reporting, research papers, trends, and discoveries â€” every item evidence-tiered and traced to
              source. One Digital Platform. Three Life Systems. Infinite Possibilities.
            </p>
          </div>

          <div className="md:col-span-2">
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.25em] text-zinc-300">Sections</h3>
            <ul className="space-y-2">
              {SECTIONS.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => onSelectSection?.(s)}
                    className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.25em] text-zinc-300">Overlay365 Pillars</h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
              {PILLARS.map((p) => (
                <li key={p}>
                  <span className="text-sm text-zinc-500 transition-colors hover:text-zinc-300">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2">
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.25em] text-zinc-300">Standards</h3>
            <p className="text-xs leading-relaxed text-zinc-500">
              Evidence tiers E1â€“E4 mark every research item. Findings are measured, never fabricated. Original content is
              linked and sourced under fair use.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-zinc-900 pt-6 sm:flex-row sm:items-center">
          <span className="text-xs text-zinc-500">
            Â© {new Date().getFullYear()} Overlay365. All rights reserved.
          </span>
          <div className="flex gap-4">
            <button onClick={onOpenPrivacy} className="text-xs text-zinc-500 transition-colors hover:text-zinc-300">
              Privacy Policy
            </button>
            <button onClick={onOpenTerms} className="text-xs text-zinc-500 transition-colors hover:text-zinc-300">
              Terms of Service
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
