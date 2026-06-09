'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
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
  const { user, isAuthenticated } = useAuth();
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);
  const [activeCopilotQuery, setActiveCopilotQuery] = useState(0);
  const [copiedSdk, setCopiedSdk] = useState(false);
  const [investigationStep, setInvestigationStep] = useState<number>(0);

  const copilotDialogues = [
    {
      question: 'Why is payment processing degraded?',
      answer: `Found 1 active incident on service "Payment Service" (ID: inc_stripe_503).
• Root Cause: Downstream Stripe API endpoint returned consecutive 503 errors.
• Affected Workflows: Checkout completed webhook loops are stalling.
• Business Impact: 42 customers experienced delayed purchase confirmation alerts.
• Recommendation: Scale webhook workers to 4 instances and enable circuit-breaker backoffs.`,
      confidence: 'HIGH',
      metrics: { latency: '42ms', tokens: '104' }
    },
    {
      question: 'Identify the impact of the latest deployment',
      answer: `Correlated 1 deployment event (v2.4.1) deployed by admin@queuewatch.io:
• Timestamp: 2026-06-09T11:12:00 (12 minutes before failures spiked).
• Git Commit: c72cf2b (Added strict Zod payload validations to svc_payment).
• Regression: Old client requests missing 'imageUrl' parameter are rejected by the worker.
• Resolution: Recommend rolling back to v2.4.0 or deploying quick validation patch.`,
      confidence: 'HIGH',
      metrics: { latency: '68ms', tokens: '148' }
    },
    {
      question: 'Which service has the lowest reliability score?',
      answer: `Analyzing reliability scores across registered systems:
• Lowest: "Order Service" (72.5%) due to cascaded webhook timeout failures.
• Active Outages: 1 unresolved critical warning on Stripe integration.
• Average MTTR: 28 minutes over the last 7 days.
• Health Score Trend: -12% compared to the previous week's baseline.`,
      confidence: 'MEDIUM',
      metrics: { latency: '51ms', tokens: '122' }
    }
  ];

  const sdkCodeText = `import { monitorQueue } from "@queuewatch/node";

monitorQueue(checkoutQueue, {
  projectId: process.env.QUEUEWATCH_PROJECT_ID,
  apiKey: process.env.QUEUEWATCH_API_KEY,
  endpoint: "https://api.queuewatch.io"
});`;

  const copyTextToClipboard = (text: string) => {
    if (typeof window === 'undefined') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch((err) => {
        console.error('Failed to copy: ', err);
        fallbackCopyText(text);
      });
    } else {
      fallbackCopyText(text);
    }
  };

  const fallbackCopyText = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed: ', err);
    }
    document.body.removeChild(textArea);
  };

  const handleCopySdk = () => {
    copyTextToClipboard(sdkCodeText);
    setCopiedSdk(true);
    setTimeout(() => setCopiedSdk(false), 2000);
  };

  // Auto-animate the hero workflow visual steps
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveWorkflowStep((prev) => (prev + 1) % 4);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen relative overflow-x-hidden w-full font-sans antialiased">
      {/* Background SRE Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f11_1px,transparent_1px),linear-gradient(to_bottom,#0f0f11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Top sticky navbar */}
      <header className="border-b border-zinc-900/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-50 px-4 md:px-8 lg:px-12 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-5.5 h-5.5 rounded bg-zinc-100 flex items-center justify-center font-bold text-xs text-black shadow-md font-mono shrink-0">
            Q
          </div>
          <span className="font-mono font-extrabold text-[12px] tracking-wider text-white">QUEUEWATCH</span>
          <span className="bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider hidden sm:inline">
            RELIABILITY OP-INTEL
          </span>
        </div>

        <nav className="hidden md:flex items-center space-x-6 text-xs font-mono font-semibold text-zinc-400">
          <Link href="#observe" className="hover:text-white transition-colors">Observe</Link>
          <Link href="#diagnose" className="hover:text-white transition-colors">Diagnose</Link>
          <Link href="#copilot" className="hover:text-white transition-colors">Copilot</Link>
          <Link href="#systems" className="hover:text-white transition-colors">Supported Systems</Link>
        </nav>

        <div className="flex items-center space-x-3 font-mono">
          {isAuthenticated() ? (
            <>
              <span className="text-[11px] text-zinc-400 hidden sm:inline">
                SRE: <span className="text-zinc-200 font-semibold">{user?.name || user?.email}</span>
              </span>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded border border-zinc-850 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 hover:text-white font-extrabold text-xs transition-all flex items-center space-x-1.5"
              >
                <span>Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="text-xs font-bold text-zinc-400 hover:text-white transition-colors px-3.5 py-2">
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 rounded border border-zinc-850 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold text-xs transition-all flex items-center space-x-1.5"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>
      </header>

      {/* SECTION 1: HERO */}
      <section className="relative px-4 md:px-8 lg:px-12 pt-20 pb-28 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6 animate-slide-up">
          <div className="inline-flex items-center space-x-2 bg-zinc-900/60 border border-zinc-800/80 px-2.5 py-1 rounded text-indigo-400 text-[10px] font-mono font-bold uppercase tracking-wider shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span>AI Reliability Engineer</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.08] font-sans">
            AI-Powered Reliability Intelligence for Modern Systems
          </h1>

          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-xl">
            Monitor queues, workers, jobs, services, and operational workflows in real time. Detect incidents, diagnose root causes, and resolve failures faster with AI-powered operational intelligence.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={isAuthenticated() ? "/dashboard" : "/register"}
              className="px-5 py-2.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold text-xs transition-all flex items-center justify-center space-x-2 font-mono shadow-lg"
            >
              <span>{isAuthenticated() ? "Open Control Center" : "Get Started"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800 text-zinc-350 hover:text-white font-bold text-xs transition-all flex items-center justify-center space-x-2 font-mono"
            >
              <span>Book Demo</span>
            </Link>
            <Link
              href="#observe"
              className="px-5 py-2.5 rounded text-zinc-500 hover:text-zinc-300 font-bold text-xs transition-all flex items-center justify-center font-mono"
            >
              <span>View Docs</span>
            </Link>
          </div>
        </div>

        {/* Visual: Live Reliability Workflow Progression */}
        <div className="lg:col-span-6 bg-zinc-950 border border-zinc-900 rounded-xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between h-[360px]">
          <div className="absolute top-0 right-0 p-3 text-[9px] font-mono text-zinc-650 select-none">
            REALTIME ENGINE // ACTIVE
          </div>

          <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-500 border-b border-zinc-900 pb-3">
            <Server className="w-4.5 h-4.5 text-zinc-400" />
            <span>OPERATIONAL HEALTH WORKFLOW</span>
          </div>

          {/* Connected Steps */}
          <div className="space-y-4 my-auto">
            {[
              { label: 'Incident Detected', desc: 'SLA breach triggered on webhook consumer', color: 'border-rose-900/60 text-rose-500 bg-rose-950/10' },
              { label: 'Root Cause Found', desc: 'Stripe API consecutively timeout: 503 errors', color: 'border-amber-900/60 text-amber-500 bg-amber-950/10' },
              { label: 'Business Impact Identified', desc: 'Payment transactions sync halted', color: 'border-indigo-900/60 text-indigo-400 bg-indigo-950/10' },
              { label: 'Recommended Fix Generated', desc: 'Deploy Circuit Breaker retry middleware', color: 'border-emerald-900/60 text-emerald-400 bg-emerald-950/10' }
            ].map((step, idx) => {
              const isActive = activeWorkflowStep === idx;
              return (
                <div
                  key={idx}
                  className={`flex items-start space-x-3.5 border p-3 rounded-lg transition-all duration-500 ${
                    isActive
                      ? `${step.color} scale-[1.02] shadow-md`
                      : 'border-zinc-900/40 text-zinc-500 bg-zinc-950 opacity-40'
                  }`}
                >
                  <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold border ${
                    isActive ? 'border-current bg-zinc-950 shadow-inner' : 'border-zinc-800'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="text-[11.5px] font-mono">
                    <p className={`font-bold uppercase tracking-wider ${isActive ? 'text-zinc-100' : 'text-zinc-650'}`}>
                      {step.label}
                    </p>
                    <p className="text-[10px] mt-0.5 text-zinc-450">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 2: THE PROBLEM */}
      <section className="py-24 border-t border-zinc-900 bg-zinc-950/40 px-4 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">SYSTEM COMPLEXITY</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Modern Distributed Workflows Are Hard To Operate
            </h2>
            <p className="text-zinc-450 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
              When components interact, a single failure cascades silently through your background services, webhooks, and queues. Teams waste hours digging through siloed systems just trying to discover what happened.
            </p>
          </div>

          {/* Interactive Dependency Visualizer Mock */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 shadow-xl max-w-4xl mx-auto font-mono text-[11px] space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 text-zinc-500 text-[10px]">
              <span>DISTRIBUTED TRANSACTION DEPENDENCIES</span>
              <span className="text-rose-500 animate-pulse font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> ERROR PROPAGATION ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
              {[
                { name: 'Payment Webhook', type: 'API boundary', status: 'normal', color: 'border-zinc-800 text-zinc-400' },
                { name: 'Payment processing', type: 'BullMQ Queue', status: 'degraded', color: 'border-amber-800 bg-amber-950/5 text-amber-500' },
                { name: 'Invoice generation', type: 'BullMQ Queue', status: 'normal', color: 'border-zinc-800 text-zinc-400' },
                { name: 'Email Delivery', type: 'Cron Job', status: 'critical', color: 'border-rose-900 bg-rose-950/5 text-rose-500' },
                { name: 'Background Workers', type: 'Services', status: 'normal', color: 'border-zinc-800 text-zinc-400' }
              ].map((node, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className={`w-full border p-3 rounded-lg text-center font-bold ${node.color}`}>
                    <p className="text-[11px]">{node.name}</p>
                    <p className="text-[8.5px] text-zinc-500 font-normal uppercase tracking-wider mt-1">{node.type}</p>
                  </div>
                  {i < 4 && (
                    <div className="h-6 w-px bg-gradient-to-b from-zinc-800 to-transparent md:h-px md:w-full md:bg-gradient-to-r md:from-zinc-800 md:to-transparent my-1 md:my-0" />
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 bg-zinc-900/10 border border-zinc-900 rounded-lg text-zinc-400 leading-relaxed text-[10.5px]">
              <span className="text-zinc-200 font-bold">Cascade Alert:</span> Webhook payment processing delays triggered a backlog cascade. The invoice service is waiting for confirmations, causing outbound notification crons to timeout.
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: WHAT QUEUEWATCH DOES (4-Card) */}
      <section id="observe" className="py-24 border-t border-zinc-900 bg-zinc-950 px-4 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">Platform Capabilities</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Operational Intelligence Made Simple
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Observe',
                icon: Activity,
                desc: 'Monitor queues, workers, retries, dead-letter queues, deployments, and operational workflows.',
                color: 'border-indigo-900/60 hover:border-indigo-800/80 text-indigo-400 bg-indigo-950/5'
              },
              {
                title: 'Detect',
                icon: AlertTriangle,
                desc: 'Automatically identify incidents, anomalies, bottlenecks, and system reliability risks.',
                color: 'border-rose-900/60 hover:border-rose-800/80 text-rose-500 bg-rose-950/5'
              },
              {
                title: 'Diagnose',
                icon: Sparkles,
                desc: 'Use AI to investigate failures, correlate metrics, and trace exact root causes.',
                color: 'border-amber-900/60 hover:border-amber-800/80 text-amber-500 bg-amber-950/5'
              },
              {
                title: 'Resolve',
                icon: ShieldCheck,
                desc: 'Generate copy-paste remediation code, runbooks, and action plans to prevent recurrences.',
                color: 'border-emerald-900/60 hover:border-emerald-800/80 text-emerald-400 bg-emerald-950/5'
              }
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className={`border p-6 rounded-xl space-y-4 transition-all duration-300 ${card.color}`}>
                  <div className="w-8 h-8 rounded bg-zinc-950 border border-zinc-900 flex items-center justify-center shrink-0 shadow-inner">
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-zinc-100 font-mono">{card.title}</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 4: OPERATIONAL INTELLIGENCE COMPARISON */}
      <section className="py-24 border-t border-zinc-900 bg-zinc-950/40 px-4 md:px-8 lg:px-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-6">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">WHY QUEUEWATCH</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Most observability tools tell you WHAT happened.
            </h2>
            <p className="text-zinc-100 font-extrabold text-base leading-snug">
              QueueWatch helps you understand WHY it happened.
            </p>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              Stop guessing when metrics spike. Instead of looking at raw graphs of queue volumes, get correlated root cause files with clear business impact summaries and instant code-level recommendations.
            </p>
          </div>

          {/* Comparison Cards */}
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[10.5px]">
            {/* Traditional */}
            <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Traditional Tools</span>
              <div className="space-y-2 text-zinc-400">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <span>Queue Depth:</span>
                  <span className="text-rose-500 font-bold">8,000</span>
                </div>
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <span>Failure Rate:</span>
                  <span className="text-rose-500 font-bold">34%</span>
                </div>
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <span>Worker Latency:</span>
                  <span className="text-white font-bold">6.2s</span>
                </div>
              </div>
              <p className="text-[9.5px] text-zinc-650 italic leading-snug pt-2">
                Requires SRE team to parse logs, map trace IDs, and query external APIs to find the bug.
              </p>
            </div>

            {/* QueueWatch */}
            <div className="bg-zinc-900/15 border border-indigo-900/60 p-5 rounded-lg space-y-4 shadow-md shadow-indigo-950/20">
              <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">QueueWatch Engine</span>
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Root Cause:</span>
                  <p className="text-zinc-100 font-semibold leading-snug">SMTP provider (SendGrid) returned rate limits (HTTP 429).</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Business Impact:</span>
                  <p className="text-zinc-300 leading-snug">Order confirmation emails delayed. Checkout transactions unaffected.</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Remediation:</span>
                  <p className="text-emerald-400 font-bold leading-snug">Throttle worker concurrency limit to 2 nodes during cooling window.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: SUPPORTED SYSTEMS */}
      <section id="systems" className="border-y border-zinc-900 bg-zinc-950/60 py-16 px-4 md:px-8 text-center">
        <div className="max-w-5xl mx-auto space-y-6">
          <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
            Built for modern distributed systems
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              'BullMQ',
              'RabbitMQ',
              'Background Jobs',
              'Webhooks',
              'Workers',
              'Cron Jobs',
              'Event-Driven Services'
            ].map((system) => (
              <span
                key={system}
                className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10.5px] font-mono px-4 py-1.5 rounded-md font-semibold"
              >
                {system}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6: INCIDENT INVESTIGATION */}
      <section id="diagnose" className="py-24 px-4 md:px-8 lg:px-12 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-3">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">Operational Ledger</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Interactive Incident Investigation
          </h2>
          <p className="text-zinc-450 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Follow how QueueWatch tracks, correlates, and analyzes incidents automatically from creation to resolution.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Steps selector */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-2 font-mono text-[10.5px]">
            {[
              { title: 'Incident Created', desc: 'SLA rule triggers anomaly detection' },
              { title: 'Telemetry Collected', desc: 'Worker traces and Redis key dumps isolated' },
              { title: 'AI Investigation', desc: 'LLM synthesizes exceptions and dependencies' },
              { title: 'Root Cause Analysis', desc: 'Identifies faulty deployment and payload parameter' },
              { title: 'Recovery Plan', desc: 'Produces runbook steps and copyable code fixes' }
            ].map((step, idx) => (
              <button
                key={idx}
                onClick={() => setInvestigationStep(idx)}
                className={`w-full text-left p-3.5 rounded-lg border transition-all flex items-start space-x-3 ${
                  investigationStep === idx
                    ? 'bg-zinc-900 border-zinc-700 text-white'
                    : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:text-zinc-350'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center font-bold font-mono text-[9.5px]">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-extrabold text-[11px] uppercase tracking-wider">{step.title}</p>
                  <p className="text-[9.5px] mt-0.5 text-zinc-450">{step.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Interactive UI Mockup */}
          <div className="lg:col-span-8 bg-zinc-950 border border-zinc-900 rounded-xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between font-mono text-[10.5px]">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 text-[9px] text-zinc-500 font-bold uppercase">
              <span>SRE Diagnostics Console</span>
              <span>project: shopflow // env: production</span>
            </div>

            <div className="my-6 space-y-4">
              {investigationStep === 0 && (
                <div className="border border-rose-900 bg-rose-950/5 p-4 rounded-lg space-y-2">
                  <p className="text-[9.5px] text-rose-500 font-bold">STATUS: CRITICAL // SLA VIOLATION</p>
                  <h4 className="text-zinc-200 font-bold text-[11.5px]">Backlog duration exceeded 120s limit on order_processing.</h4>
                  <p className="text-zinc-450 text-[10px] leading-relaxed">
                    Triggered Rule: Critical Queue Failure Rate Trigger (rule_failures) has exceeded the threshold limit of 15% failed jobs over a 60s monitoring window.
                  </p>
                </div>
              )}

              {investigationStep === 1 && (
                <div className="border border-zinc-800 bg-zinc-900/10 p-4 rounded-lg space-y-3">
                  <p className="text-[9.5px] text-zinc-400 font-bold">STATE SNAPSHOT: CONTEXT INGESTION</p>
                  <div className="grid grid-cols-2 gap-3 text-[10px] text-zinc-450">
                    <div className="bg-zinc-900/40 p-2.5 rounded border border-zinc-900">
                      <p className="font-bold text-zinc-300">Redis Metrics</p>
                      <p className="mt-1">Active jobs: 42</p>
                      <p>Waiting jobs: 432</p>
                    </div>
                    <div className="bg-zinc-900/40 p-2.5 rounded border border-zinc-900">
                      <p className="font-bold text-zinc-300">Worker Status</p>
                      <p className="mt-1">Worker instances: 2 online</p>
                      <p>CPU usage: 89.2%</p>
                    </div>
                  </div>
                </div>
              )}

              {investigationStep === 2 && (
                <div className="border border-indigo-900/60 bg-indigo-950/5 p-4 rounded-lg space-y-2">
                  <p className="text-[9.5px] text-indigo-400 font-bold">AI TELEMETRY SYNTHESIS</p>
                  <p className="text-zinc-300 leading-relaxed">
                    Correlating exceptions logs... Found consecutive <code className="text-rose-400 bg-rose-950/20 px-1 py-0.5 rounded">InvalidAddressError</code> exceptions in the trace logs. Downstream service <code className="text-zinc-200 font-bold">svc_shipping</code> reports target location validation API returned 400 Bad Request.
                  </p>
                </div>
              )}

              {investigationStep === 3 && (
                <div className="border border-amber-900/60 bg-amber-950/5 p-4 rounded-lg space-y-2">
                  <p className="text-[9.5px] text-amber-500 font-bold">ROOT CAUSE CORRELATION</p>
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-200">1. Failed Deployment Registry:</p>
                    <p className="text-zinc-450">v1.12.0 deployed by devops@shopflow.io (10m before outage).</p>
                  </div>
                  <div className="space-y-1 mt-2">
                    <p className="font-bold text-zinc-200">2. Mismatched Parameter:</p>
                    <p className="text-zinc-450">Checkout payloads now include postal code as integer instead of string formats. Downstream validation parser crashes on length parsing checks.</p>
                  </div>
                </div>
              )}

              {investigationStep === 4 && (
                <div className="border border-emerald-900/60 bg-emerald-950/5 p-4 rounded-lg space-y-3">
                  <p className="text-[9.5px] text-emerald-400 font-bold">SRE RECOVERY RECIPE</p>
                  <p className="text-zinc-300">Deploy this pre-enqueue validation schema in your checkout middleware to cast postal code types safely:</p>
                  <pre className="bg-black/60 border border-zinc-900 p-2.5 rounded text-cyan-400 text-[9.5px] overflow-x-auto">
{`const payloadSchema = z.object({
  postalCode: z.string().or(z.number().transform(val => val.toString())),
});`}
                  </pre>
                </div>
              )}
            </div>

            <div className="border-t border-zinc-900 pt-3 flex items-center justify-between text-[8px] text-zinc-650 uppercase font-bold tracking-widest">
              <span>Investigation state: {investigationStep + 1} / 5</span>
              <span>traceId: tr_849201a9</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: RELIABILITY COPILOT */}
      <section id="copilot" className="py-24 border-t border-zinc-900 bg-zinc-950/40 px-4 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-5">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">operational intelligence</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
              Reliability Copilot
            </h3>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              QueueWatch acts as an operational copilot, helping engineers investigate incidents, understand failures, and make informed decisions faster without leaving the dashboard console.
            </p>

            <div className="space-y-2 font-mono text-[10.5px]">
              {copilotDialogues.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveCopilotQuery(idx)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between font-semibold ${
                    activeCopilotQuery === idx
                      ? 'bg-zinc-900 border-zinc-700 text-white'
                      : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:text-zinc-200'
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

      {/* SECTION 8: DEVELOPER EXPERIENCE (SDK Integration) */}
      <section className="py-24 border-t border-zinc-900 bg-zinc-950/40 px-4 md:px-8 lg:px-12">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-mono">developer experience</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Deploy the SDK in minutes.
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
            <pre className="text-cyan-455 select-all overflow-x-auto whitespace-pre leading-relaxed p-2.5 bg-black/60 rounded">
{sdkCodeText}
            </pre>
          </div>

          <p className="text-center text-zinc-500 text-xs max-w-lg mx-auto leading-relaxed font-mono">
            No infrastructure agents. No complex sidecars. Connect your queue clients directly and start streaming SRE telemetry metrics in real time.
          </p>
        </div>
      </section>

      {/* SECTION 10: FINAL CTA */}
      <section className="py-28 border-t border-zinc-900 bg-zinc-950 text-center px-4 md:px-8 lg:px-12 space-y-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <h3 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Stop Guessing. Start Understanding.
          </h3>
          <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Turn telemetry into operational intelligence with QueueWatch.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href={isAuthenticated() ? "/dashboard" : "/register"}
            className="w-full sm:w-auto px-6 py-3 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-955 font-extrabold text-sm transition-all shadow-md flex items-center justify-center space-x-2 font-mono"
          >
            <span>{isAuthenticated() ? "Go to Dashboard" : "Get Started"}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/docs"
            className="w-full sm:w-auto px-6 py-3 rounded border border-zinc-850 bg-zinc-900/20 hover:bg-zinc-850 text-zinc-300 font-bold text-sm transition-all flex items-center justify-center font-mono"
          >
            <span>View Docs</span>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-16 px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12 border-b border-zinc-900/60">
          <div className="space-y-4">
            <h5 className="font-mono text-[10.5px] font-bold text-white uppercase tracking-wider">Product</h5>
            <ul className="space-y-2.5 text-xs text-zinc-400 font-semibold font-mono">
              <li><Link href="#observe" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/sdk" className="hover:text-white transition-colors">SDK</Link></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h5 className="font-mono text-[10.5px] font-bold text-white uppercase tracking-wider">Resources</h5>
            <ul className="space-y-2.5 text-xs text-zinc-400 font-semibold font-mono">
              <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              <li><Link href="/docs#api" className="hover:text-white transition-colors">API Reference</Link></li>
              <li><Link href="/docs" className="hover:text-white transition-colors">Status</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h5 className="font-mono text-[10.5px] font-bold text-white uppercase tracking-wider">Company</h5>
            <ul className="space-y-2.5 text-xs text-zinc-400 font-semibold font-mono">
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><a href="https://github.com/o1-spec/queuewatch" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h5 className="font-mono text-[10.5px] font-bold text-white uppercase tracking-wider">Legal</h5>
            <ul className="space-y-2.5 text-xs text-zinc-400 font-semibold font-mono">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
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
          <p className="text-[10px]">&copy; {new Date().getFullYear()} QueueWatch. Operational Reliability Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
