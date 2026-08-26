import EvidenceLegend from './EvidenceLegend';

export default function AboutMission() {
  return (
    <div className="mb-12 border border-zinc-900 bg-zinc-950 p-8 rounded-sm">
      <h2 className="text-xl font-serif text-white tracking-wide mb-4">About Overlay Global Lens</h2>
      <p className="text-zinc-400 font-sans leading-relaxed text-sm md:text-base max-w-4xl">
        Overlay Global Lens is the news and research publication of the Overlay365 ecosystem. We synthesize global
        reporting through cultural-lens AI reframing â€” Pan-African, Decolonial, Indigenous, and more â€” and publish the
        research, trends, and discoveries produced by the Overlay Science and Overlay Writing desks. Every research item
        carries an evidence tier and traces to its source: nothing published here is fabricated.
      </p>
      <div className="mt-5">
        <EvidenceLegend />
      </div>
    </div>
  );
}
