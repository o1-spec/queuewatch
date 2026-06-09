'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide a valid SRE operator email.');
      return;
    }

    setSubmitting(true);
    setError(null);

    // Simulate recovery email trigger (since actual recovery endpoint is mock/static in local DB environment)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setSubmitted(true);
    } catch (err: any) {
      setError('Failed to process recovery request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-zinc-950 text-zinc-200 min-h-screen flex items-center justify-center p-4 sm:p-6 relative w-full overflow-hidden [background-image:radial-gradient(#18181b_1px,transparent_1px)] [background-size:16px_16px]">
      <div className="bg-zinc-950 border border-zinc-900 p-6 sm:p-8 rounded-lg w-full max-w-md space-y-6 relative shadow-2xl font-mono text-xs animate-slide-up">
        
        {/* Header */}
        <div className="flex items-center space-x-3 justify-center text-center pb-3 border-b border-zinc-900">
          <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center font-bold text-xs text-black shadow-md font-mono shrink-0">
            Q
          </div>
          <div>
            <h2 className="font-extrabold text-sm tracking-wider text-white">QueueWatch</h2>
            <p className="text-[9px] text-zinc-550 font-bold uppercase tracking-widest leading-none">Telemetry Engine</p>
          </div>
        </div>

        <div className="text-center space-y-1">
          <h3 className="font-bold text-white text-sm">Recover Access Key</h3>
          <p className="text-xs text-zinc-500">Restore access to your background telemetry workspace</p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-950/20 border border-rose-900/30 text-rose-300 text-xs rounded flex items-start space-x-2 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 text-xs rounded flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="space-y-1">
                <span className="font-bold block text-white">Recovery Request Dispatched</span>
                <span className="leading-relaxed">
                  We have dispatched a temporary access link validation payload to <strong className="text-white">{email}</strong>. Please check your spam folder if it doesn&apos;t arrive in 2 minutes.
                </span>
              </div>
            </div>
            <Link
              href="/login"
              className="w-full py-2.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 font-bold transition-all flex items-center justify-center space-x-1.5 text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-zinc-400" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="w-full bg-zinc-900/20 border border-zinc-900 rounded px-3.5 py-2.5 text-sm sm:text-xs text-white focus:outline-none focus:border-zinc-800 disabled:opacity-50"
                placeholder="femi@company.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 text-xs"
            >
              <span>{submitting ? 'generating recovery link...' : 'Request Recovery Key'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-950" />
            </button>

            <div className="text-center pt-2">
              <Link href="/login" className="text-zinc-500 hover:text-white transition-colors underline uppercase font-bold tracking-wider text-[9px]">
                Cancel & Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
