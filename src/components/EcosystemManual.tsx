import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Layers,
  Link2,
  Network,
  ShieldCheck,
  Target,
} from 'lucide-react';
import {
  MANUAL_SITES,
  STATUS_META,
  getManualSite,
  type ManualSite,
} from '../lib/manual';

const ACCENT: Record<ManualSite['accent'], { text: string; border: string; bg: string; bar: string; glow: string }> = {
  teal: {
    text: 'text-teal-300',
    border: 'border-teal-500/40',
    bg: 'bg-teal-500/10',
    bar: 'bg-teal-400',
    glow: 'shadow-[0_0_30px_rgba(45,212,191,0.15)]',
  },
  gold: {
    text: 'text-amber-300',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    bar: 'bg-amber-400',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.15)]',
  },
  cyan: {
    text: 'text-cyan-300',
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-500/10',
    bar: 'bg-cyan-400',
    glow: 'shadow-[0_0_30px_rgba(34,211,238,0.15)]',
  },
};

const STEP_DEFS = [
  { key: 'mission', label: 'Mission', icon: Target },
  { key: 'components', label: 'Components', icon: Layers },
  { key: 'architecture', label: 'Architecture', icon: Network },
  { key: 'connections', label: 'Connections', icon: Link2 },
  { key: 'honesty', label: 'Real vs planned', icon: ShieldCheck },
  { key: 'enter', label: 'Go deeper', icon: ArrowUpRight },
] as const;

type StepKey = (typeof STEP_DEFS)[number]['key'];

function readSiteFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.hash.match(/^#manual\/?([a-z-]*)/i);
  return match?.[1] || null;
}

interface EcosystemManualProps {
  initialSiteId?: string | null;
}

export default function EcosystemManual({ initialSiteId }: EcosystemManualProps) {
  const [siteId, setSiteId] = useState<string>(() => {
    const fromHash = readSiteFromHash();
    return (fromHash && getManualSite(fromHash)?.id) || initialSiteId || MANUAL_SITES[0].id;
  });
  const [step, setStep] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const site = getManualSite(siteId) ?? MANUAL_SITES[0];
  const accent = ACCENT[site.accent];
  const status = STATUS_META[site.status];

  const selectSite = useCallback((id: string) => {
    setSiteId(id);
    setStep(0);
    setExpanded(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, `#manual/${id}`);
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const id = readSiteFromHash();
      if (id && getManualSite(id)) {
        setSiteId(id);
        setStep(0);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const total = STEP_DEFS.length;
  const current = STEP_DEFS[step];

  const go = useCallback(
    (dir: -1 | 1) => setStep((s) => Math.min(total - 1, Math.max(0, s + dir))),
    [total]
  );

  const body = useMemo(() => renderStep(site, current.key, accent, expanded, setExpanded), [
    site,
    current.key,
    accent,
    expanded,
  ]);

  return (
    <div className="animate-fade-in">
      {/* Intro */}
      <div className="mb-8 rounded-sm border border-zinc-900 bg-ink-900 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Compass className="h-5 w-5 text-amber-400" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">
            The Ecosystem Manual
          </span>
        </div>
        <h2 className="mt-3 font-serif text-2xl text-white sm:text-3xl">
          Understand every system before you use it.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
          A guided walkthrough of the nine Overlay365 platforms — what each one is for, its components, how the pieces
          fit together, and how it connects to the rest of the ecosystem. Every entry carries an honest build status:
          concepts are labeled as concepts, and fabricated or quarantined work is named as such.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {(Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map((key) => (
            <span
              key={key}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${STATUS_META[key].className}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[key].dot}`} />
              {STATUS_META[key].label}
              <span className="hidden font-normal normal-case tracking-normal text-zinc-400 sm:inline">
                — {STATUS_META[key].description}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Site rail */}
        <aside className="lg:col-span-4">
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">Platforms</h3>
          <ul className="flex flex-col gap-2">
            {MANUAL_SITES.map((s) => {
              const active = s.id === site.id;
              const sMeta = STATUS_META[s.status];
              const sAccent = ACCENT[s.accent];
              return (
                <li key={s.id}>
                  <button
                    onClick={() => selectSite(s.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`group w-full rounded-sm border p-4 text-left transition-all duration-300 ${
                      active
                        ? `${sAccent.border} ${sAccent.bg}`
                        : 'border-zinc-900 bg-ink-900 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`font-serif text-base ${active ? 'text-white' : 'text-zinc-200'}`}>
                        {s.name}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] ${sMeta.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sMeta.dot}`} />
                        {sMeta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{s.tagline}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Tour */}
        <section className="lg:col-span-8">
          <div className={`rounded-sm border bg-ink-900 ${accent.border} ${accent.glow}`}>
            {/* Tour header */}
            <div className="border-b border-zinc-900 p-5 sm:p-6">
              {site.logo && (
                <div className="mb-5 overflow-hidden rounded-sm border border-white/10 bg-black">
                  <img
                    src={site.logo}
                    alt={`${site.name} logo`}
                    className="h-20 w-full object-contain"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.25em] ${accent.text}`}>
                    {site.shortName} · Step {step + 1} of {total}
                  </p>
                  <h3 className="mt-1 font-serif text-xl text-white sm:text-2xl">{current.label}</h3>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${status.className}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
              </div>

              {/* Steps */}
              <ol className="mt-5 flex flex-wrap items-center gap-2">
                {STEP_DEFS.map((def, i) => {
                  const Icon = def.icon;
                  const done = i < step;
                  const active = i === step;
                  return (
                    <li key={def.key} className="flex items-center gap-2">
                      <button
                        onClick={() => setStep(i)}
                        aria-current={active ? 'step' : undefined}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${
                          active
                            ? `${accent.border} ${accent.bg} ${accent.text}`
                            : done
                              ? 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                              : 'border-zinc-900 text-zinc-600 hover:text-zinc-400'
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {def.label}
                      </button>
                      {i < total - 1 && <span className="hidden h-px w-4 bg-zinc-800 sm:block" />}
                    </li>
                  );
                })}
              </ol>
              <div className="mt-4 h-0.5 w-full overflow-hidden rounded-full bg-zinc-900">
                <div
                  className={`h-full ${accent.bar} transition-all duration-500`}
                  style={{ width: `${((step + 1) / total) * 100}%` }}
                />
              </div>
            </div>

            {/* Step body */}
            <div className="min-h-[320px] p-5 sm:p-8">{body}</div>

            {/* Tour footer */}
            <div className="flex items-center justify-between gap-3 border-t border-zinc-900 p-5 sm:p-6">
              <button
                onClick={() => go(-1)}
                disabled={step === 0}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
              {step < total - 1 ? (
                <button
                  onClick={() => go(1)}
                  className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${accent.border} ${accent.bg} ${accent.text} hover:bg-white/5`}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : site.url ? (
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-950 transition-colors hover:bg-zinc-200"
                >
                  Open {site.shortName}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Not yet deployed
                </span>
              )}
            </div>
          </div>

          <p className="mt-4 text-center text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-600">
            Not sure where to start? Step through each platform in order.
          </p>
        </section>
      </div>
    </div>
  );
}

function renderStep(
  site: ManualSite,
  key: StepKey,
  accent: (typeof ACCENT)[ManualSite['accent']],
  expanded: string | null,
  setExpanded: (v: string | null) => void
) {
  switch (key) {
    case 'mission':
      return (
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="font-serif text-lg text-white">{site.name}</h4>
            <p className="mt-1 text-sm font-medium text-zinc-400">{site.tagline}</p>
          </div>
          <p className="text-base leading-relaxed text-zinc-200">{site.mission}</p>
          <div className="flex flex-col gap-4 border-t border-zinc-900 pt-6">
            {site.overview.map((para, i) => (
              <p key={i} className="text-sm leading-relaxed text-zinc-400">
                {para}
              </p>
            ))}
          </div>
          <div className={`rounded-sm border p-4 text-sm leading-relaxed text-zinc-400 ${accent.border} ${accent.bg}`}>
            <span className="font-bold uppercase tracking-[0.15em] text-[10px] text-zinc-300">Status check · </span>
            {site.statusNote}
          </div>
        </div>
      );

    case 'components':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-400">
            The building blocks of {site.name}. Select a component to expand its role.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {site.components.map((c) => {
              const open = expanded === c.name;
              return (
                <button
                  key={c.name}
                  onClick={() => setExpanded(open ? null : c.name)}
                  aria-expanded={open}
                  className={`rounded-sm border p-4 text-left transition-all duration-300 ${
                    open ? `${accent.border} ${accent.bg}` : 'border-zinc-900 bg-zinc-950 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-100">{c.name}</span>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`}
                    />
                  </div>
                  <p className={`mt-2 text-xs leading-relaxed text-zinc-500 ${open ? '' : 'line-clamp-2'}`}>
                    {c.description}
                  </p>
                  {open && (
                    <p className="mt-3 border-t border-zinc-800 pt-3 text-xs leading-relaxed text-zinc-400">
                      {c.detail}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );

    case 'architecture':
      return (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-zinc-400">
            How {site.name} fits together — the layers and subsystems, from the user-facing surface down to the
            foundation.
          </p>
          <ol className="relative ml-2 flex flex-col gap-3 border-l border-zinc-800 pl-6">
            {site.architecture.map((layer, i) => (
              <li key={layer.name} className="relative">
                <span
                  className={`absolute -left-[33px] top-2 flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold ${accent.border} ${accent.bg} ${accent.text}`}
                >
                  {i + 1}
                </span>
                <div className="rounded-sm border border-zinc-900 bg-zinc-950 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-100">{layer.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] ${accent.border} ${accent.text}`}>
                      {layer.role}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">{layer.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      );

    case 'connections':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-400">
            {site.name} does not stand alone. These are its links into the wider Overlay365 ecosystem.
          </p>
          <ul className="flex flex-col gap-3">
            {site.connections.map((c) => (
              <li key={c} className="flex items-start gap-3 rounded-sm border border-zinc-900 bg-zinc-950 p-4">
                <Link2 className={`mt-0.5 h-4 w-4 shrink-0 ${accent.text}`} />
                <span className="text-sm leading-relaxed text-zinc-300">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case 'honesty':
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/5 p-5">
            <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              What is real
            </h4>
            <ul className="mt-4 flex flex-col gap-3">
              {site.real.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm leading-relaxed text-zinc-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-5">
            <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">
              <Compass className="h-3.5 w-3.5" />
              What is planned
            </h4>
            <ul className="mt-4 flex flex-col gap-3">
              {site.planned.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm leading-relaxed text-zinc-400">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs leading-relaxed text-zinc-500 sm:col-span-2">
            This manual is written to be auditable. If a system is not built, it is called planned — not shipped.
          </p>
        </div>
      );

    case 'enter':
      return (
        <div className="flex flex-col items-start gap-5">
          <p className="text-base leading-relaxed text-zinc-300">
            You have the full picture of {site.name}. Move from understanding to using it.
          </p>
          {site.url ? (
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-white px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              Open {site.shortName}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Not yet deployed
            </span>
          )}
          {site.status === 'concept' && (
            <p className="text-xs leading-relaxed text-zinc-500">
              This platform is still a concept. There may be no public product to open yet — treat any link as a
              preview, not a finished system.
            </p>
          )}
        </div>
      );

    default:
      return null;
  }
}
