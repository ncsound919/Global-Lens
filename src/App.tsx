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
  'africa',
  'diaspora',
  'caribbean',
  'finance',
  'culture',
] as const;

type FetchStatus = 'idle' | 'loading' | 'refreshing' | 'success' | 'error';

export default function App() {
  const [articles, setArticles] = useState<ArticleProps[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [category, setCategory] = useState<string>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const pageTitle = useMemo(() => {
    return category === 'all' ? 'Top Stories' : `${category.replace('_', ' ')} News`;
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
          navigator.onLine
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

    window.addEventListener('settings-updated', handleSettingsUpdated);

    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdated);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchNews]);

  const isLoading = status === 'loading';
  const isRefreshing = status === 'refreshing';
  const hasArticles = articles.length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-900/80 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-black shadow-[0_0_24px_rgba(245,158,11,0.28)] ring-1 ring-amber-300/20">
              <LayoutTemplate className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-[0.24em] text-white sm:text-xl">
                GLOBAL LENS
              </h1>
              <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-zinc-500 sm:text-[11px]">
                Contextual news intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => fetchNews('refresh')}
              disabled={isLoading || isRefreshing}
              aria-label="Refresh stories"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Queue</span>
            </button>

            <button
              onClick={() => setShowSettings(true)}
              aria-label="Open settings"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pb-4">
          <nav
            aria-label="News categories"
            className="flex gap-2 overflow-x-auto rounded-full border border-zinc-800 bg-zinc-900/70 p-1 no-scrollbar"
          >
            {CATEGORIES.map((c) => {
              const active = category === c;

              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  aria-pressed={active}
                  className={`whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
                    active
                      ? 'border border-zinc-700 bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {c.replace('_', ' ')}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:py-8">
        <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-serif font-medium uppercase tracking-[0.16em] text-white sm:text-3xl">
              {pageTitle}
            </h2>
          </div>

          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            {lastUpdated ? `Last update // ${lastUpdated.toLocaleTimeString()}` : 'Awaiting first sync'}
          </div>
        </section>

        {isLoading ? (
          <section
            aria-label="Loading stories"
            className="flex flex-col gap-6"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-80 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/50"
              />
            ))}
          </section>
        ) : status === 'error' ? (
          <section className="rounded-3xl border border-red-500/20 bg-red-500/5 px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/20 bg-zinc-900 text-red-300">
              {navigator.onLine ? (
                <AlertCircle className="h-6 w-6" />
              ) : (
                <WifiOff className="h-6 w-6" />
              )}
            </div>

            <h3 className="text-lg font-semibold uppercase tracking-[0.14em] text-white">
              Feed unavailable
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">
              {errorMessage || 'Something went wrong while loading the latest stories.'}
            </p>

            <button
              onClick={() => fetchNews('refresh')}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-200 transition hover:bg-zinc-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry request
            </button>
          </section>
        ) : !hasArticles ? (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300">
              <Newspaper className="h-6 w-6" />
            </div>

            <h3 className="text-lg font-semibold uppercase tracking-[0.14em] text-white">
              No stories found
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-zinc-500">
              This category is empty right now, or the background sync has not finished processing
              new articles yet.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => fetchNews('refresh')}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-200 transition hover:bg-zinc-800"
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