import React, { useState, useEffect } from 'react';
import { ArticleProps } from '../types';
import ArticleModal from './ArticleModal';
import CommunityTakeawaysWidget from './CommunityTakeawaysWidget';
import AnalyticsChart from './AnalyticsChart';
import InlineHistoricalContext from './InlineHistoricalContext';
import BookmarkButton from './BookmarkButton';
import ShareToolbar from './ShareToolbar';

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

  const wordCount = (safe(article.cultural_lens_analysis)?.length || 0) + (article.key_takeaways?.join(' ')?.length || 0);
  const readTime = Math.max(1, Math.ceil(wordCount / 1000));

  const getIntensityBars = (intensity: string) => {
    switch(intensity) {
      case 'pan_african': case 'marxist': case 'decolonial': return 3;
      case 'hyper_local': case 'indigenous': return 2;
      default: return 1;
    }
  };
  const bars = getIntensityBars(article.lens_intensity || 'balanced');

  return (
    <section className="group mb-12 flex flex-col overflow-hidden rounded-sm border border-zinc-900 bg-[#0c0c0c] transition-all duration-500 hover:border-zinc-800 hover:shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-900 bg-[#080808] px-6 py-4 transition-colors group-hover:bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-amber-500 opacity-40"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
             <span>Editorial Reframing</span>
             <span className="flex gap-0.5 ml-2">
               {[1,2,3].map(i => (
                 <span key={i} className={`w-1 h-2 rounded-[1px] ${i <= bars ? 'bg-amber-500' : 'bg-zinc-800'}`}></span>
               ))}
             </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
           {article.statistical_data && (
             <button 
               onClick={() => setShowModal(true)}
               className="cursor-pointer rounded-full border border-zinc-800 bg-zinc-950 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 transition-all hover:bg-white hover:text-black hover:border-white"
             >
               Historical Context
             </button>
           )}
        </div>
      </div>

      <div className="relative grid grid-cols-1 gap-10 overflow-hidden p-8 md:grid-cols-12 lg:p-12">
        {/* Primary View: Cultural Lens Analysis */}
        <div className="col-span-1 flex flex-col md:col-span-7">
          {article.category && (
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500">
                {article.category.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                ~{readTime} min read
              </span>
            </div>
          )}
          <h2 className="mt-2 mb-6 text-3xl font-medium leading-[1.1] text-white font-serif md:text-4xl lg:text-[3.25rem] break-words">
            {safe(article.reframed_headline)}
          </h2>
          
          {article.reframed_summary && (
            <p className="mb-8 text-zinc-400 text-lg md:text-xl font-sans leading-relaxed">
              {safe(article.reframed_summary)}
            </p>
          )}
          
          {article.image_url && (
            <div className="mb-8 rounded-sm overflow-hidden border border-zinc-900 bg-zinc-950">
               <img src={article.image_url} alt={article.reframed_headline} loading="lazy" className="w-full h-auto object-cover max-h-[250px] md:max-h-[400px] hover:scale-105 transition-transform duration-700" referrerPolicy="no-referrer" />
            </div>
          )}

          <div className="mb-10 lg:pr-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
                Contextual Analysis
              </span>
              <div className="h-px flex-1 bg-zinc-900"></div>
              <span className="flex h-2 w-2 rounded-full bg-amber-500 shrink-0"></span>
            </div>
            <p className="text-zinc-200 text-xl lg:text-2xl font-serif leading-[1.6]">
              {safe(article.cultural_lens_analysis)}
            </p>
            <p className="text-[10px] text-zinc-600 font-mono tracking-widest mt-6 pt-4 border-t border-zinc-900">
              SOURCE // <a href={article.original_url} target="_blank" rel="noopener noreferrer"
                className="hover:text-zinc-400 transition-colors mr-1 underline-offset-2 hover:underline">
                {article.source_name}
              </a>
            </p>
          </div>

          {article.what_this_means_for_us && article.what_this_means_for_us.length > 0 && (
            <div className="mb-10 lg:pr-8">
              <CommunityTakeawaysWidget takeaways={article.what_this_means_for_us} />
            </div>
          )}
          
          <div className="flex gap-4 flex-col md:flex-row mb-8 lg:pr-8">
            <div className="bg-[#111111] p-6 text-sm leading-relaxed rounded-sm flex-1 border border-zinc-900">
              <span className="text-[10px] text-zinc-500 uppercase flex items-center gap-2 font-bold tracking-[0.2em] mb-4">
                <span className="w-1 h-3 bg-amber-500 block"></span>
                Key Takeaways
              </span>
              <ul className="list-none text-zinc-400 space-y-3">
                {(article.key_takeaways && article.key_takeaways.length > 0) ? (
                  article.key_takeaways.map((item, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-zinc-600 mr-3 mt-1 inline-block text-[10px]">■</span>
                      {safe(item)}
                    </li>
                  ))
                ) : (
                  <li className="flex items-start text-zinc-600 italic text-sm">Key takeaways are not available for this article.</li>
                )}
              </ul>
            </div>
          </div>
          
          <div className="mt-auto pt-6 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between border-t border-zinc-900 lg:pr-8">
            <div className="flex flex-wrap items-center min-w-0 gap-3">
              <div className="flex items-center min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-600 mr-2 shrink-0">Source /</span>
                <a 
                  href={article.original_url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[11px] uppercase tracking-widest text-zinc-300 hover:text-white transition-colors truncate max-w-[150px] lg:max-w-[200px] border-b border-zinc-800 hover:border-zinc-500 pb-0.5"
                >
                  {article.source_name}
                </a>
              </div>
              {article.bias && (
                <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-sm">
                  {article.bias}
                </span>
              )}
              {article.pub_date && (
                <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-600">
                  • {getRelativeTime(article.pub_date)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
               <BookmarkButton article={article} />
               <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest hidden sm:inline-block">Share</span>
               <ShareToolbar articleId={String(article.id || article.url_hash || "")} headline={safe(article.reframed_headline)} analysis={safe(article.cultural_lens_analysis)} />
            </div>
          </div>
        </div>

        {/* Analytics & Data View */}
        <div className="col-span-1 md:col-span-5 h-full flex flex-col gap-6">
           {article.statistical_data && (
             <AnalyticsChart data={article.statistical_data} />
           )}
           <InlineHistoricalContext articleId={article.id || 0} />
        </div>
      </div>
      
      {showModal && (
        <ArticleModal 
          articleId={article.id || 0}
          onClose={handleCloseModal}
          simplifiedText={safe(article.cultural_lens_analysis)}
          headline={safe(article.reframed_headline)}
          initialScroll={modalScrollRef.current}
          onScrollChange={(val) => { modalScrollRef.current = val; }}
        />
      )}
    </section>
  );
}

export default SplitViewNewsCard;
