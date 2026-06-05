'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, ArrowRight, Terminal, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all registration fields.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await register(name, email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-zinc-950 text-zinc-200 min-h-screen flex items-center justify-center p-4 sm:p-6 relative w-full overflow-hidden [background-image:radial-gradient(#18181b_1px,transparent_1px)] [background-size:16px_16px]">
      <div className="bg-zinc-950 border border-zinc-900 p-6 sm:p-8 rounded-lg w-full max-w-md space-y-6 relative shadow-2xl font-mono text-xs animate-slide-up">
        
        {/* Header */}
        <div className="flex items-center space-x-3 justify-center text-center pb-3 border-b border-zinc-900">
          <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center font-bold text-xs text-white">
            Q
          </div>
          <div>
            <h2 className="font-extrabold text-sm tracking-wider text-white">QueueWatch</h2>
            <p className="text-[9px] text-zinc-550 font-bold uppercase tracking-widest leading-none">Telemetry Engine</p>
          </div>
        </div>

        <div className="text-center space-y-1">
          <h3 className="font-bold text-white text-sm">Provision Workspace</h3>
          <p className="text-xs text-zinc-500">Deploy a clean observability panel instance</p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-950/20 border border-rose-900/30 text-rose-300 text-xs rounded flex items-start space-x-2 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">sre operator name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              className="w-full bg-zinc-900/20 border border-zinc-900 rounded px-3.5 py-2.5 text-sm sm:text-xs text-white focus:outline-none focus:border-zinc-800 disabled:opacity-50"
              placeholder="Alex Rivera"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">work email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="w-full bg-zinc-900/20 border border-zinc-900 rounded px-3.5 py-2.5 text-sm sm:text-xs text-white focus:outline-none focus:border-zinc-800 disabled:opacity-50"
              placeholder="sre@company.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">secret key passphrase</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="w-full bg-zinc-900/20 border border-zinc-900 rounded pl-3.5 pr-10 py-2.5 text-sm sm:text-xs text-white focus:outline-none focus:border-zinc-800 disabled:opacity-50 font-mono"
                placeholder="••••••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={submitting}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 font-bold transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 text-xs"
          >
            <span>{submitting ? 'provisioning workspace...' : 'deploy console instance'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </form>

        <div className="text-center text-xs text-zinc-400">
          <span>Already registered? </span>
          <Link href="/login" className="text-zinc-300 hover:text-white font-bold underline transition-all">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
