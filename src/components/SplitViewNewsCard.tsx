import React, { useState } from 'react';
import { ArticleProps } from '../types';
import ArticleModal from './ArticleModal';
import CommunityTakeawaysWidget from './CommunityTakeawaysWidget';
import AnalyticsChart from './AnalyticsChart';

const SplitViewNewsCard: React.FC<{ article: ArticleProps }> = ({ article }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden mb-6">
      <div className="bg-zinc-800/50 px-6 py-3 border-b border-zinc-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
             Active Reframing Session
          </span>
        </div>
        <div className="flex gap-2 items-center">
           <button 
             onClick={() => setShowModal(true)}
             className="px-3 py-1 text-[10px] font-bold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-md transition-colors cursor-pointer uppercase border border-amber-500/20"
           >
             Historical Context Insights
           </button>
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 md:grid-cols-12 gap-8 relative overflow-hidden">
        {/* Primary View: Cultural Lens Analysis */}
        <div className="col-span-1 md:col-span-7 flex flex-col">
          {article.category && (
            <span className="text-amber-500 text-xs font-bold uppercase tracking-widest">
              {article.category.replace('_', ' ')}
            </span>
          )}
          <h2 className="text-3xl lg:text-4xl font-serif font-medium mt-4 mb-6 leading-[1.1] text-white tracking-tight">
            {article.reframed_headline}
          </h2>
          <p className="text-zinc-400 text-base lg:text-lg leading-relaxed mb-6 border-l-2 border-zinc-700 pl-6">
            {article.cultural_lens_analysis}
          </p>

          {article.what_this_means_for_us && article.what_this_means_for_us.length > 0 && (
            <div className="mb-8">
              <CommunityTakeawaysWidget takeaways={article.what_this_means_for_us} />
            </div>
          )}
          
          <div className="flex gap-4 flex-col md:flex-row mb-6">
            <div className="bg-zinc-800/50 p-4 rounded-xl flex-1 border border-zinc-700/50">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block mb-2">Key Takeaways</span>
              <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1">
                {article.key_takeaways.map((item, idx) => <li key={idx} className="mb-1">{item}</li>)}
              </ul>
            </div>
          </div>
          
          <div className="mt-auto pt-4 flex items-center border-t border-zinc-800/50">
            <span className="text-xs uppercase font-mono tracking-widest text-zinc-500 mr-2">Via {article.source_name}:</span>
            <a 
              href={article.original_url} 
              target="_blank" 
              rel="noreferrer" 
              className="text-xs text-blue-400 font-medium hover:text-blue-300 hover:underline transition-colors truncate max-w-[300px] lg:max-w-[400px]"
            >
              {article.original_title} ↗
            </a>
          </div>
        </div>

        {/* Analytics & Data View */}
        <div className="col-span-1 md:col-span-5 h-full">
           {article.statistical_data ? (
             <AnalyticsChart data={article.statistical_data} />
           ) : (
             <div className="bg-zinc-950/20 border border-zinc-800/50 rounded-xl p-6 h-full min-h-[200px] flex items-center justify-center">
                <div className="text-center">
                   <div className="w-10 h-10 mx-auto mb-3 bg-zinc-900 rounded-full flex items-center justify-center">
                     <span className="text-zinc-600 text-xs font-mono">-</span>
                   </div>
                   <p className="text-xs text-zinc-500 font-mono tracking-widest uppercase">No statistical data<br/>extracted for this event.</p>
                </div>
             </div>
           )}
        </div>
      </div>
      
      {showModal && (
        <ArticleModal 
          articleId={article.id || 0}
          onClose={() => setShowModal(false)}
          simplifiedText={article.cultural_lens_analysis}
          headline={article.reframed_headline}
        />
      )}
    </section>
  );
}

export default SplitViewNewsCard;
