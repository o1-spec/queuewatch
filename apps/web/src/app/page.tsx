'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Activity,
  ShieldCheck,
  ArrowRight,
  Cpu,
  Database,
  Inbox,
  AlertTriangle,
  Play,
  FileCode,
  CheckCircle2,
  Sparkles,
  Network,
  TrendingUp,
  Clock,
  Layers,
  ChevronRight,
  Search,
  BookOpen,
  Share2,
  LineChart,
  Copy,
  Check,
  Server,
  Zap,
  BarChart3,
  RefreshCw,
  FolderSync
} from 'lucide-react';

const FADE_UP = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' }
};

export default function SaaSLandingPage() {
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<'dashboard' | 'investigation' | 'reliability'>('dashboard');
  const [copiedSdk, setCopiedSdk] = useState(false);
  const [activeCopilotQuery, setActiveCopilotQuery] = useState(0);

  const copilotDialogues = [
    {
      question: 'Why is webhook_delivery failing?',
      answer: `Found 1 active incident on queue "webhook_delivery" (ID: inc-stripe-503).
• Issue: Stripe API endpoint returned HTTP 503 (Service Unavailable) consecutively.
• Retry Pattern: Attempt 3/3 failed at 20:04:12.
• Evidence: Downstream dependency "svc_payment" is currently degraded.
• Recommendation: Pause consumer or replay jobs once Stripe API status page reports recovery.`,
      confidence: 'HIGH',
      metrics: { latency: '42ms', tokens: '104' }
    },
    {
      question: 'What changed before this incident?',
      answer: `Correlated 1 deployment event:
• Deployment Commit: "git commit c72cf2b" (svc_payment v2.4.1) deployed by admin@queuewatch.io.
• Timestamp: 2026-06-03T19:48:42 (12 minutes before failures began).
• Change Diff: Added stricter Zod validations to Stripe payment payload.
• Impact: Jobs enqueued with the old payload format are failing validation: "Missing parameter 'imageUrl'".`,
      confidence: 'HIGH',
      metrics: { latency: '68ms', tokens: '148' }
    },
    {
      question: 'Which queue has the highest retry rate?',
      answer: `Analyzing last 24h queue telemetry:
• Queue: "image_processing" has the highest retry rate of 8.4%.
• Cause: 89% of retries occur during CPU-intensive AVIF image compression tasks.
• Worker Health: Worker "img-worker-node-2" CPU load spiked to 92% causing transient timeouts.
• Resolution: Recommend scaling worker instances from 2 to 4 or offloading to GPU nodes.`,
      confidence: 'MEDIUM',
      metrics: { latency: '51ms', tokens: '122' }
    }
  ];

  const handleCopySdk = () => {
    navigator.clipboard.writeText('pnpm add @queuewatch/node');
    setCopiedSdk(true);
    setTimeout(() => setCopiedSdk(false), 2000);
  };

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen relative overflow-x-hidden w-full font-sans antialiased">
      {/* Background SRE Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f11_1px,transparent_1px),linear-gradient(to_bottom,#0f0f11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Sticky top navbar */}
      <header className="border-b border-zinc-900/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-50 px-4 md:px-8 lg:px-12 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-5.5 h-5.5 rounded bg-zinc-100 flex items-center justify-center font-bold text-xs text-black shadow-md font-mono shrink-0">
            Q
          </div>
          <span className="font-mono font-extrabold text-[12px] tracking-wider text-white">QUEUEWATCH</span>
          <span className="bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider hidden sm:inline">
            op-intel v5
          </span>
        </div>

        <nav className="hidden md:flex items-center space-x-6 text-[11px] font-mono font-semibold text-zinc-400">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="#solutions" className="hover:text-white transition-colors">Solutions</Link>
          <Link href="#docs" className="hover:text-white transition-colors">Docs</Link>
          <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="#blog" className="hover:text-white transition-colors">Blog</Link>
        </nav>

        <div className="flex items-center space-x-3">
          <Link href="/login" className="text-[11px] font-bold font-mono text-zinc-400 hover:text-white transition-colors px-3 py-1.5">
            Sign In
          </Link>
          <Link
            href="/login?demo=true"
            className="px-3 py-1.5 rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-100 hover:text-white font-extrabold text-[11px] transition-all flex items-center space-x-1.5 font-mono"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      {/* SECTION 1: HERO */}
      <section className="relative px-4 md:px-8 lg:px-12 pt-16 pb-24 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <motion.div
          className="lg:col-span-5 space-y-6"
          initial="initial"
          animate="animate"
          variants={FADE_UP}
        >
          <div className="inline-flex items-center space-x-2 bg-zinc-900/60 border border-zinc-800/80 px-2.5 py-1 rounded text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>PROACTIVE INCIDENT MITIGATION</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.1] font-sans">
            Understand failures before your customers do.
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-xl">
            QueueWatch helps engineering teams monitor queues, investigate incidents, analyze worker health, and improve the reliability of asynchronous systems.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/login?demo=true"
              className="px-4.5 py-2 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold text-[11px] transition-all flex items-center justify-center space-x-2 font-mono shadow-md"
            >
              <span>Start Monitoring</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/login?demo=true"
              className="px-4.5 py-2 rounded bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-extrabold text-[11px] transition-all flex items-center justify-center font-mono"
            >
              View Demo
            </Link>
          </div>
        </motion.div>

        {/* Dashboard Preview Graphic */}
        <motion.div
          className="lg:col-span-7 bg-zinc-950/80 border border-zinc-900 rounded-lg p-5 shadow-2xl space-y-5 select-none text-zinc-400 relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3 text-[10px] font-mono">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
              <span className="text-zinc-200 font-bold uppercase tracking-wider">operational health center</span>
            </div>
            <span className="text-zinc-500 font-mono">redis://127.0.0.1:6379</span>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-zinc-300 font-mono">
            <div className="bg-zinc-900/20 border border-zinc-900/80 p-3 rounded">
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">reliability score</p>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-xl font-bold text-emerald-400">89</span>
                <span className="text-[9px] text-zinc-500">/ 100</span>
              </div>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-900/80 p-3 rounded">
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">active incidents</p>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-xl font-bold text-rose-500">1</span>
                <span className="text-[9px] text-zinc-500">unresolved</span>
              </div>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-900/80 p-3 rounded">
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">queue status</p>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-xl font-bold text-white">4</span>
                <span className="text-[9px] text-zinc-500">online</span>
              </div>
            </div>
            <div className="bg-zinc-900/20 border border-zinc-900/80 p-3 rounded">
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">worker health</p>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-xl font-bold text-amber-500">Degraded</span>
              </div>
            </div>
          </div>

          {/* Active Incident Block */}
          <div className="border border-rose-900/40 bg-rose-950/5 rounded p-3.5 space-y-2 font-mono text-[10.5px]">
            <div className="flex items-center justify-between text-[9px] text-rose-500 font-bold">
              <span className="flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>CRITICAL INCIDENT DETECTED</span>
              </span>
              <span>ID: inc-stripe-503</span>
            </div>
            <p className="text-zinc-200 font-semibold text-[11px] leading-snug">
              ZodValidationError: Stripe webhook endpoint returned 503 Service Unavailable.
            </p>
            <div className="bg-zinc-950/80 border border-zinc-900 p-2 rounded text-[10px] text-zinc-500">
              <span className="text-zinc-400 font-bold">Investigation Summary:</span> DOWNSTREAM CASCADE. Downstream microservice <code className="text-amber-500">svc_payment</code> execution failed due to an invalid JSON arguments list payload schema error in the enqueued jobs data.
            </div>
          </div>

          {/* Queues Status Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Telemetry Queue Registry</span>
              <span className="text-[9px] text-zinc-500 font-mono">1,432 processed/min</span>
            </div>
            <div className="border border-zinc-900 rounded overflow-hidden text-[10.5px] font-mono">
              <div className="grid grid-cols-12 bg-zinc-900/50 border-b border-zinc-900 px-3 py-2 text-zinc-500 font-bold">
                <div className="col-span-5">QUEUE</div>
                <div className="col-span-2 text-right">WAITING</div>
                <div className="col-span-2 text-right">ACTIVE</div>
                <div className="col-span-3 text-right">RELIABILITY</div>
              </div>
              <div className="divide-y divide-zinc-900">
                <div className="grid grid-cols-12 px-3 py-2 text-zinc-300">
                  <div className="col-span-5 text-white font-semibold">webhook_delivery</div>
                  <div className="col-span-2 text-right text-zinc-500">0</div>
                  <div className="col-span-2 text-right text-zinc-500">0</div>
                  <div className="col-span-3 text-right text-rose-500 font-bold">72.5%</div>
                </div>
                <div className="grid grid-cols-12 px-3 py-2 text-zinc-300">
                  <div className="col-span-5 text-white font-semibold">email_notifications</div>
                  <div className="col-span-2 text-right text-zinc-500">14</div>
                  <div className="col-span-2 text-right text-indigo-400">2</div>
                  <div className="col-span-3 text-right text-emerald-400 font-bold">99.8%</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* SECTION 2: SOCIAL PROOF BAR */}
      <section className="border-y border-zinc-900 bg-zinc-950/60 py-8 px-4 md:px-8 text-center">
        <div className="max-w-6xl mx-auto space-y-4">
          <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
            Built for modern asynchronous systems
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {['BullMQ', 'Redis', 'Workers', 'Background Jobs', 'Dead-Letter Queues', 'Incident Investigations'].map((tech) => (
              <span
                key={tech}
                className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-mono px-3 py-1 rounded-full font-semibold"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: THE PROBLEM */}
      <section className="py-24 px-4 md:px-8 lg:px-12 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-3">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">OPERATIONAL CHALLENGES</span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
            Most failures happen in the background.
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: 'Retries explode',
              desc: 'Transient errors cause jobs to fail repeatedly. Exponential backoffs saturate queues, creating severe processing backlogs and worker fatigue.'
            },
            {
              title: 'Workers silently fail',
              desc: 'Memory leaks and unhandled promise rejections crash background worker nodes silently without generating standard HTTP exception alerts.'
            },
            {
              title: 'Dead-letter queues grow',
              desc: 'Stuck payloads are routed to DLQ sinks. They remain unmonitored until downstream databases drift and customer pipelines freeze.'
            },
            {
              title: 'Customers notice first',
              desc: 'Observability gaps in asynchronous event brokers mean engineering remains unaware of queue failure cascades until support tickets spike.'
            }
          ].map((card, i) => (
            <div key={i} className="bg-zinc-900/30 border border-zinc-900 p-5 rounded space-y-3">
              <span className="font-mono text-[10.5px] text-zinc-500 font-bold uppercase tracking-wider block">0{i + 1} {'//'}</span>
              <h4 className="text-sm font-bold text-white">{card.title}</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: WHAT QUEUEWATCH DOES */}
      <section className="py-20 border-t border-zinc-900 bg-zinc-950/40 px-4 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Column 1 */}
          <div className="bg-zinc-950 border border-zinc-900 p-6 rounded space-y-4">
            <div className="flex items-center space-x-2 text-indigo-400">
              <Activity className="w-4 h-4" />
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider">Monitor</h4>
            </div>
            <ul className="space-y-4 pt-2">
              {[
                { title: 'Queue Metrics', desc: 'Realtime waiting, active, delayed, and throughput metrics straight from Redis memory hashes.' },
                { title: 'Worker Health', desc: 'Tracks active worker threads, concurrency load, CPU limits, and RAM usage ratios.' },
                { title: 'Retry Analysis', desc: 'Visualizes retry loops and schedules to isolate failing patterns and systemic dependencies.' },
                { title: 'Dead-Letter Visibility', desc: 'Direct access to failed and dead-letter jobs before they are discarded by TTL limits.' }
              ].map((item, index) => (
                <li key={index} className="space-y-1">
                  <h5 className="text-xs font-bold text-zinc-200">{item.title}</h5>
                  <p className="text-zinc-450 text-[11px] leading-relaxed">{item.desc}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2 */}
          <div className="bg-zinc-950 border border-zinc-900 p-6 rounded space-y-4">
            <div className="flex items-center space-x-2 text-rose-450">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider">Investigate</h4>
            </div>
            <ul className="space-y-4 pt-2">
              {[
                { title: 'Incident Detection', desc: 'Deterministic rules audit backlog accumulations, SLA spikes, and high retry loops.' },
                { title: 'Root Cause Analysis', desc: 'Deep payload stacktrace parsing isolates corrupted payloads and schema mismatches.' },
                { title: 'Timeline Reconstruction', desc: 'Correlates worker metrics, queue events, and error stack logs in a chronological graph.' },
                { title: 'Evidence Collection', desc: 'Isolates and logs failing parameters automatically for direct reproduction runs.' }
              ].map((item, index) => (
                <li key={index} className="space-y-1">
                  <h5 className="text-xs font-bold text-zinc-200">{item.title}</h5>
                  <p className="text-zinc-450 text-[11px] leading-relaxed">{item.desc}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 */}
          <div className="bg-zinc-950 border border-zinc-900 p-6 rounded space-y-4">
            <div className="flex items-center space-x-2 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider">Improve Reliability</h4>
            </div>
            <ul className="space-y-4 pt-2">
              {[
                { title: 'Reliability Scores', desc: 'Calculates active SLA ratings (0-100) per queue based on real operational telemetry.' },
                { title: 'Operational Insights', desc: 'Surfaces recommendations to scale consumers, clear buffers, or refactor timeouts.' },
                { title: 'Runbooks', desc: 'Provides step-by-step SRE playbook guides tied directly to active queue error parameters.' },
                { title: 'Predictive Warnings', desc: 'Forecasts storage limits and backlog bounds using deterministic growth rates.' }
              ].map((item, index) => (
                <li key={index} className="space-y-1">
                  <h5 className="text-xs font-bold text-zinc-200">{item.title}</h5>
                  <p className="text-zinc-450 text-[11px] leading-relaxed">{item.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* SECTION 5: PRODUCT SHOWCASE TABS */}
      <section className="py-24 px-4 md:px-8 lg:px-12 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">Interactive Showcase</span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Designed for the modern SRE stack.
          </h3>
        </div>

        {/* Tab Buttons */}
        <div className="flex justify-center border-b border-zinc-900 max-w-lg mx-auto font-mono text-[11px] gap-2">
          {(['dashboard', 'investigation', 'reliability'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveShowcaseTab(tab)}
              className={`flex-1 pb-3 text-center transition-colors relative font-bold uppercase ${
                activeShowcaseTab === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab === 'dashboard' ? 'Health Overview' : tab === 'investigation' ? 'Incident File' : 'Reliability Ledger'}
              {activeShowcaseTab === tab && (
                <motion.div
                  layoutId="showcase-tab-border"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 shadow-xl max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {activeShowcaseTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 font-mono"
              >
                {/* System Health */}
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3 text-[11px] text-zinc-400">
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-white font-bold">SYSTEM OVERVIEW</span>
                  </div>
                  <span>Uptime: 99.98%</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">active nodes</span>
                    <p className="text-xl font-bold text-white mt-1">12 / 12 running</p>
                  </div>
                  <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">throughput p95</span>
                    <p className="text-xl font-bold text-white mt-1">421ms latency</p>
                  </div>
                  <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">total memory load</span>
                    <p className="text-xl font-bold text-white mt-1">1.4 GB</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeShowcaseTab === 'investigation' && (
              <motion.div
                key="investigation"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 font-mono text-[10.5px]"
              >
                {/* Root Cause UI */}
                <div className="border border-zinc-900 bg-zinc-900/10 p-4 rounded space-y-3">
                  <div className="flex items-center justify-between text-zinc-500 text-[10px]">
                    <span className="text-rose-500 font-bold uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> ROOT CAUSE FOUND
                    </span>
                    <span>Class: TypeError</span>
                  </div>
                  <h4 className="text-zinc-200 font-semibold text-[11px] leading-snug">
                    Cannot read properties of undefined (reading &apos;customer_id&apos;) inside worker thread <code className="text-indigo-400">payments-listener-2</code>.
                  </h4>
                  <div className="p-2.5 bg-black/60 border border-zinc-900 rounded space-y-1 text-zinc-400">
                    <span className="text-zinc-300 font-bold">Evidence:</span> Captured 4 telemetry payload logs matching active Redis broker state during job execution parameters.
                  </div>
                  <div className="p-2.5 bg-zinc-950 border border-zinc-900 rounded space-y-1">
                    <span className="text-emerald-400 font-bold">Recommendation:</span> Ensure pre-validation middleware checks for object presence before dereferencing object attributes.
                  </div>
                </div>
              </motion.div>
            )}

            {activeShowcaseTab === 'reliability' && (
              <motion.div
                key="reliability"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 font-mono"
              >
                {/* Reliability scores */}
                <div className="border border-zinc-900 bg-zinc-900/10 p-4 rounded space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Queue Performance Index</span>
                    <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Stable
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { name: 'svc_order', score: '99.2', status: 'Stable' },
                      { name: 'svc_payment', score: '72.5', status: 'Degraded' },
                      { name: 'svc_notification', score: '98.8', status: 'Stable' },
                      { name: 'svc_auth', score: '100.0', status: 'Healthy' }
                    ].map((item) => (
                      <div key={item.name} className="p-3 bg-zinc-950 border border-zinc-900 rounded text-[11px]">
                        <span className="text-zinc-500 font-bold">{item.name}</span>
                        <div className="flex items-baseline space-x-2 mt-1">
                          <span className="text-base font-extrabold text-white">{item.score}</span>
                          <span className={`text-[9px] uppercase font-bold ${item.status === 'Degraded' ? 'text-amber-500' : 'text-emerald-400'}`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* SECTION 6: HOW IT WORKS */}
      <section className="py-24 border-t border-zinc-900 bg-zinc-950/40 px-4 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">workflow pipeline</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Zero agents. Complete visibility.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {[
              {
                step: 'Step 1',
                title: 'Install SDK',
                code: 'pnpm add @queuewatch/node',
                desc: 'Import and initialize the telemetry collector within your microservices.'
              },
              {
                step: 'Step 2',
                title: 'Stream telemetry',
                code: 'stream: telemetry',
                desc: 'QueueWatch receives real-time queue events and worker execution telemetry.'
              },
              {
                step: 'Step 3',
                title: 'Detect incidents',
                code: 'rules: evaluate',
                desc: 'Operational anomalies evaluate against SLA limits to detect failures.'
              },
              {
                step: 'Step 4',
                title: 'Investigate',
                code: 'action: report',
                desc: 'Isolate root cause stacktraces, payload issues, and downstream cascades.'
              }
            ].map((step, idx) => (
              <div key={idx} className="space-y-3.5 relative">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
                  <span className="font-mono text-[9px] text-indigo-400 font-bold uppercase tracking-widest">{step.step}</span>
                  <span className="text-zinc-600 font-mono text-[10px]">#0{idx + 1}</span>
                </div>
                <h4 className="text-sm font-bold text-white">{step.title}</h4>
                {step.code.includes('pnpm') ? (
                  <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded text-[10px] font-mono text-zinc-350 flex items-center justify-between">
                    <span>{step.code}</span>
                    <Copy className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 cursor-pointer" onClick={handleCopySdk} />
                  </div>
                ) : (
                  <div className="bg-zinc-950 border border-zinc-900/60 p-2 rounded text-[10px] font-mono text-zinc-500 uppercase tracking-wider text-center">
                    {step.code}
                  </div>
                )}
                <p className="text-zinc-400 text-xs leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7: RELIABILITY COPILOT */}
      <section className="py-24 px-4 md:px-8 lg:px-12 max-w-7xl mx-auto space-y-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-5">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">operational intelligence</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
              Meet your Reliability Copilot.
            </h3>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              Ask operational questions and query system status directly. The copilot correlates logs, queue metrics, and deployment events to deliver trace-grounded SRE facts.
            </p>

            <div className="space-y-2 font-mono text-[10.5px]">
              {copilotDialogues.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveCopilotQuery(idx)}
                  className={`w-full text-left p-3 rounded border transition-colors flex items-center justify-between font-semibold ${
                    activeCopilotQuery === idx
                      ? 'bg-zinc-900 border-zinc-700 text-white'
                      : 'bg-zinc-950 border-zinc-900 text-zinc-450 hover:text-zinc-200'
                  }`}
                >
                  <span>{item.question}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 bg-zinc-950 border border-zinc-900 rounded-lg p-5 shadow-xl font-mono text-[11px] space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 text-[9px] text-zinc-500 font-bold">
              <span>COPILOT DIAGNOSIS CHANNEL</span>
              <span className="flex items-center space-x-1.5">
                <span className="text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-1.5 py-0.5 rounded text-[8.5px] uppercase tracking-wider font-extrabold">
                  Confidence: {copilotDialogues[activeCopilotQuery].confidence}
                </span>
              </span>
            </div>

            <div className="space-y-3 min-h-[160px] overflow-y-auto pr-1">
              <div className="flex items-center space-x-2 text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                <span>Question: {copilotDialogues[activeCopilotQuery].question}</span>
              </div>
              <div className="bg-zinc-900/25 border border-zinc-900/80 p-3.5 rounded text-zinc-350 whitespace-pre-wrap leading-relaxed text-[10.5px]">
                {copilotDialogues[activeCopilotQuery].answer}
              </div>
            </div>

            <div className="border-t border-zinc-900 pt-3 flex items-center justify-between text-[8.5px] text-zinc-500 uppercase tracking-widest font-bold">
              <span>Telemetry correlation node</span>
              <span>latency: {copilotDialogues[activeCopilotQuery].metrics.latency}</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: FEATURE GRID */}
      <section id="features" className="py-24 border-t border-zinc-900 bg-zinc-950/20 px-4 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">Complete capabilities index</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              An engineering-first diagnostics toolkit.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: 'Queue Monitoring',
                icon: Layers,
                desc: 'Realtime waiting, active, delayed, and throughput metrics straight from Redis memory hashes.'
              },
              {
                title: 'Worker Health',
                icon: Cpu,
                desc: 'Tracks active worker threads, concurrency load, CPU limits, and RAM usage ratios.'
              },
              {
                title: 'Incident Investigation',
                icon: AlertTriangle,
                desc: 'Deterministic rules audit backlog accumulations, SLA spikes, and high retry loops.'
              },
              {
                title: 'Reliability Scoring',
                icon: ShieldCheck,
                desc: 'Calculates active SLA ratings (0-100) per queue based on real operational telemetry.'
              },
              {
                title: 'Predictive Insights',
                icon: TrendingUp,
                desc: 'Forecasts storage limits and backlog bounds using deterministic growth rates.'
              },
              {
                title: 'Dead-Letter Recovery',
                icon: Inbox,
                desc: 'Inspect failed job parameters, apply schema corrections, and replay with full safety controls.'
              }
            ].map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div key={idx} className="bg-zinc-950 border border-zinc-900 p-6 rounded space-y-3 transition-colors hover:bg-zinc-900/30">
                  <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-white text-sm font-mono">{feat.title}</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 9: DEVELOPER EXPERIENCE */}
      <section className="py-24 border-t border-zinc-900 bg-zinc-950/40 px-4 md:px-8 lg:px-12">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-mono">developer experience</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Integrate in minutes.
            </h3>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 shadow-2xl font-mono text-[11px] space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 text-[9px] text-zinc-500 font-bold">
              <span>telemetry_registration_example.ts</span>
              <button
                onClick={handleCopySdk}
                className="flex items-center space-x-1 hover:text-white transition-colors uppercase font-bold text-[8.5px]"
              >
                {copiedSdk ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSdk ? 'copied' : 'copy'}</span>
              </button>
            </div>
            <pre className="text-cyan-400 select-all overflow-x-auto whitespace-pre leading-relaxed p-2.5 bg-black/60 rounded">
{`import { monitorQueue } from "@queuewatch/node";

monitorQueue(emailQueue, {
  apiKey: process.env.QUEUEWATCH_API_KEY,
});`}
            </pre>
          </div>

          <p className="text-center text-zinc-400 text-xs max-w-lg mx-auto leading-relaxed font-mono">
            No agents. No complex setup. Connect your BullMQ infrastructure and start collecting operational telemetry.
          </p>
        </div>
      </section>

      {/* SECTION 10: FINAL CTA */}
      <section className="py-28 border-t border-zinc-900 bg-zinc-950 text-center px-4 md:px-8 lg:px-12 space-y-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Stop guessing. Start understanding.
          </h3>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Detect, investigate, and prevent failures across your asynchronous systems.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/login?demo=true"
            className="w-full sm:w-auto px-5 py-2.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold text-xs transition-all shadow-md flex items-center justify-center space-x-2 font-mono"
          >
            <span>Start Monitoring</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/login?demo=true"
            className="w-full sm:w-auto px-5 py-2.5 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-extrabold text-xs transition-all flex items-center justify-center font-mono"
          >
            Book Demo
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-16 px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12 border-b border-zinc-900/60">
          <div className="space-y-4">
            <h5 className="font-mono text-[10.5px] font-bold text-white uppercase tracking-wider">Product</h5>
            <ul className="space-y-2.5 text-xs text-zinc-400 font-semibold font-mono">
              <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="#docs" className="hover:text-white transition-colors">Docs</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h5 className="font-mono text-[10.5px] font-bold text-white uppercase tracking-wider">Resources</h5>
            <ul className="space-y-2.5 text-xs text-zinc-400 font-semibold font-mono">
              <li><Link href="#blog" className="hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="#guides" className="hover:text-white transition-colors">Guides</Link></li>
              <li><Link href="#status" className="hover:text-white transition-colors">Status</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h5 className="font-mono text-[10.5px] font-bold text-white uppercase tracking-wider">Company</h5>
            <ul className="space-y-2.5 text-xs text-zinc-400 font-semibold font-mono">
              <li><Link href="#about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link href="#contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h5 className="font-mono text-[10.5px] font-bold text-white uppercase tracking-wider">Legal</h5>
            <ul className="space-y-2.5 text-xs text-zinc-400 font-semibold font-mono">
              <li><Link href="#privacy" className="hover:text-white transition-colors">Privacy</Link></li>
              <li><Link href="#terms" className="hover:text-white transition-colors">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-zinc-500 font-mono">
          <div className="flex items-center space-x-2.5">
            <div className="w-4.5 h-4.5 rounded bg-zinc-100 flex items-center justify-center font-bold text-[10px] text-black leading-none shrink-0">
              Q
            </div>
            <span className="font-bold text-zinc-300">QueueWatch</span>
          </div>
          <p className="text-[10px]">&copy; {new Date().getFullYear()} QueueWatch. Operational Intelligence Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
