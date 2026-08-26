import React, { useState, useEffect } from 'react';
import { ArticleProps } from '../types';
import ArticleModal from './ArticleModal';
import CommunityTakeawaysWidget from './CommunityTakeawaysWidget';
import AnalyticsChart from './AnalyticsChart';
import BookmarkButton from './BookmarkButton';
import ShareToolbar from './ShareToolbar';
import Byline from './Byline';
import { safe, relativeTime } from '../lib/format';

const SplitViewNewsCard: React.FC<{
  article: ArticleProps;
  isDeepLinked?: boolean;
  onClearDeepLink?: () => void;
}> = ({ article, isDeepLinked, onClearDeepLink }) => {
  const [showModal, setShowModal] = useState(false);
  const modalScrollRef = React.useRef(0);

  useEffect(() => {
    if (isDeepLinked) {
      setShowModal(true);
    }
  }, [isDeepLinked]);

  const handleCloseModal = () => {
    setShowModal(false);
    if (onClearDeepLink) onClearDeepLink();
  };

  const body = safe(article.article_body);
  const bodyParagraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const hasBody = bodyParagraphs.length > 0;

  // Pull quote: derive from the lede if a body exists, else the summary.
  const pullQuote = safe(article.reframed_summary) || bodyParagraphs[0] || '';

  // Build a clean article: hero image, byline, lede, takeaways, body, analysis.
  const renderArticleBody = () => {
    if (hasBody) {
      return bodyParagraphs.map((p, i) => (
        <p key={i} className="mb-5 text-[17px] leading-[1.75] text-zinc-200">{p}</p>
      ));
    }
    // Fallback to the source dispatch text when no prose body exists yet.
    const dump = safe(article.original_text_dump);
    const fallbackParas = dump.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).slice(0, 5);
    if (fallbackParas.length) {
      return fallbackParas.map((p, i) => (
        <p key={i} className="mb-5 text-[17px] leading-[1.75] text-zinc-300">{p}</p>
      ));
    }
    return null;
  };

  const takeaways = Array.isArray(article.key_takeaways) ? article.key_takeaways : [];
  const communityPoints = Array.isArray(article.what_this_means_for_us) ? article.what_this_means_for_us : [];

  return (
    <section className="group mb-12 overflow-hidden rounded-sm border border-zinc-900 bg-ink-900 transition-all duration-500 hover:border-zinc-800 hover:shadow-2xl">
      {/* Article header row */}
      <div className="flex items-center justify-between border-b border-zinc-900 bg-ink-750 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-amber-500 opacity-40"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Overlay Global Lens</span>
        </div>
        {article.source_name && (
          <a
            href={article.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {safe(article.source_name)} â†—
          </a>
        )}
      </div>

      <div className="px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
        {/* Eyebrow / section tag */}
        <span className="mb-4 inline-block text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">
          {safe(article.category).replace(/_/g, ' ')}
        </span>

        {/* Headline */}
        <h2 className="max-w-4xl font-serif font-semibold leading-[1.08] tracking-[-0.015em] text-white text-[2.25rem] sm:text-5xl lg:text-[3.4rem]">
          {safe(article.reframed_headline) || safe(article.original_title)}
        </h2>

        {/* Byline */}
        <div className="mt-6">
          <Byline desk={safe(article.category)} date={relativeTime(article.pub_date)} source={safe(article.source_name)} tone="bright" />
        </div>

        {/* Hero image */}
        {article.image_url && (
          <figure className="mt-8 mb-8">
            <div className="overflow-hidden rounded-sm border border-zinc-900 bg-zinc-950">
              <img
                src={article.image_url}
                alt={safe(article.reframed_headline)}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-auto object-cover max-h-[320px] md:max-h-[440px]"
              />
            </div>
            {(article.source_name || article.category) && (
              <figcaption className="mt-3 flex items-baseline gap-2 text-[11px] text-zinc-500">
                <span className="font-bold uppercase tracking-[0.2em]">{safe(article.category).replace(/_/g, ' ')}</span>
                {article.source_name && (
                  <>
                    <span className="text-zinc-700">Â·</span>
                    <span>Image via {safe(article.source_name)}</span>
                  </>
                )}
              </figcaption>
            )}
          </figure>
        )}

        {/* Lede */}
        {article.reframed_summary && (
          <p className="mb-8 max-w-3xl text-lg font-serif leading-relaxed text-zinc-300 sm:text-xl">
            {safe(article.reframed_summary)}
          </p>
        )}

        {/* Key Takeaways â€” prominent "at a glance" panel near the top */}
        {takeaways.length > 0 && (
          <aside className="mt-2 mb-10 max-w-3xl rounded-sm border border-amber-500/25 bg-gradient-to-br from-[#181307] to-[#0f0e0a] p-7">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-amber-500/15">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500">Key Takeaways</span>
              <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">At a glance</span>
            </div>
            <ol className="space-y-4">
              {takeaways.map((item, idx) => (
                <li key={idx} className="flex items-start gap-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[11px] font-black text-amber-400 font-mono">
                    {idx + 1}
                  </span>
                  <span className="text-[15px] leading-relaxed text-zinc-200">{safe(item)}</span>
                </li>
              ))}
            </ol>
          </aside>
        )}

        {/* Body */}
        <div className="max-w-3xl">
          {renderArticleBody()}

          {/* Pull quote â€” magazine styling */}
          {pullQuote && hasBody && (
            <blockquote className="my-10 border-l-3 border-amber-500/60 pl-6">
              <p className="font-serif text-2xl italic leading-snug text-zinc-100 sm:text-[1.7rem]">
                â€œ{pullQuote.length > 260 ? pullQuote.slice(0, 260).replace(/\s+\S*$/, '') + 'â€¦' : pullQuote}â€
              </p>
            </blockquote>
          )}
        </div>

        {/* Analysis callout */}
        {article.cultural_lens_analysis && (
          <div className="mt-10 max-w-3xl rounded-sm border-l-2 border-amber-500/60 bg-ink-800 p-6">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500">Analysis</span>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">{safe(article.cultural_lens_analysis)}</p>
          </div>
        )}

        {/* Community takeaways */}
        {communityPoints.length > 0 && (
          <div className="mt-8 max-w-3xl">
            <CommunityTakeawaysWidget takeaways={communityPoints} />
          </div>
        )}

        {/* Analytics rail — historical context loads on demand inside the insight panel */}
        {article.statistical_data && (
          <div className="mt-12 grid grid-cols-1 gap-6 border-t border-zinc-900 pt-10">
            <AnalyticsChart data={article.statistical_data} />
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-10 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between border-t border-zinc-900 pt-6">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-300 transition-all hover:bg-white hover:text-black hover:border-white"
          >
            Open insight panel
          </button>
          <div className="flex items-center gap-4 shrink-0">
            <BookmarkButton article={article} />
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest hidden sm:inline-block">Share</span>
            <ShareToolbar articleId={String(article.id || article.url_hash || "")} headline={safe(article.reframed_headline)} analysis={safe(article.cultural_lens_analysis)} />
          </div>
        </div>
      </div>

      {showModal && (
        <ArticleModal
          articleId={article.url_hash || article.id || 0}
          onClose={handleCloseModal}
          simplifiedText={safe(article.cultural_lens_analysis)}
          headline={safe(article.reframed_headline) || safe(article.original_title)}
          articleBody={safe(article.article_body)}
          takeaways={takeaways}
          initialScroll={modalScrollRef.current}
          onScrollChange={(val) => { modalScrollRef.current = val; }}
        />
      )}
    </section>
  );
}

export default SplitViewNewsCard;
