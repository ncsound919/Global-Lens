import { useState } from 'react';
import { Share2, ClipboardCopy, CheckCircle2 } from 'lucide-react';

const TwitterIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>;
const FacebookIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>;
const LinkedinIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>;

interface ShareToolbarProps {
  articleId: string;
  headline: string;
  analysis: string;
}

// Resolve the canonical origin (production domain) instead of the deployment
// URL the reader happens to be on. The server renders <link rel="canonical">
// from APP_URL/PUBLIC_URL, so preview/deployment URLs never leak into shares.
function getCanonicalOrigin(): string {
  try {
    const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (link && link.href) return new URL(link.href).origin;
  } catch {
    /* fall through */
  }
  return window.location.origin;
}

export default function ShareToolbar({ articleId, headline, analysis }: ShareToolbarProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${getCanonicalOrigin()}/api/news/${encodeURIComponent(articleId)}/share`;
  const shareUrlEncoded = encodeURIComponent(shareUrl);
  const shareText = encodeURIComponent(`"${headline}" - via Overlay Global Lens`);

  const handleCopy = () => {
    if (navigator.share) {
      navigator.share({
        title: headline,
        text: `${analysis?.slice(0, 100)}... via Overlay Global Lens`,
        url: shareUrl
      }).catch((e) => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex gap-2">
      <button 
        onClick={handleCopy}
        className="cursor-pointer flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 p-2.5 text-zinc-400 transition-all hover:bg-white hover:text-black hover:border-white"
        aria-label="Share article"
        title="Share article"
      >
        {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
      </button>

      {/* Social Links hidden on very small screens, visible on md */}
      <div className="hidden md:flex gap-2">
        <a 
          href={`https://twitter.com/intent/tweet?url=${shareUrlEncoded}&text=${shareText}`}
          target="_blank" rel="noopener noreferrer"
          className="cursor-pointer flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 p-2.5 text-zinc-400 transition-all hover:bg-[#1DA1F2] hover:text-white hover:border-[#1DA1F2]"
          aria-label="Share on Twitter"
        >
          <TwitterIcon />
        </a>
        <a 
          href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrlEncoded}`}
          target="_blank" rel="noopener noreferrer"
          className="cursor-pointer flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 p-2.5 text-zinc-400 transition-all hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2]"
          aria-label="Share on Facebook"
        >
          <FacebookIcon />
        </a>
        <a 
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrlEncoded}`}
          target="_blank" rel="noopener noreferrer"
          className="cursor-pointer flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 p-2.5 text-zinc-400 transition-all hover:bg-[#0A66C2] hover:text-white hover:border-[#0A66C2]"
          aria-label="Share on LinkedIn"
        >
          <LinkedinIcon />
        </a>
      </div>
    </div>
  );
}
