import { RefreshCw, Settings as SettingsIcon } from 'lucide-react';

interface MastheadProps {
  isOnline: boolean;
  isRefreshing: boolean;
  isLoading: boolean;
  insightRefreshing: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export default function Masthead({ isOnline, isRefreshing, isLoading, insightRefreshing, onRefresh, onOpenSettings }: MastheadProps) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const busy = isLoading || isRefreshing || insightRefreshing;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 pb-5 pt-8 sm:px-8 lg:px-12">
      <div className="flex flex-col-reverse gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-3xl font-serif tracking-tight text-white lg:text-4xl">Overlay Global Lens</h1>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.25em] text-amber-500 lg:inline">
              An Overlay365 Publication
            </span>
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400">
            Research Â· News Â· Intelligence
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          <div className="flex items-center gap-3">
            <button
              onClick={onRefresh}
              disabled={busy}
              aria-label="Refresh content"
              className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 px-5 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-300 transition-all hover:bg-white hover:text-black hover:border-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline sm:ml-2">Refresh</span>
            </button>
            <button
              onClick={onOpenSettings}
              aria-label="Open settings"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition-all hover:bg-white hover:text-black hover:border-white"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isOnline ? 'bg-amber-500' : 'bg-red-500'}`} />
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-amber-500' : 'bg-red-500'}`} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              {today} Â· Global Edition
            </span>
          </div>
        </div>
      </div>
      <div className="h-px w-full bg-zinc-900" />
    </div>
  );
}
