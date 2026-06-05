'use client';

import React, { useState } from 'react';
import { Terminal, Copy, Check, Shield, Code, Cpu, Zap, Key } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function SdkSetupGuide() {
  const { activeProject } = useAuth();
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLogCode, setCopiedLogCode] = useState(false);

  const apiKey = activeProject?.apiKey || 'qw_pk_your_api_key_here';
  const installCmd = 'npm install @queuewatch/node';

  const sdkSetupCode = `import { monitorQueue } from '@queuewatch/node';
import { Queue } from 'bullmq';

// 1. Initialize your BullMQ Queue as usual
const emailQueue = new Queue('email_notifications', {
  connection: { host: 'localhost', port: 6379 },
});

// 2. Wrap it with QueueWatch — attaches event hooks transparently
monitorQueue(emailQueue, {
  apiKey: '${apiKey}',
  queueName: 'email_notifications',
  endpoint: 'http://localhost:3001',
  connection: { host: 'localhost', port: 6379 },
});

console.log('📡 QueueWatch monitoring active for: email_notifications');`;

  const sdkLogCode = `import { queuewatchLogger, monitorQueue } from '@queuewatch/node';
import { Queue } from 'bullmq';

const emailQueue = new Queue('email_notifications', {
  connection: { host: 'localhost', port: 6379 },
});

// Initialize the SDK first (sets global API key context)
monitorQueue(emailQueue, {
  apiKey: '${apiKey}',
  queueName: 'email_notifications',
  endpoint: 'http://localhost:3001',
});

// Then stream structured logs from inside your workers:
worker.on('active', (job) => {
  queuewatchLogger.info('Job started processing', {
    jobId: job.id,
    queueName: 'email_notifications',
    traceId: \`tr_\${job.id}\`,
  });
});

worker.on('failed', (job, err) => {
  queuewatchLogger.error('Job failed permanently', {
    jobId: job?.id,
    queueName: 'email_notifications',
    traceId: \`tr_\${job?.id}\`,
  });
});`;

  const copyTextToClipboard = (text: string) => {
    if (typeof window === 'undefined') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
    } else {
      fallbackCopyText(text);
    }
  };

  const fallbackCopyText = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(textArea);
  };

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    copyTextToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 font-mono text-[10px]">

      {/* Header */}
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>QueueWatch Node SDK — Integration Guide</span>
        </h2>
        <p className="text-[10px] text-zinc-500 mt-1 font-sans">
          Instrument your BullMQ queues with one call. Events stream to the dashboard in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column — Auth & info */}
        <div className="space-y-4 lg:col-span-1">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4 shadow">

            {/* API Key block */}
            <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center space-x-1.5">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Project API Key</span>
            </h3>

            {activeProject ? (
              <>
                <div className="space-y-1">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Project</p>
                  <p className="text-zinc-200 font-sans text-xs font-semibold">{activeProject.name}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Secret Key</p>
                  <div className="bg-black/50 border border-zinc-900 rounded p-3 flex items-center justify-between gap-2">
                    <span className="text-indigo-400 select-all font-mono font-bold tracking-tight text-[9px] truncate">
                      {apiKey}
                    </span>
                    <button
                      onClick={() => handleCopy(apiKey, setCopiedKey)}
                      className="text-zinc-500 hover:text-white transition-colors shrink-0"
                      title="Copy API Key"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-zinc-600 font-sans leading-relaxed">
                    Keep this secret. Use it only in server-side workers and never in browser code.
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded p-4 flex items-start space-x-3">
                <Key className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-amber-300 font-sans text-xs font-semibold">No project selected</p>
                  <p className="text-zinc-500 font-sans text-[10px] leading-relaxed">
                    Select or create a project from the sidebar to reveal your API key.
                  </p>
                </div>
              </div>
            )}

            <div className="border-t border-zinc-900/60 pt-4 space-y-2.5">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">What the SDK collects</span>
              <ul className="space-y-2 text-zinc-400 font-sans text-xs">
                <li className="flex items-start space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Job lifecycle events — active, completed, failed, stalled, delayed.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Worker heartbeats every 15 s — queue name, status, concurrency.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Code className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Structured log streams with jobId and traceId correlation.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right column — Steps */}
        <div className="lg:col-span-2 space-y-5">

          {/* Step 1 */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase">Step 01</span>
              <span className="text-zinc-500 text-[9px]">Package Installation</span>
            </div>
            <h3 className="font-bold text-white text-xs uppercase">Install the SDK</h3>
            <p className="text-zinc-450 font-sans text-xs">Add the lightweight agent to your TypeScript/JavaScript worker process.</p>
            <div className="bg-black/55 border border-zinc-900 rounded p-3.5 flex items-center justify-between">
              <span className="text-zinc-300 font-mono tracking-tight">{installCmd}</span>
              <button
                onClick={() => handleCopy(installCmd, setCopiedInstall)}
                className="text-zinc-500 hover:text-white transition-colors"
                title="Copy"
              >
                {copiedInstall ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase">Step 02</span>
              <span className="text-zinc-500 text-[9px]">Queue Telemetry Binding</span>
            </div>
            <h3 className="font-bold text-white text-xs uppercase">Attach Queue Monitor</h3>
            <p className="text-zinc-450 font-sans text-xs">
              Call <code className="text-indigo-300">monitorQueue()</code> once per queue. It attaches BullMQ event hooks and starts a heartbeat — no changes to your worker logic.
            </p>
            <div className="relative">
              <pre className="bg-black/55 border border-zinc-900 p-4 rounded text-[9.5px] text-zinc-350 overflow-x-auto whitespace-pre leading-normal max-h-72 overflow-y-auto">
                {sdkSetupCode}
              </pre>
              <button
                onClick={() => handleCopy(sdkSetupCode, setCopiedCode)}
                className="absolute top-3 right-3 p-1.5 rounded bg-zinc-900/80 border border-zinc-850 text-zinc-450 hover:text-white transition-all shadow"
                title="Copy"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase">Step 03</span>
              <span className="text-zinc-500 text-[9px]">Structured Log Streaming</span>
            </div>
            <h3 className="font-bold text-white text-xs uppercase">Instrument Worker Logs</h3>
            <p className="text-zinc-450 font-sans text-xs">
              Use <code className="text-indigo-300">queuewatchLogger</code> inside worker event handlers to stream correlated log lines to the Logs dashboard, linked by jobId and traceId.
            </p>
            <div className="relative">
              <pre className="bg-black/55 border border-zinc-900 p-4 rounded text-[9.5px] text-zinc-350 overflow-x-auto whitespace-pre leading-normal max-h-80 overflow-y-auto">
                {sdkLogCode}
              </pre>
              <button
                onClick={() => handleCopy(sdkLogCode, setCopiedLogCode)}
                className="absolute top-3 right-3 p-1.5 rounded bg-zinc-900/80 border border-zinc-850 text-zinc-450 hover:text-white transition-all shadow"
                title="Copy"
              >
                {copiedLogCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* ShopFlow integration note */}
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-lg p-4 space-y-2">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">ShopFlow Integration Reference</p>
            <p className="text-zinc-400 font-sans text-xs leading-relaxed">
              In <code className="text-indigo-300">workers/index.ts</code>, import and call <code className="text-indigo-300">monitorQueue()</code> for each producer queue — <code className="text-indigo-300">paymentProcessingQueue</code>, <code className="text-indigo-300">emailNotificationsQueue</code>, etc. The <code className="text-indigo-300">QUEUEWATCH_API_KEY</code> env var should match the key shown above.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
