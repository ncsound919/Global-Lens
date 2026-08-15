import React from 'react';
import { ArticleProps, PaperProps, TrendProps, DiscoveryProps } from '../types';
import HeroStoryCard from './HeroStoryCard';
import SplitViewNewsCard from './SplitViewNewsCard';
import ResearchDeskRail from './ResearchDeskRail';
import { ErrorBoundary } from './ErrorBoundary';

interface FrontPageProps {
  articles: ArticleProps[];
  papers: PaperProps[];
  trends: TrendProps[];
  discoveries: DiscoveryProps[];
  onOpenPaper: (p: PaperProps) => void;
  onOpenTrend: (t: TrendProps) => void;
  onOpenDiscovery: (d: DiscoveryProps) => void;
}

export default function FrontPage({
  articles,
  papers,
  trends,
  discoveries,
  onOpenPaper,
  onOpenTrend,
  onOpenDiscovery,
}: FrontPageProps) {
  const [hero, ...rest] = articles;

  return (
    <div>
      {hero && <HeroStoryCard article={hero} />}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {rest.length > 0 ? (
            rest.map((article, index) => (
              <ErrorBoundary key={article.id || article.url_hash || index}>
                <SplitViewNewsCard article={article} />
              </ErrorBoundary>
            ))
          ) : (
            <p className="text-sm text-zinc-500">
              More from this edition will appear here as the sync processes the feed.
            </p>
          )}
        </div>

        <div className="lg:col-span-4">
          <ResearchDeskRail
            papers={papers}
            trends={trends}
            discoveries={discoveries}
            onOpenPaper={onOpenPaper}
            onOpenTrend={onOpenTrend}
            onOpenDiscovery={onOpenDiscovery}
          />
        </div>
      </div>
    </div>
  );
}
