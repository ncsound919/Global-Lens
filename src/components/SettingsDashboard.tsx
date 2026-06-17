import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X } from 'lucide-react';

interface SettingsDashboardProps {
  onClose: () => void;
}

export default function SettingsDashboard({ onClose }: SettingsDashboardProps) {
  const [readingMode, setReadingMode] = useState('simplified');
  const [lensIntensity, setLensIntensity] = useState('balanced');
  const [oddsFormat, setOddsFormat] = useState('american');
  const [regions, setRegions] = useState({ us: true, westAfrica: false, caribbean: true });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let sid = localStorage.getItem('session_id');
    if (!sid) {
       sid = 'session_' + Math.random().toString(36).substr(2, 9);
       localStorage.setItem('session_id', sid);
    }

    fetch('/api/user/settings', {
      headers: { 'x-session-id': sid }
    })
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setReadingMode(data.reading_mode || 'simplified');
          setLensIntensity(data.lens_intensity || 'balanced');
          setOddsFormat(data.odds_format || 'american');
          if (data.regions) setRegions(data.regions);
        }
      })
      .catch(console.error);
  }, []);

  const saveSettings = async () => {
    setLoading(true);
    let sid = localStorage.getItem('session_id') || 'default_session';
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sid },
        body: JSON.stringify({ readingMode, lensIntensity, oddsFormat, regions }),
      });
      if (response.ok) {
        // success
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      onClose();
      // Need a way to trigger refresh in App.tsx
      window.dispatchEvent(new Event('settings-updated'));
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
            <select 
              value={lensIntensity} 
              onChange={(e) => setLensIntensity(e.target.value)}
              className="w-full md:w-2/3 p-3 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:border-amber-500 focus:outline-none transition-colors"
            >
              <option value="balanced">Balanced Sync (Domestic + Transnational Frameworks)</option>
              <option value="hyper_local">Hyper-Local (Focus heavily on domestic economic equity data)</option>
              <option value="pan_african">Pan-African (Prioritize Global South trade & historical diaspora context)</option>
            </select>
          </section>

          {/* SECTION 3: SPORTS BOOK RULES */}
          <section className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800/80">
            <h3 className="text-base font-bold font-serif mb-2 text-white">3. Sports Betting & Odds Layout</h3>
            <p className="text-xs text-zinc-500 mb-4 font-mono uppercase tracking-widest">Configure calculations feeding out of The Odds API.</p>
            <div className="flex flex-wrap gap-6 mt-4">
              {['american', 'decimal', 'fractional'].map((format) => (
                <label key={format} className={`flex items-center space-x-3 text-sm cursor-pointer ${oddsFormat === format ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-300'}`}>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${oddsFormat === format ? 'border-amber-500' : 'border-zinc-600'}`}>
                    {oddsFormat === format && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                  </div>
                  <input 
                    type="radio" 
                    name="oddsFormat" 
                    value={format}
                    checked={oddsFormat === format} 
                    onChange={() => setOddsFormat(format)}
                    className="hidden"
                  />
                  <span className="capitalize font-medium tracking-wide">{format}</span>
                </label>
              ))}
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
