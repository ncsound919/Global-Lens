import React, { useState } from 'react';
import { X, Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { useModalA11y } from '../lib/useModalA11y';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const panelRef = useModalA11y(onClose);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const redirectUri = `${window.location.origin}/api/auth/google/callback`;
      const res = await fetch(`/api/auth/google/url?redirectUri=${encodeURIComponent(redirectUri)}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize Google login');
      }

      // Open OAuth popup window with Google Authorize URL directly
      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const authWindow = window.open(
        data.url,
        'google_oauth_popup',
        `width=${width},height=${height},top=${top},left=${left}`
      );

      if (!authWindow) {
        setError('Popup blocked! Please enable popups in your browser to sign in with Google.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        onSuccess(event.data.user);
      } else if (event.data?.type === 'OAUTH_AUTH_FAILURE') {
        setError(event.data.error || 'Google authentication failed');
        setLoading(false);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSuccess]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={isLogin ? 'Reader Login' : 'Create Account'}
        tabIndex={-1}
        className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 flex flex-col shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-medium text-white font-sans tracking-tight">
              {isLogin ? 'Reader Login' : 'Create Account'}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Create an account to sync your saved articles across devices and maintain your reading preferences.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close login" className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-900 rounded-sm self-start">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-800 text-white text-sm focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/60 pl-10 pr-4 py-2"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-zinc-900 border border-zinc-800 text-white text-sm focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/60 pl-10 pr-4 py-2"
                placeholder="Minimum 6 characters"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <span>Please wait...</span>
            ) : isLogin ? (
              <><LogIn className="w-4 h-4" /><span>Sign In</span></>
            ) : (
              <><UserPlus className="w-4 h-4" /><span>Sign Up</span></>
            )}
          </button>
        </form>

        <div className="relative my-4 flex py-1 items-center">
          <div className="flex-grow border-t border-zinc-900"></div>
          <span className="flex-shrink mx-3 text-xs text-zinc-500 uppercase tracking-widest font-mono">or</span>
          <div className="flex-grow border-t border-zinc-900"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2.5 px-4 border border-zinc-800 transition-colors flex items-center justify-center space-x-3 disabled:opacity-50 text-sm cursor-pointer"
        >
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="currentColor" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="currentColor" />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="mt-6 pt-4 border-t border-zinc-900 text-center">
          <p className="text-sm text-zinc-400">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-white hover:text-red-400 hover:underline"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
