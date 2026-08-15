import React, { useState, useEffect } from 'react';
import { ArticleProps } from '../types';
import ArticleModal from './ArticleModal';
import CommunityTakeawaysWidget from './CommunityTakeawaysWidget';
import AnalyticsChart from './AnalyticsChart';
import InlineHistoricalContext from './InlineHistoricalContext';
import BookmarkButton from './BookmarkButton';
import ShareToolbar from './ShareToolbar';
import Byline from './Byline';

const safe = (val: any): string => {
  if (typeof val === 'string') return val;
  if (val === null || val === undefined) return '';
  return JSON.stringify(val);
};

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

  const getRelativeTime = (date: string) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffInMinutes < 60) return `${Math.max(1, diffInMinutes)}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const body = safe(article.article_body);
  const bodyParagraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const hasBody = bodyParagraphs.length > 0;

  // Build a clean article: hero image, byline, lede, body paragraphs, analysis.
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

  return (
    <section className="group mb-12 overflow-hidden rounded-sm border border-zinc-900 bg-[#0c0c0c] transition-all duration-500 hover:border-zinc-800 hover:shadow-2xl">
      {/* Article header row */}
      <div className="flex items-center justify-between border-b border-zinc-900 bg-[#080808] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-amber-500 opacity-40"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">{safe(article.category).replace(/_/g, ' ')}</span>
          <span className="text-zinc-700">/</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Overlay Global Lens</span>
        </div>
        {article.source_name && (
          <a
            href={article.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {safe(article.source_name)} ↗
          </a>
        )}
      </div>

      <div className="px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
        {/* Headline */}
        <h2 className="max-w-4xl text-3xl font-serif font-medium leading-[1.12] text-white sm:text-4xl lg:text-[3.25rem]">
          {safe(article.reframed_headline) || safe(article.original_title)}
        </h2>

        {/* Byline */}
        <div className="mt-5">
          <Byline desk={safe(article.category)} date={getRelativeTime(article.pub_date)} source={safe(article.source_name)} tone="bright" />
        </div>

        {/* Hero image */}
        {article.image_url && (
          <div className="mt-8 mb-8 overflow-hidden rounded-sm border border-zinc-900 bg-zinc-950">
            <img
              src={article.image_url}
              alt={safe(article.reframed_headline)}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-auto object-cover max-h-[320px] md:max-h-[440px]"
            />
          </div>
        )}

        {/* Lede */}
        {article.reframed_summary && (
          <p className="mb-8 max-w-3xl text-lg font-serif leading-relaxed text-zinc-300 sm:text-xl">
            {safe(article.reframed_summary)}
          </p>
        )}

        {/* Body */}
        <div className="max-w-3xl">
          {renderArticleBody()}
        </div>

        {/* Analysis callout */}
        {article.cultural_lens_analysis && (
          <div className="mt-10 max-w-3xl rounded-sm border-l-2 border-amber-500/60 bg-[#111111] p-6">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500">Analysis</span>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">{safe(article.cultural_lens_analysis)}</p>
          </div>
        )}

        {/* Takeaways */}
        {article.key_takeaways && article.key_takeaways.length > 0 && (
          <div className="mt-8 max-w-3xl">
            <span className="text-[10px] text-zinc-500 uppercase flex items-center gap-2 font-bold tracking-[0.2em] mb-4">
              <span className="w-1 h-3 bg-amber-500 block"></span>
              Key Takeaways
            </span>
            <ul className="list-none text-zinc-400 space-y-3">
              {article.key_takeaways.map((item, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-zinc-600 mr-3 mt-1 inline-block text-[10px]">■</span>
                  {safe(item)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Community takeaways */}
        {article.what_this_means_for_us && article.what_this_means_for_us.length > 0 && (
          <div className="mt-8 max-w-3xl">
            <CommunityTakeawaysWidget takeaways={article.what_this_means_for_us} />
          </div>
        )}

        {/* Analytics + historical context rail */}
        {(article.statistical_data || true) && (
          <div className="mt-12 grid grid-cols-1 gap-6 border-t border-zinc-900 pt-10 lg:grid-cols-2">
            {article.statistical_data && <AnalyticsChart data={article.statistical_data} />}
            <InlineHistoricalContext articleId={article.url_hash || article.id || 0} />
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-10 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between border-t border-zinc-900 pt-6">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-zinc-300 transition-all hover:bg-white hover:text-black hover:border-white"
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
          initialScroll={modalScrollRef.current}
          onScrollChange={(val) => { modalScrollRef.current = val; }}
        />
      )}
    </section>
  );
}

export default SplitViewNewsCard;
