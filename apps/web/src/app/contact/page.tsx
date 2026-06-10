'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, Mail, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import PublicHeader from '../../components/PublicHeader';

export default function ContactPage() {
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen relative overflow-x-hidden w-full font-sans antialiased">
      {/* Background SRE Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f11_1px,transparent_1px),linear-gradient(to_bottom,#0f0f11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header */}
      {/* Header */}
      <PublicHeader />

      {/* Contact Panel */}
      <section className="relative px-4 md:px-8 lg:px-12 pt-20 pb-28 max-w-5xl mx-auto flex flex-col items-center space-y-12">
        <div className="text-center space-y-3">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">Developer support</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Connect With SRE Support
          </h1>
          <p className="text-zinc-455 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
            Need help integrating your Redis broker, setting up custom metrics, or building an incident investigation dashboard? We are here.
          </p>
        </div>

        <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-xl p-8 shadow-2xl relative overflow-hidden font-sans">
          {submitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 rounded-full border border-emerald-900 bg-emerald-950/20 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-white text-lg font-bold">Message Transmitted</h3>
              <p className="text-zinc-400 text-xs max-w-xs mx-auto leading-relaxed">
                Telemetry received. Our operations team will respond to your queries shortly.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!email.trim() || !message.trim()) return;
                setSubmitted(true);
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-medium">Work Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-zinc-900/40 border border-zinc-900 rounded-md px-3.5 py-2.5 focus:outline-none focus:border-zinc-700 text-xs text-white placeholder-zinc-650 transition-colors font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-medium">Operational Query / Message</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Setting up custom retry alerts..."
                  className="w-full bg-zinc-900/40 border border-zinc-900 rounded-md px-3.5 py-2.5 focus:outline-none focus:border-zinc-700 text-xs text-white placeholder-zinc-650 transition-colors font-sans resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!email.trim() || !message.trim()}
                className="w-full py-2.5 rounded-md bg-white hover:bg-zinc-100 text-black font-semibold transition-all disabled:opacity-50 flex items-center justify-center space-x-2 text-xs font-mono"
              >
                <Send className="w-3.5 h-3.5 text-black" />
                <span>Transmit Query</span>
              </button>
            </form>
          )}
        </div>

        {/* Social channels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md font-mono text-[11px] text-zinc-400">
          <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg flex items-center space-x-3">
            <Mail className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <p className="font-bold text-zinc-300">Email Contact</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">support@queuewatch.io</p>
            </div>
          </div>
          <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg flex items-center space-x-3">
            <MessageSquare className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <p className="font-bold text-zinc-300">SRE Community</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">discord.gg/queuewatch</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-955 py-12 px-4 md:px-8 text-center text-xs text-zinc-500 font-mono">
        <p>&copy; {new Date().getFullYear()} QueueWatch. Operational Reliability Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
