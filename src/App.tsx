import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  RefreshCw,
  LayoutTemplate,
  Settings as SettingsIcon,
  AlertCircle,
  WifiOff,
  Newspaper,
} from 'lucide-react';
import SplitViewNewsCard from './components/SplitViewNewsCard';
import SettingsDashboard from './components/SettingsDashboard';
import { ArticleProps } from './types';

const CATEGORIES = [
  'all',
  'global',
  'politics',
  'diaspora',
  'finance',
  'culture',
  'health',
  'music',
  'sports'
] as const;

type FetchStatus = 'idle' | 'loading' | 'refreshing' | 'success' | 'error';

export default function App() {
  const [articles, setArticles] = useState<ArticleProps[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [category, setCategory] = useState<string>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const isOnlineRef = useRef(isOnline);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const pageTitle = useMemo(() => {
    return category === 'all' ? 'Top Stories' : `${category.replace(/_/g, ' ')} News`;
  }, [category]);

  const fetchNews = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      const isFirstLoad = !hasLoadedOnceRef.current;
      setStatus(isFirstLoad ? 'loading' : mode === 'refresh' ? 'refreshing' : 'loading');
      setErrorMessage('');

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(
          `/api/news?category=${encodeURIComponent(category)}&limit=20`,
          {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        const nextArticles = Array.isArray(data?.articles) ? data.articles : [];

        setArticles(nextArticles);
        setStatus('success');
        setLastUpdated(new Date());
        hasLoadedOnceRef.current = true;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;

        console.error(err);
        setStatus('error');
        setErrorMessage(
          isOnlineRef.current
            ? 'The news pipeline could not be reached right now.'
            : 'You appear to be offline.'
        );
      }
    },
    [category]
  );

  useEffect(() => {
    fetchNews('initial');

    const handleSettingsUpdated = () => {
      fetchNews('refresh');
    };
    
    const handleOnline = () => {
       setIsOnline(true);
       if (hasLoadedOnceRef.current) {
          fetchNews('refresh');
       } else {
          fetchNews('initial');
       }
    };
    
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('settings-updated', handleSettingsUpdated);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdated);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchNews]);

  const isLoading = status === 'loading';
  const isRefreshing = status === 'refreshing';
  const hasArticles = articles.length > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans flex flex-col selection:bg-amber-500 selection:text-black">
      <header className="sticky top-0 z-30 border-b border-zinc-900/80 bg-[#0a0a0a] backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-5 sm:px-8 lg:px-12">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-zinc-100 text-black shadow-[0_0_24px_rgba(255,255,255,0.08)]">
              <LayoutTemplate className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-xl lg:text-2xl font-serif tracking-tight text-white mb-0.5">
                Black Global Lens
              </h1>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-amber-500">
                Contextual News Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchNews('refresh')}
              disabled={isLoading || isRefreshing}
              aria-label="Refresh stories"
              className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 px-5 text-[11px] font-bold uppercase tracking-widest text-zinc-300 transition-all hover:bg-white hover:text-black hover:border-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline sm:ml-2">Sync</span>
            </button>

            <button
              onClick={() => setShowSettings(true)}
              aria-label="Open settings"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition-all hover:bg-white hover:text-black hover:border-white"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

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
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 sm:px-8 lg:px-12 py-8 sm:py-12">
        <section className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-serif font-medium uppercase tracking-[0.16em] text-white sm:text-3xl">
              {pageTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2 border border-zinc-900 bg-zinc-950 px-4 py-2 rounded-sm shadow-sm">
            <span className="relative flex h-1.5 w-1.5 mr-1">
              {isRefreshing && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75"></span>}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isOnline ? (isRefreshing ? 'bg-amber-500' : 'bg-amber-500') : 'bg-red-500'}`}></span>
            </span>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              {lastUpdated ? `Sync // ${lastUpdated.toLocaleTimeString()}` : 'Awaiting sync'}
            </div>
          </div>
        </section>

        {isLoading ? (
          <section
            aria-label="Loading stories"
            className="flex flex-col gap-12"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col overflow-hidden rounded-sm border border-zinc-900 bg-[#0c0c0c]"
              >
                 <div className="h-14 border-b border-zinc-900 bg-[#080808] px-6" />
                 <div className="p-8 lg:p-12">
                   <div className="h-3 w-24 animate-pulse rounded-sm bg-zinc-900" />
                   <div className="mt-8 space-y-4">
                     <div className="h-10 w-3/4 animate-pulse rounded-sm bg-zinc-900" />
                     <div className="h-10 w-1/2 animate-pulse rounded-sm bg-zinc-900" />
                   </div>
                   <div className="mt-12 space-y-4">
                     <div className="h-4 w-full animate-pulse rounded-sm bg-zinc-900" />
                     <div className="h-4 w-full animate-pulse rounded-sm bg-zinc-900" />
                     <div className="h-4 w-2/3 animate-pulse rounded-sm bg-zinc-900" />
                   </div>
                 </div>
              </div>
            ))}
          </section>
        ) : status === 'error' ? (
          <section className="rounded-sm border border-red-500/20 bg-[#0a0a0a] px-6 py-20 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/20 bg-zinc-950 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
              {isOnline ? (
                <AlertCircle className="h-6 w-6" />
              ) : (
                <WifiOff className="h-6 w-6" />
              )}
            </div>

            <h3 className="text-lg font-serif tracking-wide text-white mb-2">
              Feed unavailable
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">
              {errorMessage || 'Something went wrong while loading the latest stories.'}
            </p>

            <button
              onClick={() => fetchNews('refresh')}
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-red-500 transition-all hover:bg-red-500/20"
            >
              <RefreshCw className="h-4 w-4" />
              Retry request
            </button>
          </section>
        ) : !hasArticles ? (
          <section className="rounded-sm border border-zinc-900 bg-[#0c0c0c] px-6 py-20 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-400">
              <Newspaper className="h-6 w-6" />
            </div>

            <h3 className="text-xl font-serif text-white mb-2">
              No stories found
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
              This category is currently empty, or the background sync has not finished processing
              new articles yet.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => fetchNews('refresh')}
                className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-500 transition-all hover:bg-amber-500/20"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh queue
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
              >
                <SettingsIcon className="h-3.5 w-3.5" />
                Open settings
              </button>
            </div>
          </section>
        ) : (
          <section
            aria-live={isRefreshing ? 'polite' : undefined}
            className="relative flex flex-col gap-6"
          >
            {isRefreshing && (
              <div className="sticky top-[104px] z-20 mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300 backdrop-blur">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Updating feed
              </div>
            )}

            {articles.map((article: ArticleProps, index) => (
              <SplitViewNewsCard
                key={article.id || article.url_hash || index}
                article={article}
              />
            ))}
          </section>
        )}
      </main>

      {showSettings && <SettingsDashboard onClose={() => setShowSettings(false)} />}
    </div>
  );
}