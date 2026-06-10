'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, ArrowRight, CheckCircle2, ArrowLeft, Key } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccessful, setResetSuccessful] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router, isAuthenticated]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide a valid SRE operator email.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to request OTP');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to process recovery request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      setError('Please enter the security recovery OTP code.');
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError('Please fill in the new access key fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp: otpCode, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to reset password');
      }

      setResetSuccessful(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset access key. Please verify recovery OTP.');
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

        {resetSuccessful ? (
          /* Step 3: Success Confirmation */
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 text-xs rounded flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="space-y-1 font-sans">
                <span className="font-bold block text-white">Access Key Restored</span>
                <span className="leading-relaxed">
                  Your security access key password has been updated. You can now use your new credentials to authenticate.
                </span>
              </div>
            </div>
            <Link
              href="/login"
              className="w-full py-2.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold transition-all flex items-center justify-center space-x-1.5 text-xs font-mono"
            >
              <span>Back to Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : submitted ? (
          /* Step 2: Enter OTP & New Password */
          <form onSubmit={handleResetPassword} className="space-y-4 animate-fade-in">
            <div className="p-3.5 bg-indigo-950/25 border border-indigo-900/40 text-indigo-300 text-xs rounded flex items-start space-x-2.5 font-sans leading-relaxed">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                A temporary recovery OTP has been sent to <strong className="text-white">{email}</strong>. Please enter the code below to configure a new access key.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">recovery otp code</label>
              <input
                autoFocus
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                disabled={submitting}
                className="w-full bg-zinc-900/20 border border-zinc-900 rounded px-3.5 py-2.5 text-sm sm:text-xs text-white focus:outline-none focus:border-zinc-800 disabled:opacity-50 text-center tracking-widest font-mono font-bold"
                placeholder="e.g. 849301"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">new access key (password)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={submitting}
                className="w-full bg-zinc-900/20 border border-zinc-900 rounded px-3.5 py-2.5 text-sm sm:text-xs text-white focus:outline-none focus:border-zinc-800 disabled:opacity-50 font-mono"
                placeholder="••••••••••••"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">confirm new access key</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
                className="w-full bg-zinc-900/20 border border-zinc-900 rounded px-3.5 py-2.5 text-sm sm:text-xs text-white focus:outline-none focus:border-zinc-800 disabled:opacity-50 font-mono"
                placeholder="••••••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 font-bold transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 text-xs"
            >
              <span>{submitting ? 'resetting password...' : 'Configure New Access Key'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-450" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="text-zinc-500 hover:text-white transition-colors underline uppercase font-bold tracking-wider text-[9px]"
              >
                Go Back / Resend Code
              </button>
            </div>
          </form>
        ) : (
          /* Step 1: Request OTP */
          <form onSubmit={handleRequestOtp} className="space-y-4">
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
