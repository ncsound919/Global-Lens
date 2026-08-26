import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  RefreshCw,
  Settings as SettingsIcon,
  AlertCircle,
  WifiOff,
  Newspaper,
} from 'lucide-react';
import SplitViewNewsCard from './components/SplitViewNewsCard';
import SettingsDashboard from './components/SettingsDashboard';
import { PrivacyPolicyModal, TermsOfServiceModal } from './components/LegalModals';
import CookieConsent from './components/CookieConsent';
import { ArticleProps } from './types';

import AboutMission from './components/AboutMission';

import { ErrorBoundary } from './components/ErrorBoundary';
import CategoryNav from './components/CategoryNav';
import ContentViewNav, { ContentView } from './components/ContentViewNav';
import PaperCard from './components/PaperCard';
import TrendCard from './components/TrendCard';
import DiscoveryCard from './components/DiscoveryCard';
import EnvironmentSection from './components/EnvironmentSection';
import OncologyLanding from './components/OncologyLanding';
import Masthead from './components/Masthead';
import FrontPage from './components/FrontPage';
import PublicationFooter from './components/PublicationFooter';
import PublicationModal, { PublicationItem } from './components/PublicationModal';
import EvidenceLegend from './components/EvidenceLegend';
import { PaperProps, TrendProps, DiscoveryProps } from './types';
import { SAVED_ARTICLES_KEY } from './lib/constants';

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

  const [deepLinkedArticle, setDeepLinkedArticle] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [view, setView] = useState<ContentView>('news');
  const [papers, setPapers] = useState<PaperProps[]>([]);
  const [trends, setTrends] = useState<TrendProps[]>([]);
  const [discoveries, setDiscoveries] = useState<DiscoveryProps[]>([]);
  const [insightStatus, setInsightStatus] = useState<FetchStatus>('idle');
  const [insightError, setInsightError] = useState<string>('');
  const [pubModal, setPubModal] = useState<PublicationItem | null>(null);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('article');
    if (articleId) setDeepLinkedArticle(articleId);

    const path = window.location.pathname;
    if (path === '/privacy') setShowPrivacy(true);
    if (path === '/terms') setShowTerms(true);
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const insightLoadedRef = useRef(false);

  const pageTitle = useMemo(() => {
    if (view !== 'news') {
      if (view === 'environment') return 'Environmental Research';
      return view === 'papers' ? 'Research Papers' : view === 'trends' ? 'Trends & Insights' : 'Discoveries';
    }
    if (category === 'oncology') return 'Oncology Research';
    return category === 'all' ? 'Top Stories' : `${category.replace(/_/g, ' ')} News`;
  }, [view, category]);

  // Keep the browser tab title in sync with the active view/category.
  useEffect(() => {
    document.title = `Overlay Global Lens — ${pageTitle}`;
  }, [pageTitle]);

  const fetchInsights = useCallback(
    async (v: ContentView, mode: 'initial' | 'refresh' = 'initial') => {
      setInsightError('');
      setInsightStatus(insightLoadedRef.current ? 'refreshing' : 'loading');

      const endpoint =
        v === 'papers' ? '/api/papers?limit=24' : v === 'trends' ? '/api/trends?limit=24' : v === 'discoveries' ? '/api/discoveries?limit=24' : '/api/papers?pillar=environment&limit=24';

      try {
        const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        if (!res.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Invalid response");
        }
        const data = await res.json();
        if (v === 'papers') setPapers(Array.isArray(data?.papers) ? data.papers : []);
        if (v === 'trends') setTrends(Array.isArray(data?.trends) ? data.trends : []);
        if (v === 'discoveries') setDiscoveries(Array.isArray(data?.discoveries) ? data.discoveries : []);
        insightLoadedRef.current = true;
        setInsightStatus('success');
      } catch (err: any) {
        console.error(err);
        setInsightStatus('error');
        setInsightError('The research desk could not be reached right now.');
      }
    },
    []
  );

  useEffect(() => {
    if (view !== 'news') {
      fetchInsights(view, 'initial');
    }
  }, [view, fetchInsights]);

  // Prefetch research content on mount so the front-page Research Desk rail has data.
  useEffect(() => {
    fetchInsights('papers');
    fetchInsights('trends');
    fetchInsights('discoveries');
  }, [fetchInsights]);

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
        if (category === 'saved') {
           const savedData = localStorage.getItem(SAVED_ARTICLES_KEY);
           let nextArticles: ArticleProps[] = [];
           if (savedData) {
             try {
               const parsed = JSON.parse(savedData);
               nextArticles = Array.isArray(parsed) ? parsed : [];
             } catch {
               nextArticles = [];
             }
           }
           setArticles(nextArticles);
           setStatus('success');
           setLastUpdated(new Date());
           hasLoadedOnceRef.current = true;
           return;
        }

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

        if (!response.headers.get("content-type")?.includes("application/json")) {
           throw new Error("Invalid response");
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

  const renderInsightView = () => {
    const items = view === 'papers' ? papers : view === 'trends' ? trends : discoveries;

    if (insightStatus === 'loading' || insightStatus === 'idle') {
      return (
        <section aria-label="Loading intelligence" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-sm border border-zinc-900 bg-ink-900" />
          ))}
        </section>
      );
    }

    if (insightStatus === 'error') {
      return (
        <section className="rounded-sm border border-red-500/20 bg-ink-950 px-6 py-20 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/20 bg-zinc-950 text-red-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-serif tracking-wide text-white mb-2">Intelligence feed unavailable</h3>
          <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">{insightError}</p>
          <button
            onClick={() => fetchInsights(view, 'refresh')}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-red-500 transition-all hover:bg-red-500/20"
          >
            <RefreshCw className="h-4 w-4" />
            Retry request
          </button>
        </section>
      );
    }

    if (items.length === 0) {
      return (
        <section className="rounded-sm border border-zinc-900 bg-ink-900 px-6 py-20 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-400">
            <Newspaper className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-serif text-white mb-2">No {pageTitle.toLowerCase()} found</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
            New research items appear here as the publication desk processes them. Check back with the next edition.
          </p>
        </section>
      );
    }

    const open = (item: any) => {
      if (view === 'papers') setPubModal({ type: 'paper', item });
      else if (view === 'trends') setPubModal({ type: 'trend', item });
      else setPubModal({ type: 'discovery', item });
    };

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-sm border border-zinc-900 bg-ink-900 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-serif text-white">The Research Desk</h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
              Overlay Science Â· Overlay Writing Â· Overlay Sport
            </p>
          </div>
          <EvidenceLegend />
        </div>
        <section aria-live={insightStatus === 'refreshing' ? 'polite' : undefined} className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item: any) => (
            <ErrorBoundary key={item.id}>
              {view === 'papers' ? (
                <PaperCard paper={item} onOpen={() => open(item)} />
              ) : view === 'trends' ? (
                <TrendCard trend={item} onOpen={() => open(item)} />
              ) : (
                <DiscoveryCard discovery={item} onOpen={() => open(item)} />
              )}
            </ErrorBoundary>
          ))}
        </section>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-ink-950 text-zinc-100 font-sans flex flex-col selection:bg-amber-500 selection:text-black">
      <Masthead
        isOnline={isOnline}
        isRefreshing={isRefreshing}
        isLoading={isLoading}
        insightRefreshing={insightStatus === 'refreshing'}
        onRefresh={() => (view === 'news' ? fetchNews('refresh') : fetchInsights(view, 'refresh'))}
        onOpenSettings={() => setShowSettings(true)}
      />
      <header className="sticky top-0 z-30 border-b border-zinc-900/80 bg-ink-950 backdrop-blur-2xl">
        <ContentViewNav view={view} setView={setView} />
        {view === 'news' && <CategoryNav category={category} setCategory={setCategory} articles={articles} />}
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 sm:px-8 lg:px-12 py-8 sm:py-12">
        
        {view === 'news' && category === 'all' && <AboutMission />}
        <section className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-serif font-medium uppercase tracking-[0.16em] text-white sm:text-3xl">
              {pageTitle}
            </h2>
            {category === 'saved' && (
              <p className="mt-2 text-xs text-amber-500/80 font-mono tracking-wide">
                * Note: Saved articles are stored locally on this device. They will not sync across other devices or private browsing sessions.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 border border-zinc-900 bg-zinc-950 px-4 py-2 rounded-sm shadow-sm">
            <span className="relative flex h-1.5 w-1.5 mr-1">
              {isRefreshing && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75"></span>}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-amber-500' : 'bg-red-500'}`}></span>
            </span>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              {lastUpdated ? `Sync // ${lastUpdated.toLocaleTimeString()}` : 'Awaiting sync'}
            </div>
          </div>
        </section>

        {view === 'news' && category === 'oncology' ? (
          <OncologyLanding />
        ) : view !== 'news' && view !== 'environment' ? (
          renderInsightView()
        ) : view === 'environment' ? (
          <EnvironmentSection
            papers={papers}
            status={insightStatus}
            error={insightError}
            onOpenPaper={(p) => setPubModal({ type: 'paper', item: p })}
            onRefresh={() => fetchInsights('environment', 'refresh')}
          />
        ) : isLoading ? (
          <section
            aria-label="Loading stories"
            className="flex flex-col gap-12"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col overflow-hidden rounded-sm border border-zinc-900 bg-ink-900"
              >
                 <div className="h-14 border-b border-zinc-900 bg-ink-750 px-6" />
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
          <section className="rounded-sm border border-red-500/20 bg-ink-950 px-6 py-20 text-center">
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
          <section className="rounded-sm border border-zinc-900 bg-ink-900 px-6 py-20 text-center">
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
                className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
              >
                <SettingsIcon className="h-3.5 w-3.5" />
                Open settings
              </button>
            </div>
          </section>
        ) : category === 'all' ? (
          <div className="relative">
            {isRefreshing && (
              <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300 backdrop-blur">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Updating feed
              </div>
            )}
            <FrontPage
              articles={articles}
              papers={papers}
              trends={trends}
              discoveries={discoveries}
              onOpenPaper={(p) => setPubModal({ type: 'paper', item: p })}
              onOpenTrend={(t) => setPubModal({ type: 'trend', item: t })}
              onOpenDiscovery={(d) => setPubModal({ type: 'discovery', item: d })}
            />
          </div>
        ) : (
          <section
            aria-live={isRefreshing ? 'polite' : undefined}
            className="relative flex flex-col gap-6"
          >
            {isRefreshing && (
              <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300 backdrop-blur">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Updating feed
              </div>
            )}

            {articles.map((article: ArticleProps, index) => (
              <ErrorBoundary key={article.id || article.url_hash || index}>
                <SplitViewNewsCard
                  article={article}
                  isDeepLinked={deepLinkedArticle === String(article.id) || deepLinkedArticle === article.url_hash}
                  onClearDeepLink={() => {
                    setDeepLinkedArticle(null);
                    window.history.replaceState({}, document.title, "/");
                  }}
                />
              </ErrorBoundary>
            ))}
          </section>
        )}
      </main>

      <PublicationFooter
        onOpenPrivacy={() => setShowPrivacy(true)}
        onOpenTerms={() => setShowTerms(true)}
        onSelectSection={(s) => {
          const key = ({ News: 'news', Research: 'papers', Environment: 'environment', Trends: 'trends', Discoveries: 'discoveries' } as Record<string, ContentView>)[s];
          if (key) setView(key);
        }}
      />

      {showSettings && <SettingsDashboard onClose={() => setShowSettings(false)} />}
      {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
      {showTerms && <TermsOfServiceModal onClose={() => setShowTerms(false)} />}
      {pubModal && <PublicationModal data={pubModal} onClose={() => setPubModal(null)} />}
      <CookieConsent />
    </div>
  );
}