import { useState, useEffect } from 'react';
import { COOKIE_CONSENT_KEY } from '../lib/constants';

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setShow(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-800 z-50 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-sm text-zinc-300">
        We use cookies and similar technologies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.
      </div>
      <div className="flex gap-2">
<button
          onClick={accept}
          className="whitespace-nowrap rounded-full bg-red-600 hover:bg-red-700 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white transition-colors"
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
