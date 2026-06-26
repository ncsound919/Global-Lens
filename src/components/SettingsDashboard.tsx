import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X } from 'lucide-react';

interface SettingsDashboardProps {
  onClose: () => void;
}

export default function SettingsDashboard({ onClose }: SettingsDashboardProps) {
  const [readingMode, setReadingMode] = useState('simplified');
  const [lensIntensity, setLensIntensity] = useState('balanced');
  const [regions, setRegions] = useState({ us: true, westAfrica: false, caribbean: true });
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedHealth, setFeedHealth] = useState<any>({});

  useEffect(() => {
    fetch('/api/user/settings')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setReadingMode(data.reading_mode || 'simplified');
          setLensIntensity(data.lens_intensity || 'balanced');
          if (data.regions) setRegions(data.regions);
          setGeminiApiKey(data.gemini_api_key || '');
        }
      })
      .catch(console.error);
      
    fetch('/api/feeds/health')
      .then(res => res.json())
      .then(data => setFeedHealth(data.health || {}))
      .catch(console.error);
  }, []);

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingMode, lensIntensity, regions, geminiApiKey }),
      });
      if (response.ok) {
        // success
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      window.dispatchEvent(new Event('settings-updated'));
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-start z-50 overflow-y-auto pt-10 pb-10">
      <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl relative mt-10">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <header className="border-b border-zinc-800 pb-4 mb-8">
          <div className="flex items-center gap-3 mb-1">
            <SettingsIcon className="w-6 h-6 text-amber-500" />
            <h1 className="text-3xl font-bold font-serif tracking-tight text-white">Dashboard Settings</h1>
          </div>
          <p className="text-sm text-zinc-400 mt-1 pl-9">Control your reading profile, data ingestion filters, and AI parameters.</p>
        </header>

        <div className="space-y-8 pl-9">
          {/* SECTION 0: API KEY */}
          <section className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800/80">
            <h3 className="text-base font-bold font-serif mb-2 text-white">0. Personal API Integration</h3>
            <p className="text-xs text-zinc-500 mb-4 font-mono uppercase tracking-widest">Optional: Provide your own Gemini API key for image generation.</p>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full p-4 border border-zinc-700 bg-zinc-950 rounded-lg text-white placeholder-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none font-mono"
            />
          </section>

          {/* SECTION 1: COMPREHENSION MODEL */}
          <section className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800/80">
            <h3 className="text-base font-bold font-serif mb-2 text-white">1. Comprehension & Reading Profile</h3>
            <p className="text-xs text-zinc-500 mb-4 font-mono uppercase tracking-widest">Choose how complex global events are delivered initially.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {['simplified', 'executive', 'raw'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setReadingMode(mode)}
                  className={`p-4 border rounded-lg text-left transition-all cursor-pointer ${
                    readingMode === mode 
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-400 font-semibold shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
                      : 'border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <span className="capitalize block text-sm tracking-wide">{mode === 'simplified' ? 'Explainer (10-Yr Old)' : mode}</span>
                  <span className={`text-[11px] block font-normal mt-2 leading-relaxed ${readingMode === mode ? 'text-amber-400/80' : 'text-zinc-500'}`}>
                    {mode === 'simplified' && 'Short sentences, vivid analogies, maximum accessibility.'}
                    {mode === 'executive' && 'High density, professional summaries for rapid scanning.'}
                    {mode === 'raw' && 'Bypasses AI text manipulation entirely on first load.'}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* SECTION 2: CONTEXT AGENT TRACKING */}
          <section className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800/80">
            <h3 className="text-base font-bold font-serif mb-2 text-white">2. Context Agent Weighting</h3>
            <p className="text-xs text-zinc-500 mb-4 font-mono uppercase tracking-widest">Dictates which analytical documents are injected into the "What This Means For Us" engine.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { value: 'balanced', label: 'Balanced', desc: 'Mixes domestic trends with transnational perspectives.' },
                { value: 'hyper_local', label: 'Hyper-Local', desc: 'Focuses heavily on domestic class and economic equity.' },
                { value: 'pan_african', label: 'Pan-African', desc: 'Prioritizes Global South solidarity and historical diaspora connections.' },
                { value: 'indigenous', label: 'Indigenous', desc: 'Centers land rights, ancestral histories, and environmental justice.' },
                { value: 'marxist', label: 'Marxist', desc: 'Analyzes stories purely through a lens of class struggle and capital.' },
                { value: 'decolonial', label: 'Decolonial', desc: 'Examines and challenges enduring colonial legacies and imperial power dynamics.' },
              ].map(lens => (
                <button
                  key={lens.value}
                  onClick={() => setLensIntensity(lens.value)}
                  className={`p-4 border rounded-lg text-left transition-all cursor-pointer ${
                    lensIntensity === lens.value
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-semibold shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                      : 'border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <span className="block text-sm tracking-wide">{lens.label}</span>
                  <span className={`text-[11px] block font-normal mt-2 leading-relaxed ${lensIntensity === lens.value ? 'text-emerald-400/80' : 'text-zinc-500'}`}>
                    {lens.desc}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* SECTION 3: DATA SOURCES & SYNC */}
          <section className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800/80">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-base font-bold font-serif text-white">3. Data Sources & Sync</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4 font-mono uppercase tracking-widest">Live health of editorial ingestion pipelines.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pr-2">
               {Object.entries(feedHealth).map(([url, status]: any) => {
                 let host = url;
                 try { host = new URL(url).hostname.replace('www.', ''); } catch (e) {}
                 const msAgo = status.last_success ? Date.now() - status.last_success : null;
                 const minsAgo = msAgo ? Math.floor(msAgo / 60000) : null;
                 const timeLabel = minsAgo !== null ? (minsAgo === 0 ? 'just now' : `${minsAgo}m ago`) : 'Never';
                 const isDead = status.fails >= 3;
                 return (
                   <div key={url} className="flex flex-col p-3 bg-[#0a0a0a] border border-zinc-800/60 rounded">
                     <span className="text-xs font-mono text-zinc-300 truncate">{host}</span>
                     <div className="flex items-center justify-between mt-2">
                        <span className={`text-[9.5px] uppercase tracking-widest flex items-center gap-1.5 font-bold ${isDead ? 'text-red-500' : 'text-emerald-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isDead ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                          {isDead ? 'Feed Unavailable' : 'Active'}
                        </span>
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {isDead ? `Fails: ${status.fails}` : `Synced ${timeLabel}`}
                        </span>
                     </div>
                   </div>
                 )
               })}
            </div>
          </section>

          {/* SECTION 4: SUBSCRIPTION & SUPPORT */}
          <section className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800/80">
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold font-serif mb-2 text-white shadow-amber-500/10">4. Support Black Global Lens</h3>
                  <p className="text-sm text-zinc-400">Premium AI features and API costs are sustained entirely by community contributions.</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-amber-500 tracking-tighter mb-1">$2.00<span className="text-sm font-medium text-zinc-500 tracking-normal">/mo</span></div>
                </div>
             </div>
             <div className="mt-5 p-4 rounded-lg border border-zinc-800 bg-zinc-950 flex flex-col md:flex-row items-center gap-4 justify-between">
                 <div className="flex-1">
                   <p className="text-sm text-zinc-300 font-mono">Send your monthly contribution via CashApp to maintain access. The site will be consistently upgraded with new models, feeds, and ongoing feature enhancements.</p>
                 </div>
                 <a 
                    href="https://cash.app/$helptools" 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold tracking-widest text-[11px] uppercase hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer"
                 >
                    CashApp: $helptools
                 </a>
             </div>
          </section>
        </div>

        {/* SAVE CONTROL FLOAT */}
        <footer className="mt-10 pt-6 border-t border-zinc-800 flex justify-end gap-4 pl-9">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg font-medium text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={saveSettings}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm px-8 py-2.5 rounded-lg transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)] disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : null}
            Submit Configuration Matrix
          </button>
        </footer>
      </div>
    </div>
  );
}
