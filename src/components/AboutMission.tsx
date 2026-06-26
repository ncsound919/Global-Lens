import React from 'react';

export default function AboutMission() {
  return (
    <div className="mb-12 border border-zinc-900 bg-zinc-950 p-8 rounded-sm">
      <h2 className="text-xl font-serif text-white tracking-wide mb-4">About Black Global Lens</h2>
      <p className="text-zinc-400 font-sans leading-relaxed text-sm md:text-base max-w-4xl">
        Black Global Lens is an intelligent news aggregator and contextualization platform. 
        We use advanced AI models to synthesize global reporting, highlighting structural implications 
        and centering marginalized narratives. By applying specific editorial lenses—such as Pan-African, 
        Decolonial, and Indigenous frameworks—we transform raw dispatches into analytical insights 
        that empower our communities with the context missing from traditional global news.
      </p>
    </div>
  );
}
