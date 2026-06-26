import React from 'react';
import { ArticleProps } from '../types';

export const CATEGORIES = [
  'all',
  'global',
  'politics',
  'diaspora',
  'finance',
  'culture',
  'health',
  'music',
  'sports',
  'saved'
] as const;

interface CategoryNavProps {
  category: string;
  setCategory: (c: string) => void;
  articles: ArticleProps[];
}

export default function CategoryNav({ category, setCategory, articles }: CategoryNavProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-4">
      <nav
        aria-label="News categories"
        className="flex gap-2 overflow-x-auto rounded-full bg-zinc-900/50 p-1.5 no-scrollbar ring-1 ring-inset ring-zinc-800/50"
      >
        {CATEGORIES.map((c) => {
          const active = category === c;

          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={active}
              className={`relative flex min-w-max items-center justify-center rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition-all duration-300 active:scale-95 ${
                active
                  ? 'bg-amber-500 text-zinc-950 shadow-[0_2px_8px_rgba(245,158,11,0.2)]'
                  : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
              }`}
            >
              {c.replace(/_/g, ' ')}
              {active && articles && articles.length > 0 && category === c && (
                <span className="ml-2 bg-black text-amber-500 rounded-full px-1.5 py-0.5 text-[9px]">
                  {articles.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
