'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, Terminal, AlertTriangle, ArrowRight, ShieldCheck, Activity, Loader2 } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router, isAuthenticated]);

  useEffect(() => {
    const isDemo = searchParams.get('demo') === 'true';
    if (isDemo && !isAuthenticated()) {
      triggerDemoLogin();
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all credentials fields.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const triggerDemoLogin = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      await login('demo@queuewatch.dev', 'password123');
      router.push('/dashboard');
    } catch (err: any) {
      setError('Failed to boot guest session: ' + err.message);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="bg-background text-foreground min-h-screen flex items-center justify-center p-6 relative w-full overflow-hidden">
      <div className="absolute top-[20%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none"></div>

      <div className="glass-panel p-8 rounded-2xl w-full max-w-md border border-slate-900/60 space-y-6 relative shadow-2xl">
        <div className="flex items-center space-x-3 justify-center text-center">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-indigo-500/30 shadow-md">
            Q
          </div>
          <div>
            <h2 className="font-extrabold text-sm tracking-wider text-white">QueueWatch</h2>
            <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest leading-none">Telemetry Engine</p>
          </div>
        </div>

        <div className="text-center space-y-1">
          <h3 className="font-extrabold text-white text-md">Welcome back, SRE</h3>
          <p className="text-xs text-slate-500">Sign in to your background telemetry workspace</p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-950/15 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-start space-x-2 animate-pulse">
            <AlertTriangle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Work Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting || demoLoading}
              className="w-full bg-slate-950/40 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-white font-sans focus:outline-none focus:border-slate-800 disabled:opacity-50"
              placeholder="sre@company.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Secret Token Code</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting || demoLoading}
              className="w-full bg-slate-950/40 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-slate-800 disabled:opacity-50"
              placeholder="••••••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting || demoLoading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{submitting ? 'Authenticating...' : 'Sign in to Workspace'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-900"></div>
          <span className="flex-shrink mx-4 text-[9px] text-slate-500 font-bold uppercase font-mono tracking-widest">or</span>
          <div className="flex-grow border-t border-slate-900"></div>
        </div>

        <button
          onClick={triggerDemoLogin}
          disabled={submitting || demoLoading}
          className="w-full py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 font-extrabold text-xs transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{demoLoading ? 'Booting sandbox...' : 'VIEW LIVE GUEST DEMO'}</span>
        </button>

        <div className="bg-slate-950/50 border border-slate-900/60 p-3 rounded-lg text-[10px] text-slate-500 font-mono leading-normal">
          <div className="flex items-center space-x-1.5 text-indigo-400/80 mb-1 font-bold">
            <Terminal className="w-3.5 h-3.5 shrink-0" />
            <span>SANDBOX SEEDS:</span>
          </div>
          Email: <span className="text-white">demo@queuewatch.dev</span><br />
          Password: <span className="text-white">password123</span>
        </div>

        <div className="text-center text-[10.5px] text-slate-400">
          <span>New to telemetry console? </span>
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-bold underline transition-all">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-xl border border-slate-900 bg-slate-950 flex items-center justify-center shadow-indigo-500/10 shadow-2xl">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-xs font-extrabold uppercase font-mono tracking-widest text-slate-400">Loading Telemetry</h3>
          <p className="text-[10px] text-slate-500 font-mono">Resolving SRE credentials gateway...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </React.Suspense>
  );
}
