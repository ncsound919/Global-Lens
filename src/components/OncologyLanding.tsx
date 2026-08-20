import React, { useEffect, useState } from 'react';
import { OncologyOverview } from '../types';
import FindingOfTheDay from './FindingOfTheDay';
import FindingCard from './FindingCard';
import PaperCard from './PaperCard';

export default function OncologyLanding() {
  const [data, setData] = useState<OncologyOverview | null>(null);
  const [kind, setKind] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [donating, setDonating] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/oncology/overview${kind === 'all' ? '' : `?kind=${encodeURIComponent(kind)}`}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j) => { if (alive) setData(j); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [kind]);

  const donate = async () => {
    setDonating(true);
    try {
      const r = await fetch('/api/donate/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 2500, recurring: false }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.url) { window.location.href = j.url; return; }
      throw new Error('no checkout url');
    } catch {
      window.alert('Donations are not configured yet. Please try again later.');
    } finally {
      setDonating(false);
    }
  };

  if (error) return <p className="p-8 text-zinc-500">Unable to load oncology research ({error}).</p>;
  if (!data) return <p className="p-8 text-zinc-500">Loading oncology research…</p>;

  const kinds = ['all', 'calibration', 'benchmark', 'discovery', 'simulation'];
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10">
      <div className="mb-6 flex flex-col gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-serif text-white">Overlay Oncology Research</h2>
          <p className="mt-1 text-sm text-zinc-400">Verified, signed, replayable progress from Oncology OS and Decon.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Funded by the community</p>
          <p className="text-2xl font-bold text-amber-300">${data.donations.settledUsd.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">{data.donations.totalDonations} settled donations</p>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <FindingOfTheDay finding={data.finding_of_day.finding} day={data.finding_of_day.day} />
        <button
          onClick={donate}
          disabled={donating}
          className="rounded-full border border-amber-500 bg-amber-500 px-6 py-3 text-xs font-bold uppercase tracking-widest text-zinc-950 hover:bg-white hover:border-white disabled:opacity-50"
        >
          {donating ? 'Redirecting…' : 'Donate'}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={`rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${kind === k ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
            {k}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.findings.map((f) => <FindingCard key={f.id} finding={f} />)}
      </div>

      <h3 className="mb-4 mt-10 border-t border-zinc-900 pt-6 text-lg font-serif text-white">Research Papers</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.papers.map((p) => <PaperCard key={p.id} paper={p} />)}
      </div>
    </div>
  );
}
