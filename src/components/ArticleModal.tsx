import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, ImageIcon, AlertTriangle, X } from 'lucide-react';

interface BackstoryData {
  the_past_roots: string;
  ongoing_players: string;
  insider_insight: string;
  timeline: { time: string; event: string }[];
}

const safe = (val: any): string => {
  if (typeof val === 'string') return val;
  if (!val) return '';
  if (typeof val === 'object') return Object.values(val).filter(v => typeof v === 'string').join(' ') || JSON.stringify(val);
  return String(val);
};

export default function ArticleModal({ 
  articleId, 
  onClose, 
  simplifiedText, 
  headline,
  initialScroll = 0,
  onScrollChange
}: { 
  articleId: number | string, 
  onClose: () => void, 
  simplifiedText: string, 
  headline: string,
  initialScroll?: number,
  onScrollChange?: (val: number) => void
}) {
  const [backstory, setBackstory] = useState<BackstoryData | null>(null);
  const [loadingBackstory, setLoadingBackstory] = useState(false);
  const [imageStyle, setImageStyle] = useState('photorealistic');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Focus and handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch the deep context asset only when the user opens the story view
  useEffect(() => {
    setLoadingBackstory(true);
    fetch(`/api/news/${encodeURIComponent(articleId)}/backstory`)
      .then(async (res) => {
         if (!res.ok) throw new Error(await res.text());
         if (!res.headers.get("content-type")?.includes("application/json")) {
           throw new Error("Invalid response");
         }
         return res.json();
      })
      .then((data) => {
        setBackstory(data);
        setLoadingBackstory(false);
      })
      .catch((e) => {
        console.error(e);
        setLoadingBackstory(false);
      });
  }, [articleId]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = initialScroll;
    }
  }, [initialScroll]);

  const handleScroll = () => {
    if (scrollContainerRef.current && onScrollChange) {
      onScrollChange(scrollContainerRef.current.scrollTop);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="w-full max-w-2xl bg-zinc-950/90 border-l border-zinc-800 h-full overflow-y-auto p-8 shadow-2xl flex flex-col justify-between"
      >
        
        <div>
          {/* Main Simplified Core View */}
          <button onClick={onClose} className="text-xs uppercase font-bold tracking-widest text-zinc-500 hover:text-zinc-300 mb-6 flex items-center gap-2 cursor-pointer transition-colors">
            <span className="text-lg">←</span> Close Insight Panel
          </button>
          
          <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest mb-4 block">
            LEVEL 1 // ACCESSIBLE SYNTHESIS
          </span>
          <h1 className="text-3xl font-serif text-white mb-6 leading-tight">{headline}</h1>
          
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-4">
              <button 
                 onClick={async () => {
                    setGeneratingImage(true);
                    setGeneratedImageUrl(null);
                    setGenerationError(null);
                    try {
                      const res = await fetch(`/api/news/${encodeURIComponent(articleId)}/generate-image`, { 
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ style: imageStyle })
                      });
                      const text = await res.text();
                      let data;
                      try {
                        data = JSON.parse(text);
                      } catch (parseErr) {
                        throw new Error(text || "Failed to generate image (Invalid server response)");
                      }
                      if (res.ok && data?.imageUrl) {
                         setGeneratedImageUrl(data.imageUrl);
                      } else {
                         setGenerationError(data?.error || "Failed to generate image");
                      }
                    } catch (err: any) {
                      console.error("Image generation error:", err);
                      setGenerationError(err?.message || "An error occurred while generating the image.");
                    } finally {
                      setGeneratingImage(false);
                    }
                 }}
                 disabled={generatingImage}
                 className="text-xs uppercase font-bold tracking-widest text-emerald-500 hover:text-emerald-300 disabled:text-zinc-600 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer transition-colors"
              >
                 {generatingImage ? (
                   <>
                     <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                     <span>Generating Image...</span>
                   </>
                 ) : (
                   <>
                     <span>✨ Generate {imageStyle} Image</span>
                   </>
                 )}
              </button>
              <select 
                value={imageStyle}
                onChange={(e) => setImageStyle(e.target.value)}
                disabled={generatingImage}
                className="bg-zinc-800 text-zinc-300 text-xs uppercase font-bold tracking-widest p-2 rounded cursor-pointer outline-none border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="photorealistic">Photorealistic</option>
                <option value="cyberpunk">Cyberpunk</option>
                <option value="artistic">Artistic</option>
                <option value="minimalist">Minimalist</option>
              </select>
            </div>

            {generationError && (
              <div className="bg-red-950/20 border border-red-900/30 text-red-400 text-xs p-3 rounded flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{generationError}</span>
              </div>
            )}

            {generatedImageUrl && (
              <div className="relative group bg-zinc-900 p-2 rounded-xl border border-zinc-800 overflow-hidden">
                <img 
                  src={generatedImageUrl} 
                  alt="AI Generated Visualization" 
                  referrerPolicy="no-referrer"
                  className="w-full h-auto rounded-lg max-h-80 object-cover"
                />
                <button 
                  onClick={() => setGeneratedImageUrl(null)} 
                  className="absolute top-4 right-4 bg-black/80 hover:bg-black text-white p-1.5 rounded-full transition-colors"
                  title="Dismiss image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          
          <p className="text-base text-zinc-300 leading-relaxed mb-8 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800/80">
            {simplifiedText}
          </p>

          {/* Deep Insight Context Engine Component */}
          <div className="border-t border-zinc-800/80 pt-8 mt-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Level 2 // Structural Backstory
            </h3>

            {loadingBackstory ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-zinc-800/50 rounded w-3/4"></div>
                <div className="h-4 bg-zinc-800/50 rounded"></div>
                <div className="h-4 bg-zinc-800/50 rounded w-5/6"></div>
              </div>
            ) : backstory && ((backstory as any)._unavailable || (!backstory.the_past_roots && (!backstory.timeline || backstory.timeline.length === 0))) ? (
              <div className="text-xs text-zinc-500 font-mono tracking-widest py-4">
                CONTEXT TEMPORARILY UNAVAILABLE — RETRY IN A MOMENT
              </div>
            ) : backstory ? (
              <div className="space-y-8 text-sm">
                <div>
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-2">The Roots</h4>
                  <p className="text-zinc-300 left-relaxed text-[15px]">{safe(backstory.the_past_roots)}</p>
                </div>

                {backstory.ongoing_players && (
                  <div>
                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-2">Key Players</h4>
                    <p className="text-zinc-300 left-relaxed text-[15px]">{safe(backstory.ongoing_players)}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-4">Historical Timeline</h4>
                  <div className="border-l-2 border-zinc-800 ml-2 pl-6 space-y-5 my-2">
                    {(backstory.timeline ?? []).map((item, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute w-2 h-2 rounded-full bg-emerald-500/80 -left-[29px] top-1"></div>
                        <span className="font-bold font-mono text-emerald-400 text-[10px] tracking-widest block mb-1 uppercase">{safe(item?.time)}</span>
                        <p className="text-[13px] text-zinc-400 leading-relaxed">{safe(item?.event)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-emerald-950/20 border border-emerald-900/30 p-5 rounded-xl">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Systemic Analysis Insight</span>
                  <p className="text-[13px] mt-2 leading-relaxed text-emerald-100/70">{safe(backstory.insider_insight)}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 font-mono">Failed to retrieve historical matrix.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
