'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Terminal,
  Activity,
  Skull,
  ShieldCheck,
  ArrowRight,
  Zap,
  RefreshCw,
  Layers,
  Cpu,
  Database,
  Inbox,
  ChevronRight,
  Command,
  Clock,
  ExternalLink,
  Play,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Sparkles
} from 'lucide-react';

export default function SaaSLandingPage() {
  const [logs, setLogs] = useState<Array<{ time: string; queue: string; job: string; attempt: string; status: 'SUCCESS' | 'ACTIVE' | 'RETRY' | 'FAILED' | 'DLQ'; details: string }>>([
    { time: '21:40:12.103', queue: 'email_queue', job: 'welcome_email', attempt: '1/3', status: 'ACTIVE', details: 'Worker thread [node-1] popped job welcome_email' },
    { time: '21:40:12.450', queue: 'email_queue', job: 'welcome_email', attempt: '1/3', status: 'SUCCESS', details: 'Job processed successfully in 347ms' },
    { time: '21:40:13.120', queue: 'webhook_delivery_queue', job: 'stripe_invoice', attempt: '1/3', status: 'ACTIVE', details: 'Pushing webhook request payload to partner endpoint' },
    { time: '21:40:14.210', queue: 'webhook_delivery_queue', job: 'stripe_invoice', attempt: '1/3', status: 'RETRY', details: 'HTTP 503 Service Unavailable - Scheduling exponential backoff (2000ms)' },
    { time: '21:40:16.215', queue: 'webhook_delivery_queue', job: 'stripe_invoice', attempt: '2/3', status: 'ACTIVE', details: 'Pushing webhook request payload (retry attempt 2)' },
    { time: '21:40:17.302', queue: 'webhook_delivery_queue', job: 'stripe_invoice', attempt: '2/3', status: 'RETRY', details: 'HTTP 503 Service Unavailable - Scheduling exponential backoff (4000ms)' },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs((prev) => {
        const nextLogs = [...prev];
        const newLogOptions = [
          { time: new Date().toLocaleTimeString(), queue: 'image_processing_queue', job: 'profile_avatar', attempt: '1/5', status: 'ACTIVE' as const, details: 'Resizing avatar binary upload usr_avatar_9182' },
          { time: new Date().toLocaleTimeString(), queue: 'image_processing_queue', job: 'profile_avatar', attempt: '1/5', status: 'SUCCESS' as const, details: 'Avatar successfully processed, written to S3 bucket' },
          { time: new Date().toLocaleTimeString(), queue: 'webhook_delivery_queue', job: 'stripe_invoice', attempt: '3/3', status: 'FAILED' as const, details: 'HTTP 503 Timeout - Max retries exceeded' },
          { time: new Date().toLocaleTimeString(), queue: 'webhook_delivery_queue', job: 'stripe_invoice', attempt: '3/3', status: 'DLQ' as const, details: 'Routed to dead_letter_queue. DLQ incident logged.' },
          { time: new Date().toLocaleTimeString(), queue: 'ai_task_queue', job: 'reliability_audit', attempt: '1/3', status: 'ACTIVE' as const, details: 'Auditing active waiting counts on queues:email_queue' },
          { time: new Date().toLocaleTimeString(), queue: 'ai_task_queue', job: 'reliability_audit', attempt: '1/3', status: 'SUCCESS' as const, details: 'Remediation blueprint written to queuewatch:ai_snapshots' },
        ];

        const randomItem = newLogOptions[Math.floor(Math.random() * newLogOptions.length)];
        nextLogs.push(randomItem);
        return nextLogs.slice(-9); // keep last 9 logs
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const [copied, setCopied] = useState(false);
  const copyCommand = () => {
    navigator.clipboard.writeText('npm i @queuewatch/listener');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen relative overflow-x-hidden w-full font-sans antialiased bg-[radial-gradient(#1c1c1e_1px,transparent_1px)] [background-size:24px_24px]">

      {/* Sticky Realtime Navbar */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 px-6 lg:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="w-7 h-7 rounded bg-zinc-100 flex items-center justify-center font-bold text-md text-black shadow-lg">
            Q
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wider text-white">QueueWatch</h1>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-6 text-xs font-mono font-bold tracking-tight text-zinc-400">
          <a href="#console" className="hover:text-white transition-colors">stdout_feed</a>
          <a href="#incidents" className="hover:text-white transition-colors">failures_inspector</a>
          <a href="#features" className="hover:text-white transition-colors">capabilities</a>
          <div className="h-3.5 w-px bg-zinc-800"></div>
          <span className="flex items-center space-x-1.5 bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded text-[10px] text-emerald-400 font-semibold font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>broker: ok</span>
          </span>
        </nav>

        <div className="flex items-center space-x-4">
          <Link href="/login" className="text-xs font-bold font-mono text-zinc-400 hover:text-white transition-colors px-3 py-1.5">
            login
          </Link>
          <Link
            href="/login?demo=true"
            className="px-3.5 py-1.5 rounded border border-zinc-100 bg-zinc-100 text-black hover:bg-zinc-200 font-extrabold text-xs transition-all flex items-center space-x-1.5 shadow-md font-mono"
          >
            <span>guest_demo</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      {/* Hero Split-Grid Section */}
      <section className="relative px-6 lg:px-12 pt-16 pb-20 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

        {/* Left Column: Asymmetrical Copy Block */}
        <div className="lg:col-span-5 space-y-6">
          <div className="inline-flex items-center space-x-2 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span>v1.2.0 • Active Queue Observability</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.05]">
            Visibility for asynchronous systems.
          </h2>

          <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
            A lightweight, production-ready observability platform for BullMQ. Monitor queues, retries, and worker failures in one unified, real-time pane.
          </p>

          {/* Copyable CLI Command */}
          <div className="bg-zinc-950 border border-zinc-800 rounded p-3 flex items-center justify-between max-w-md font-mono text-xs text-zinc-300">
            <div className="flex items-center space-x-2.5">
              <Command className="w-4 h-4 text-zinc-500" />
              <span>npm i @queuewatch/listener</span>
            </div>
            <button
              onClick={copyCommand}
              className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase transition-colors"
            >
              {copied ? 'copied' : 'copy'}
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/login?demo=true"
              className="px-5 py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs tracking-wide transition-all shadow-lg flex items-center justify-center space-x-2 font-mono"
            >
              <span>Launch Live Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/register"
              className="px-5 py-2.5 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-extrabold text-xs transition-all flex items-center justify-center font-mono"
            >
              provision_account
            </Link>
          </div>
        </div>

        {/* Right Column: Denser Operational UI Dashboard Preview */}
        <div className="lg:col-span-7 bg-zinc-950 border border-zinc-900 rounded-lg p-5 shadow-2xl space-y-5 select-none text-zinc-400 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent pointer-events-none z-10"></div>

          <div className="flex items-center justify-between border-b border-zinc-900 pb-3 text-[11px] font-mono font-bold">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="text-zinc-200">queuewatch_telemetry_center</span>
            </div>
            <span>redis:127.0.0.1:6379</span>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-900/40 border border-zinc-900 p-3 rounded">
              <p className="text-[9px] text-zinc-500 font-bold uppercase font-mono tracking-wider">Processed/min</p>
              <p className="text-lg font-bold text-white mt-1 font-mono tracking-tight">1,432</p>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-900 p-3 rounded">
              <p className="text-[9px] text-zinc-500 font-bold uppercase font-mono tracking-wider">active threads</p>
              <p className="text-lg font-bold text-indigo-400 mt-1 font-mono tracking-tight">8 / 10</p>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-900 p-3 rounded">
              <p className="text-[9px] text-zinc-500 font-bold uppercase font-mono tracking-wider">latency p95</p>
              <p className="text-lg font-bold text-cyan-400 mt-1 font-mono tracking-tight">452 ms</p>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-900 p-3 rounded">
              <p className="text-[9px] text-rose-500 font-bold uppercase font-mono tracking-wider">dlq failures</p>
              <p className="text-lg font-bold text-rose-500 mt-1 font-mono tracking-tight">1</p>
            </div>
          </div>

          {/* Simulated Dense Queues Table */}
          <div className="space-y-2.5">
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">registered_queues</div>
            <div className="border border-zinc-900 rounded overflow-hidden">
              <table className="w-full text-left text-[11px] border-collapse font-mono">
                <thead>
                  <tr className="bg-zinc-900/60 border-b border-zinc-900 text-zinc-500 font-bold">
                    <th className="p-2">queue name</th>
                    <th className="p-2 text-right">waiting</th>
                    <th className="p-2 text-right">active</th>
                    <th className="p-2 text-right">completed</th>
                    <th className="p-2 text-right">failed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-900/40 text-zinc-300">
                    <td className="p-2 text-white">image-processing-queue</td>
                    <td className="p-2 text-right text-zinc-500">12</td>
                    <td className="p-2 text-right text-indigo-400">3</td>
                    <td className="p-2 text-right text-zinc-500">1,432</td>
                    <td className="p-2 text-right text-rose-500">2</td>
                  </tr>
                  <tr className="border-b border-zinc-900/40 text-zinc-300">
                    <td className="p-2 text-white">webhook-delivery-queue</td>
                    <td className="p-2 text-right text-zinc-500">0</td>
                    <td className="p-2 text-right text-zinc-500">0</td>
                    <td className="p-2 text-right text-zinc-500">8,941</td>
                    <td className="p-2 text-right text-rose-500">1</td>
                  </tr>
                  <tr className="text-zinc-300">
                    <td className="p-2 text-white">ai-task-queue</td>
                    <td className="p-2 text-right text-zinc-500">1</td>
                    <td className="p-2 text-right text-indigo-400">1</td>
                    <td className="p-2 text-right text-zinc-500">312</td>
                    <td className="p-2 text-right text-zinc-500">0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Workers & Core Health Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">active_workers</div>
              <div className="space-y-2">
                <div className="bg-zinc-900/30 border border-zinc-900 p-2.5 rounded flex items-center justify-between text-[10.5px]">
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="font-mono text-zinc-200">webhook-worker-node-1</span>
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500">CPU 12% • RAM 142MB</span>
                </div>
                <div className="bg-zinc-900/30 border border-zinc-900 p-2.5 rounded flex items-center justify-between text-[10.5px]">
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span className="font-mono text-zinc-200">image-worker-node-2</span>
                  </div>
                  <span className="text-[9px] font-mono text-amber-500">CPU 88% • RAM 512MB</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">failures_timeline</div>
              <div className="bg-zinc-900/20 border border-zinc-900 p-3 rounded h-[76px] flex flex-col justify-center text-[10.5px] font-mono space-y-1">
                <div className="flex items-center space-x-2 text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Stripe Webhook (HTTP 503)</span>
                </div>
                <div className="text-zinc-500">attempts: 3/3 retry limit exceeded &rarr; routed_to_dlq</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. REAL-TIME ACTIVITY stdout_feed RAIL */}
      <section id="console" className="border-t border-zinc-900 bg-zinc-950/40 py-20 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">

          <div className="lg:col-span-4 space-y-4 lg:pr-6">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-mono">stdout_feed</span>
            <h3 className="text-2xl font-extrabold text-white tracking-tight leading-tight">
              Realtime execution stream.
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Observe background job lifecycle triggers and state machine ticks directly from Redis memory channels in real time. Track delays, timeouts, and successful completions under active concurrency parameters.
            </p>

            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded text-xs space-y-2 font-mono">
              <div className="flex items-center space-x-2 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>WebSocket Stream Connected</span>
              </div>
              <div className="text-[10.5px] text-zinc-500">
                Subscribed to: email_queue, image_processing_queue, webhook_delivery_queue, ai_task_queue
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 bg-black/80 border border-zinc-900 rounded-lg p-5 font-mono text-[11px] text-zinc-400 h-[280px] overflow-hidden flex flex-col justify-between shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5 mb-2.5 text-[9px] text-zinc-500 font-bold">
              <span>broker_listener_output.log</span>
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                <span>live streaming</span>
              </span>
            </div>

            <div className="space-y-1.5 flex-1 overflow-y-auto pr-2 select-text">
              {logs.map((log, index) => (
                <div key={index} className="flex items-start space-x-2.5 hover:bg-zinc-900/30 p-0.5 rounded transition-colors">
                  <span className="text-zinc-600 shrink-0 select-none">{log.time}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight shrink-0 select-none ${log.status === 'SUCCESS' ? 'bg-emerald-950/45 border border-emerald-900 text-emerald-400' :
                    log.status === 'ACTIVE' ? 'bg-indigo-950/45 border border-indigo-900 text-indigo-400' :
                      log.status === 'RETRY' ? 'bg-amber-950/45 border border-amber-900 text-amber-400' :
                        log.status === 'FAILED' ? 'bg-rose-950/45 border border-rose-900 text-rose-400 animate-pulse' :
                          'bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold'
                    }`}>{log.status}</span>
                  <span className="text-zinc-500 shrink-0 font-bold select-none">{log.queue}</span>
                  <span className="text-zinc-300 font-semibold shrink-0">{log.job}</span>
                  <span className="text-zinc-400 break-all">{log.details}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. INCIDENT INPSECTOR PREVIEW (Sentry-style UI Preview) */}
      <section id="incidents" className="py-20 px-6 lg:px-12 border-t border-zinc-900 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

        <div className="lg:col-span-8 bg-zinc-950 border border-zinc-900 rounded-lg p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3 text-[11.5px] font-mono">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <strong className="text-white font-extrabold">DLQ INCIDENT DETECTED</strong>
            </div>
            <span className="text-zinc-500 font-mono">Incident ID: inc_9182a3</span>
          </div>

          <div className="space-y-1 font-mono">
            <div className="flex items-center space-x-2 text-[11px] text-zinc-500">
              <span>queue: image_processing_queue</span>
              <span>&bull;</span>
              <span>attempts: 5/5 retries failed</span>
            </div>
            <h4 className="text-rose-400 font-bold text-xs select-all">InvalidPayloadError: Schema validation failed. Missing parameter &apos;imageUrl&apos;</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[10.5px]">
            <div className="space-y-1">
              <span className="text-zinc-500 block uppercase tracking-wider font-bold text-[9px]">failed_arguments_payload</span>
              <pre className="bg-zinc-900/60 border border-zinc-900 p-3 rounded text-cyan-400 select-all overflow-x-auto whitespace-pre">
                {`{
  "userId": "usr_avatar_9182",
  "format": "png",
  "width": 128,
  "height": 128
}`}
              </pre>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-500 block uppercase tracking-wider font-bold text-[9px]">suggested_remediation</span>
              <div className="bg-indigo-950/15 border border-indigo-900/20 p-3 rounded text-zinc-300 leading-normal select-text">
                <span className="text-indigo-400 font-bold flex items-center space-x-1 mb-1">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Remediation Blueprint</span>
                </span>
                Missing `imageUrl` parameter inside the original job arguments list. Validate payload schema in your controller prior to enqueueing.
              </div>
            </div>
          </div>

          <div className="space-y-1 font-mono">
            <span className="text-zinc-500 block uppercase tracking-wider font-bold text-[9px]">proposed_prevalidation_filter</span>
            <pre className="bg-black/60 border border-zinc-900 p-3 rounded text-cyan-400 select-all overflow-x-auto whitespace-pre leading-normal">
              {`// safeEnqueue pre-validation interceptor
import { z } from 'zod';

const JobSchema = z.object({
  imageUrl: z.string().url(),
  userId: z.string()
});

async function safeEnqueue(data: unknown) {
  const parsed = JobSchema.parse(data); // Throw schema warning before Redis push
  return imageQueue.add('resize_avatar', parsed);
}`}
            </pre>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-mono">failures_inspector</span>
          <h3 className="text-2xl font-extrabold text-white tracking-tight leading-tight">
            Remediate failures.
          </h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Diagnose job failures with structural callstack insights. Observe exact input parameters that triggered worker crashes, review remediation guides, and copy proposed pre-validation schema filters instantly.
          </p>

          <Link
            href="/login?demo=true"
            className="inline-flex items-center space-x-2 text-xs font-bold font-mono text-indigo-400 hover:text-indigo-300 transition-colors pt-2"
          >
            <span>Explore Incidents dashboard</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 4. PLATFORM CAPABILITIES SECTION */}
      <section id="features" className="py-20 border-t border-zinc-900 bg-zinc-950/20 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto space-y-12">

          <div className="space-y-2.5">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-mono">capabilities</span>
            <h3 className="text-2xl font-extrabold text-white tracking-tight">
              An engineering-first toolkit.
            </h3>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-xl leading-relaxed">
              QueueWatch binds directly to your existing Redis broker and reads stdout execution ticks without heavy wrapper overrides.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-900 border border-zinc-900 rounded overflow-hidden">

            {/* Cell 1 */}
            <div className="bg-zinc-950 p-6 space-y-3.5">
              <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-sm font-mono">Zero SDK Overrides</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Connect straight to your active Redis host parameter string. No SDK wrappers, heavy dependencies, or pipeline edits required.
              </p>
            </div>

            {/* Cell 2 */}
            <div className="bg-zinc-950 p-6 space-y-3.5">
              <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
                <Inbox className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-sm font-mono">Dead-letter (DLQ) Inspector</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Audit stuck payloads inside DLQ memory. Modify parameter arguments and dispatch original payloads back to active queues with one click.
              </p>
            </div>

            {/* Cell 3 */}
            <div className="bg-zinc-950 p-6 space-y-3.5">
              <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-sm font-mono">Concurrency Metrics</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Track p95 queue processing latencies, waiting counts, delayed schedules, and active worker node health scores.
              </p>
            </div>

            {/* Cell 4 */}
            <div className="bg-zinc-950 p-6 space-y-3.5">
              <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-sm font-mono">Worker Load Profiles</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Observe CPU and memory profiles on individual background worker consumer nodes. Capture memory spikes before they trigger OOM crashes.
              </p>
            </div>

            {/* Cell 5 */}
            <div className="bg-zinc-950 p-6 space-y-3.5">
              <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
                <RefreshCw className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-sm font-mono">Interactive Outage Toggles</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Inject artificial background job traffic, SMTP rate limit bottlenecks, and webhook outage simulations directly from the Control Room.
              </p>
            </div>

            {/* Cell 6 */}
            <div className="bg-zinc-950 p-6 space-y-3.5">
              <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-sm font-mono">Type-safe Architecture</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Complete schema and TypeScript type safety. Designed to maintain 100% database-free session profiles inside in-memory buffers.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 5. GROUNDED FINAL CTA SECTION */}
      <section className="py-24 border-t border-zinc-900 bg-gradient-to-b from-zinc-950/20 to-black/80 text-center px-6 lg:px-12 space-y-6">
        <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight max-w-2xl mx-auto">
          Visibility for background jobs.
        </h3>
        <p className="text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
          Monitor threads, trace execution failures, and recover stalled dead-letter queues on your active BullMQ backends in one minute.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            href="/login?demo=true"
            className="w-full sm:w-auto px-5 py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition-all shadow-md flex items-center justify-center space-x-2 font-mono"
          >
            <span>Launch Seeded Guest Demo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-5 py-2.5 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-extrabold text-xs transition-all flex items-center justify-center font-mono"
          >
            login_workspace
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-10 text-center text-xs text-zinc-500 px-6 max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-5 h-5 rounded bg-zinc-100 flex items-center justify-center font-bold text-xs text-black leading-none">
            Q
          </div>
          <span className="font-bold text-zinc-400">QueueWatch</span>
        </div>
        <p className="font-mono text-[10.5px]">&copy; 2026 QueueWatch Telemetry Engine. Hackathon MVP. Open Source.</p>
      </footer>
    </div>
  );
}
