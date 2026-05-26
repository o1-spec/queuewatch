'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Activity, Skull, ShieldCheck, Terminal, ArrowRight, Zap, RefreshCw, Layers } from 'lucide-react';

export default function SaaSLandingPage() {
  return (
    <div className="bg-background text-foreground min-h-screen relative overflow-x-hidden w-full">
      <div className="absolute top-[-10%] left-[-20%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[-10%] w-[40%] h-[60%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none"></div>

      <header className="border-b border-slate-900 bg-slate-950/20 backdrop-blur-md sticky top-0 z-50 px-6 lg:px-12 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-indigo-500/30 shadow-md">
            Q
          </div>
          <div>
            <h1 className="font-extrabold text-md tracking-wider text-white">QueueWatch</h1>
            <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest leading-none">Telemetry Engine</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <a href="#preview" className="hover:text-white transition-colors">Live Preview</a>
        </nav>

        <div className="flex items-center space-x-4">
          <Link href="/login" className="text-sm font-bold text-slate-300 hover:text-white transition-colors px-4 py-2">
            Login
          </Link>
          <Link 
            href="/login?demo=true" 
            className="px-4.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/25 flex items-center space-x-1.5"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <section className="relative px-6 lg:px-12 pt-20 pb-28 text-center max-w-5xl mx-auto space-y-8">
        <div className="inline-flex items-center space-x-2 bg-indigo-950/30 border border-indigo-500/20 px-3.5 py-1.5 rounded-full text-indigo-300 text-[11px] font-bold uppercase tracking-wider animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>DATADOG + AI FOR ASYNCHRONOUS JOB SYSTEMS</span>
        </div>
        
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1] max-w-4xl mx-auto">
          AI-powered observability for background jobs.
        </h2>

        <p className="text-slate-400 text-base sm:text-lg max-w-3xl mx-auto leading-relaxed font-medium">
          Monitor queues, retries, failures, dead-letter jobs, and worker health in real time — with AI insights that explain what went wrong.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/login?demo=true"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2"
          >
            <span>Launch Seeded Guest Demo</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          
          <Link
            href="/register"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-900 text-slate-300 font-extrabold text-sm transition-all flex items-center justify-center"
          >
            Create Free Account
          </Link>
        </div>
      </section>

      <section className="border-t border-slate-950/60 bg-slate-950/15 py-24 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-mono">The SRE Dilemma</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Asynchronous backlogs are silent killers.
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed font-medium">
              Standard Application Performance Monitors (APMs) fail to track background job lifecycles. When a worker silently crashes under an out-of-memory lock or throws SendGrid rate blocks, your logs become cluttered with raw stacks while customers experience stalled welcome mail flows, image compression timeouts, and failed Stripe invoice upgrades.
            </p>
            <div className="p-4 bg-rose-950/10 border border-rose-500/10 rounded-xl flex items-start space-x-3">
              <Skull className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-300">
                <strong className="font-bold block">The Invisible Failure Trap:</strong>
                Failures repeat silently in exponential backoff loop cycles until they are silently discarded or permanently dumped into dead-letter memory.
              </div>
            </div>
          </div>
          
          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 relative overflow-hidden space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-900 pb-3">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-slate-500 font-mono font-bold pl-2">incident_remediation_console.log</span>
            </div>
            <div className="space-y-2 text-xs font-mono text-rose-400">
              <p className="text-slate-500">[21:04:12] ERROR workers.service.ts : image_processing_queue failed</p>
              <p>&rarr; InvalidPayloadError: Schema validation failed. Missing parameter &apos;imageUrl&apos;</p>
              <p className="text-slate-500">[21:04:14] WARN workers.service.ts : attempt 2/3 scheduled with 4000ms delay</p>
            </div>
            <div className="border-t border-slate-900/60 pt-3 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-mono text-indigo-400">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>AI Observability Diagnosis:</span>
              </div>
              <p className="text-xs text-slate-300 italic pl-6 leading-relaxed">
                &quot;Schema parameter mismatch detected. Enforce input schema validation in your API gateway prior to enqueueing to protect Redis network ticks.&quot;
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 px-6 lg:px-12 max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-4">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-mono">Platform Capabilities</span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Datadog + AI for background job systems.
          </h3>
          <p className="text-slate-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            QueueWatch operates as an enterprise SRE command center, analyzing BullMQ Redis streams and injecting LLM-driven remediations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-900 space-y-4 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500/15 transition-all">
              <Activity className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-md">Realtime Queue Monitoring</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Audit active run threads, waiting queues, completed throughput indexes, and delayed job counts inside Redis memory.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-900 space-y-4 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500/15 transition-all">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-md">AI Failure Explanation</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Understand exceptions callstacks. Dynamic LLMs read failed stacks to compile structured operational remedies and code fixes.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-900 space-y-4 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500/15 transition-all">
              <Skull className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-md">Dead-letter Visibility</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Inspect stuck payloads inside dead-letter queues. Dispatch original metadata back to active worker pools with one click.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-900 space-y-4 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500/15 transition-all">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-md">Worker Health Tracking</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Track CPU loads and memory consumption profiles on individual workers. Pinpoint nodes heading toward OOM.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-900 space-y-4 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500/15 transition-all">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-md">Retry & Bottleneck Alerts</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Capture active retry backoff loops, rate limitation blocks, API response delays, and queue congestion bottlenecks immediately.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-900 space-y-4 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500/15 transition-all">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-md">Scaling Recommendations</h4>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Expose copyable Kubernetes HPA auto-scale configurations and BullMQ worker concurrency parameters.
            </p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 border-t border-slate-950/60 bg-slate-950/15 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-mono">Engine Integration</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Integrate in under 60 seconds.
            </h3>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
              No heavy SDK wrappers or custom libraries required. QueueWatch binds straight to your existing Redis broker.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4 relative">
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold font-mono text-white text-xs">
                1
              </div>
              <h4 className="font-bold text-white text-sm">Connect your broker</h4>
              <p className="text-slate-400 text-xs leading-relaxed font-medium">
                Input your Redis address inside environment parameters. Zero code modifications required.
              </p>
            </div>

            <div className="space-y-4 relative">
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold font-mono text-white text-xs">
                2
              </div>
              <h4 className="font-bold text-white text-sm">Real-time listening</h4>
              <p className="text-slate-400 text-xs leading-relaxed font-medium">
                QueueWatch automatically streams enqueued job state ticks, attempts count, and latency intervals.
              </p>
            </div>

            <div className="space-y-4 relative">
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold font-mono text-white text-xs">
                3
              </div>
              <h4 className="font-bold text-white text-sm">Telemetry visualizer</h4>
              <p className="text-slate-400 text-xs leading-relaxed font-medium">
                The glassmorphic dashboard plots completed throughput timeline graphs and maps active worker memory loads.
              </p>
            </div>

            <div className="space-y-4 relative">
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold font-mono text-white text-xs">
                4
              </div>
              <h4 className="font-bold text-white text-sm">AI Remediation</h4>
              <p className="text-slate-400 text-xs leading-relaxed font-medium">
                Whenever workers crash, generative models explain the failure reason and recommend copyable code repairs.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="preview" className="py-24 px-6 lg:px-12 max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-mono">Live UI Preview</span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Observe background jobs like never before.
          </h3>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-900/60 overflow-hidden relative group shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4 text-xs text-slate-500 font-mono font-bold">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 active-pulse-emerald shrink-0"></span>
              <span className="text-slate-300 font-sans">QueueWatch Observability Console</span>
            </div>
            <span>Demo Session Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-slate-950/50 border border-slate-900 rounded-xl space-y-2">
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Jobs processed</p>
              <p className="text-2xl font-extrabold text-white mt-1 font-mono tracking-tight">124,932</p>
              <div className="h-1 bg-slate-900 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-emerald-500 animate-pulse" style={{ width: '80%' }}></div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/50 border border-slate-900 rounded-xl space-y-2">
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Avg Latency spike</p>
              <p className="text-2xl font-extrabold text-cyan-400 mt-1 font-mono tracking-tight">452 ms</p>
              <div className="h-1 bg-slate-900 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-cyan-500" style={{ width: '45%' }}></div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/50 border border-slate-900 rounded-xl space-y-2">
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Dead Letter Queue</p>
              <p className="text-2xl font-extrabold text-rose-500 mt-1 font-mono tracking-tight">0</p>
              <div className="h-1 bg-slate-900 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-slate-800" style={{ width: '0%' }}></div>
              </div>
            </div>
          </div>
          
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex flex-col justify-end items-center pb-8 pt-24">
            <Link
              href="/login?demo=true"
              className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs tracking-wide transition-all shadow-lg shadow-indigo-500/25 flex items-center space-x-2"
            >
              <span>EXPLORE ALL DASHBOARDS NOW</span>
              <ArrowRight className="w-4 h-4 animate-bounce" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-slate-950/60 bg-gradient-to-b from-slate-950/30 to-black/80 text-center px-6 lg:px-12 space-y-8">
        <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight max-w-2xl mx-auto">
          Ready to achieve 100% background job reliability?
        </h3>
        <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
          Monitor threads, trace schemas errors, and inject AI insights into your BullMQ backend now. Set up takes less than a minute.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/login?demo=true"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition-all shadow-md shadow-indigo-500/25 flex items-center justify-center space-x-2"
          >
            <span>Launch Seeded Guest Demo</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-900 text-slate-300 font-extrabold text-xs transition-all flex items-center justify-center"
          >
            Login to Workspace
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-900 py-10 text-center text-xs text-slate-500 px-6 max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center font-bold text-sm text-white leading-none">
            Q
          </div>
          <span className="font-bold text-slate-400">QueueWatch</span>
        </div>
        <p>&copy; 2026 QueueWatch Telemetry Engine. Hackathon MVP. Open Source.</p>
      </footer>
    </div>
  );
}
