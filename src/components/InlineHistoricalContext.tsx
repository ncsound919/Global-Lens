import React, { useState, useEffect } from 'react';

interface BackstoryData {
  the_past_roots: string;
  ongoing_players: string;
  insider_insight: string;
  timeline: { time: string; event: string }[];
}

export default function InlineHistoricalContext({ articleId }: { articleId: number | string }) {
  const [backstory, setBackstory] = useState<BackstoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    let sid = localStorage.getItem('session_id') || 'default_session';
    fetch(`/api/news/${encodeURIComponent(articleId)}/backstory`, {
      headers: { 'x-session-id': sid }
    })
      .then(async (res) => {
         if (!res.ok) throw new Error(await res.text());
         return res.json();
      })
      .then((data) => {
        setBackstory(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setError(true);
        setLoading(false);
      });
  }, [articleId]);

  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-zinc-900 rounded-sm p-6 lg:p-8 h-full flex flex-col justify-center">
        <div className="animate-pulse space-y-5">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-2 h-2 rounded-full bg-amber-500/50"></div>
             <div className="h-3 bg-zinc-800 rounded-full w-32"></div>
          </div>
          <div className="h-4 bg-zinc-900 rounded-sm w-full"></div>
          <div className="h-4 bg-zinc-900 rounded-sm w-5/6"></div>
          <div className="h-4 bg-zinc-900 rounded-sm w-4/6 mt-6"></div>
        </div>
      </div>
    );
  }

  if (error || !backstory) {
    return (
      <div className="bg-[#0f0f0f] border border-zinc-900 rounded-sm p-6 h-full min-h-[300px] flex items-center justify-center">
        <div className="text-center opacity-70">
           <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Historical Context<br/>Unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f0f] border border-zinc-900 rounded-sm p-6 lg:p-8 h-full flex flex-col overflow-y-auto max-h-[800px] custom-scrollbar">
      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500 mb-6 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-amber-500 block animate-pulse" />
        Historical Context
      </h4>
      
      <div className="space-y-8 flex-1">
        <div>
          <h5 className="text-[10px] uppercase font-bold tracking-[0.15em] text-zinc-500 mb-3 border-b border-zinc-800 pb-2">The Roots</h5>
          <p className="text-zinc-300 font-serif leading-relaxed text-sm lg:text-base">{backstory.the_past_roots}</p>
        </div>

        <div>
           <h5 className="text-[10px] uppercase font-bold tracking-[0.15em] text-zinc-500 mb-4 border-b border-zinc-800 pb-2">Timeline</h5>
           <div className="border-l border-zinc-800 ml-1.5 pl-5 space-y-6 my-4">
             {backstory.timeline.map((item, idx) => (
               <div key={idx} className="relative">
                 <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-500 -left-[24px] top-1.5 ring-4 ring-[#0f0f0f]"></div>
                 <span className="font-bold font-mono text-zinc-400 text-[9px] tracking-widest block mb-1 uppercase bg-zinc-900 inline-block px-2 py-0.5 rounded-sm">{item.time}</span>
                 <p className="text-sm text-zinc-300 leading-relaxed mt-2">{item.event}</p>
               </div>
             ))}
           </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-sm">
          <span className="flex items-center gap-2 text-[9px] text-amber-500/80 font-bold uppercase tracking-[0.2em] mb-2">
            <span className="w-1 h-3 block bg-amber-500/80"></span>
            Systemic Insight
          </span>
          <p className="text-sm mt-3 leading-relaxed text-zinc-400 font-serif">{backstory.insider_insight}</p>
        </div>
      </div>
    </div>
  );
}
