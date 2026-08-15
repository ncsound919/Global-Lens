import React from 'react';
import { Newspaper, BookOpen, TrendingUp, Sparkles } from 'lucide-react';

export const CONTENT_VIEWS = [
  { key: 'news', label: 'News', icon: Newspaper },
  { key: 'papers', label: 'Research', icon: BookOpen },
  { key: 'trends', label: 'Trends', icon: TrendingUp },
  { key: 'discoveries', label: 'Discoveries', icon: Sparkles },
] as const;

export type ContentView = (typeof CONTENT_VIEWS)[number]['key'];

interface ContentViewNavProps {
  view: ContentView;
  setView: (v: ContentView) => void;
}

export default function ContentViewNav({ view, setView }: ContentViewNavProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-4">
      <nav
        aria-label="Content sections"
        className="flex gap-1 overflow-x-auto border-y border-zinc-900/80 py-2 no-scrollbar"
      >
        {CONTENT_VIEWS.map(({ key, label, icon: Icon }) => {
          const active = view === key;
          return (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-pressed={active}
              className={`flex min-w-max items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] transition-all duration-300 active:scale-95 ${
                active
                  ? 'bg-amber-500 text-zinc-950 shadow-[0_2px_8px_rgba(245,158,11,0.2)]'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
