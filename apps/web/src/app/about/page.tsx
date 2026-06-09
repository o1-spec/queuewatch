'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, Compass, ShieldAlert, Cpu } from 'lucide-react';

export default function AboutPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen relative overflow-x-hidden w-full font-sans antialiased">
      {/* Background SRE Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f11_1px,transparent_1px),linear-gradient(to_bottom,#0f0f11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-50 px-4 md:px-8 lg:px-12 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <Link href="/" className="w-5.5 h-5.5 rounded bg-zinc-100 flex items-center justify-center font-bold text-xs text-black shadow-md font-mono shrink-0">
            Q
          </Link>
          <span className="font-mono font-extrabold text-[12px] tracking-wider text-white">QUEUEWATCH</span>
        </div>

        <nav className="hidden md:flex items-center space-x-6 text-xs font-mono font-semibold text-zinc-400">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
        </nav>

        <div className="flex items-center space-x-3 font-mono">
          <Link href={isAuthenticated() ? "/dashboard" : "/register"} className="px-4 py-2 rounded border border-zinc-850 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold text-xs transition-all flex items-center space-x-1">
            <span>{isAuthenticated() ? "Console" : "Get Started"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* About Section */}
      <section className="relative px-4 md:px-8 lg:px-12 pt-20 pb-28 max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">OUR MISSION</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            The Quest for System Reliability
          </h1>
        </div>

        <div className="space-y-8 text-zinc-400 text-sm leading-relaxed font-sans">
          <p>
            QueueWatch was founded on a simple premise: **asynchronous, distributed systems are hard to operate and debug.** When background jobs crash or queues grow out of control, developers shouldn&apos;t need to log in to servers, run manual Redis commands, or dig through gigabytes of logs to find the cause.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 font-mono text-[10.5px]">
            <div className="bg-zinc-900/20 border border-zinc-900 p-5 rounded-lg space-y-2">
              <Compass className="w-5 h-5 text-indigo-400" />
              <p className="font-bold text-zinc-200 uppercase">Operational Sight</p>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Observe the state of all workers, queues, and background services in one single visual flow.
              </p>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-900 p-5 rounded-lg space-y-2">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
              <p className="font-bold text-zinc-200 uppercase">Proactive SRE</p>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Detect queue backlogs and worker failures before they impact checkout steps or customer emails.
              </p>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-900 p-5 rounded-lg space-y-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <p className="font-bold text-zinc-200 uppercase">AI Diagnosis</p>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Correlate logs, parameters, and deployments automatically to produce actionable SRE fixes.
              </p>
            </div>
          </div>

          <p className="pt-6">
            Our vision is to evolve QueueWatch into a comprehensive **AI Reliability Platform** that serves as an autonomous co-pilot for SRE teams, keeping modern microservices healthy, reliable, and performant.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-955 py-12 px-4 md:px-8 text-center text-xs text-zinc-500 font-mono">
        <p>&copy; {new Date().getFullYear()} QueueWatch. Operational Reliability Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
