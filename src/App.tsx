import React, { useEffect, useState } from 'react';
import { RefreshCw, LayoutTemplate, Settings as SettingsIcon } from 'lucide-react';
import SplitViewNewsCard from './components/SplitViewNewsCard';
import SettingsDashboard from './components/SettingsDashboard';
import { ArticleProps } from './types';

export default function App() {
  const [articles, setArticles] = useState<ArticleProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('all');
  const [showSettings, setShowSettings] = useState(false);

  const fetchNews = async () => {
    setLoading(true);
    try {
      let sid = localStorage.getItem('session_id') || 'default_session';
      const response = await fetch(`/api/news?category=${category}`, {
        headers: { 'x-session-id': sid }
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setArticles(data.articles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    
    const handleSettingsUpdated = () => {
      fetchNews();
    };
    window.addEventListener('settings-updated', handleSettingsUpdated);
    return () => window.removeEventListener('settings-updated', handleSettingsUpdated);
  }, [category]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans select-none flex flex-col p-4 w-full">
      {/* Header Navigation */}
      <header className="flex items-center justify-between mb-6 px-2 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.4)]">
            <LayoutTemplate className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none text-white">GLOBAL LENS</h1>
          </div>
        </div>
        
        <div className="flex gap-6 items-center">
          <nav className="flex space-x-2 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-full overflow-x-auto no-scrollbar">
            {['all', 'global', 'africa', 'diaspora', 'caribbean', 'finance', 'culture'].map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors cursor-pointer uppercase tracking-widest ${
                  category === c 
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {c.replace('_', ' ')}
              </button>
            ))}
          </nav>

          <button 
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
             <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full flex-1 mb-8 mt-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-serif font-medium tracking-tight text-white uppercase tracking-widest">
              {category === 'all' ? 'Top Stories' : `${category.replace('_', ' ')} News`}
            </h2>
            <p className="text-sm text-zinc-500 mt-1 font-mono tracking-wide">
              PIPELINE // ALL ITEMS FILTERED & REFRAMED
            </p>
          </div>
          <button 
            onClick={fetchNews}
            disabled={loading}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer uppercase flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse bg-zinc-900/50 border border-zinc-800 rounded-2xl h-80 w-full"></div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
            <h3 className="text-lg font-medium text-white mb-2 tracking-wide">NO STORIES FOUND</h3>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">AWAITING INGESTION SYNC...</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-6">
            {articles.map((article: ArticleProps, index) => (
              <SplitViewNewsCard key={article.id || article.url_hash || index} article={article} />
            ))}
          </div>
        )}
      </main>

      {showSettings && <SettingsDashboard onClose={() => setShowSettings(false)} />}
    </div>
  );
}
