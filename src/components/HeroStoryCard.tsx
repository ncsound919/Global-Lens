import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ArticleProps } from '../types';
import { safe, relativeTime } from '../lib/format';
import Byline from './Byline';
import ArticleModal from './ArticleModal';

export default function HeroStoryCard({ article }: { article: ArticleProps }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <article className="group relative mb-12 overflow-hidden rounded-sm border border-zinc-900 bg-[#0c0c0c] transition-all duration-500 hover:border-zinc-700">
        {article.image_url && (
          <div className="relative h-56 w-full overflow-hidden border-b border-zinc-900 sm:h-72 lg:h-96">
            <img
              src={article.image_url}
              alt={safe(article.reframed_headline)}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c] via-transparent to-transparent" />
            <span className="absolute left-5 top-5 rounded-sm bg-amber-500 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-zinc-950">
              Lead Story
            </span>
          </div>
        )}

        <div className={`p-6 sm:p-8 lg:p-12 ${article.image_url ? '' : 'pt-8'}`}>
          <div className="mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500">
              {safe(article.category).replace(/_/g, ' ')}
            </span>
          </div>
          <h2 className="max-w-4xl text-3xl font-serif leading-[1.1] text-white sm:text-4xl lg:text-5xl">
            {safe(article.reframed_headline)}
          </h2>
          {article.reframed_summary && (
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-zinc-400">{safe(article.reframed_summary)}</p>
          )}
          <div className="mt-6">
            <Byline desk={safe(article.category)} date={relativeTime(article.pub_date)} source={safe(article.source_name)} tone="bright" />
          </div>
          <button
            onClick={() => setOpen(true)}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400 transition-all hover:bg-amber-500 hover:text-zinc-950"
          >
            Read the story
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </article>

      {open && (
        <ArticleModal
          articleId={article.url_hash || article.id || 0}
          onClose={() => setOpen(false)}
          simplifiedText={safe(article.cultural_lens_analysis)}
          headline={safe(article.reframed_headline) || safe(article.original_title)}
          articleBody={safe(article.article_body)}
        />
      )}
    </>
  );
}
