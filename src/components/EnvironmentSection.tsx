import { Leaf, RefreshCw, AlertCircle, FlaskConical, Recycle, Sun, Droplets, Waves, Cpu, Wind, Sprout, Home, Factory, Lightbulb, Zap, Atom } from 'lucide-react';
import PaperCard from './PaperCard';
import EvidenceLegend from './EvidenceLegend';
import { PaperProps } from '../types';

// The 13 ECOS environmental initiatives â€” each is a research sector.
export const ENVIRONMENT_SECTORS = [
  { key: 'env-ecohomes', project: 'P01', name: 'EcoHomes OS', icon: Home },
  { key: 'env-agriconnect', project: 'P02', name: 'AgriConnect', icon: Sprout },
  { key: 'env-regenerafarm', project: 'P03', name: 'RegeneraFarm', icon: Leaf },
  { key: 'env-hempmobility', project: 'P04', name: 'HempMobility', icon: Factory },
  { key: 'env-lumifreq', project: 'P05', name: 'LumiFreq', icon: Lightbulb },
  { key: 'env-nucleosim', project: 'P06', name: 'NucleoSim', icon: Atom },
  { key: 'env-plasticycle', project: 'P07', name: 'PlastiCycle', icon: Recycle },
  { key: 'env-everlume', project: 'P08', name: 'EverLume', icon: Zap },
  { key: 'env-aquagen', project: 'P09', name: 'AquaGen', icon: Droplets },
  { key: 'env-thermalgrid', project: 'P10', name: 'ThermalGrid', icon: Cpu },
  { key: 'env-thoriumos', project: 'P11', name: 'ThoriumOS', icon: Wind },
  { key: 'env-solarshare', project: 'P12', name: 'SolarShare', icon: Sun },
  { key: 'env-microhydro', project: 'P13', name: 'MicroHydro', icon: Waves },
] as const;

interface EnvironmentSectionProps {
  papers: PaperProps[];
  status: 'idle' | 'loading' | 'refreshing' | 'success' | 'error';
  error?: string;
  onOpenPaper: (p: PaperProps) => void;
  onRefresh: () => void;
}

export default function EnvironmentSection({ papers, status, error, onOpenPaper, onRefresh }: EnvironmentSectionProps) {
  const bySector = (sector: string) => papers.filter((p) => p.id === `synthesis-${sector}` || String(p.id).startsWith(sector));
  const sectorsWithPapers = ENVIRONMENT_SECTORS.filter((s) => bySector(s.key).length > 0);
  const noSectors = sectorsWithPapers.length === 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Section banner */}
      <div className="rounded-sm border border-emerald-900/40 bg-gradient-to-br from-[#0c160f] to-[#0a0a0a] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Leaf className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-serif text-white">Environmental Research Desk</h3>
<p className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-500">
              13 Sectors · ECOS Environmental Initiatives · Ongoing Research
            </p>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400">
          The Environmental section tracks thirteen environmental initiatives — foam housing, mycorrhizal
          agriculture, closed-loop farming, biocomposites, resonant illumination, reactor twins, plastic-eating
          bacteria, long-life lighting, atmospheric water, geothermal district heat, thorium fuel cycles, community
          solar and micro-hydro. Each sector runs deterministic simulations through the Overlay Science engines
          and reports measured, evidence-tiered findings as full papers.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {ENVIRONMENT_SECTORS.map((s) => {
            const Icon = s.icon;
            const count = bySector(s.key).length;
            return (
              <a
                key={s.key}
                href={`#${s.key}`}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 transition-all hover:border-emerald-500/40 hover:text-emerald-300"
              >
                <Icon className="h-3 w-3" />
                {s.project} · {s.name}
                <span className={`rounded-full px-1.5 text-[9px] ${count ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>{count}</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Status handling */}
      {status === 'loading' || status === 'idle' ? (
        <section aria-label="Loading environmental research" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-sm border border-zinc-900 bg-ink-900" />
          ))}
        </section>
      ) : status === 'error' ? (
        <section className="rounded-sm border border-red-500/20 bg-ink-950 px-6 py-20 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/20 bg-zinc-950 text-red-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-serif tracking-wide text-white mb-2">Environmental research unavailable</h3>
          <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">{error || 'The environmental research desk could not be reached.'}</p>
          <button
            onClick={onRefresh}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-red-500 transition-all hover:bg-red-500/20"
          >
            <RefreshCw className="h-4 w-4" />
            Retry request
          </button>
        </section>
      ) : noSectors ? (
        <section className="rounded-sm border border-zinc-900 bg-ink-900 px-6 py-20 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-emerald-400">
            <FlaskConical className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-serif text-white mb-2">Environmental research in progress</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            The environmental sectors are running their first deterministic research cycles. Papers will appear here
            as the daily synthesis completes.
          </p>
          <button
            onClick={onRefresh}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-500 transition-all hover:bg-emerald-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh sectors
          </button>
        </section>
      ) : (
        <div className="flex flex-col gap-10">
          {ENVIRONMENT_SECTORS.map((s) => {
            const Icon = s.icon;
            const sectorPapers = bySector(s.key);
            if (!sectorPapers.length) return null;
            return (
              <section key={s.key} id={s.key} className="scroll-mt-24">
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-900 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-lg font-serif text-white">{s.project} · {s.name}</h3>
                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500">Environmental Sector</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <EvidenceLegend />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {sectorPapers.map((paper) => (
                    <PaperCard key={paper.id} paper={paper} onOpen={() => onOpenPaper(paper)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
