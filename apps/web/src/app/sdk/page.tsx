'use client';

import React, { useState } from 'react';
import { Terminal, Copy, Check, Shield, Code, Cpu, ExternalLink, Zap } from 'lucide-react';

export default function SdkSetupGuide() {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLogCode, setCopiedLogCode] = useState(false);

  const apiKey = 'qw_demo_api_key_v2';
  const installCmd = 'npm install @queuewatch/node';

  const sdkSetupCode = `import { monitorQueue } from '@queuewatch/node';
import { Queue } from 'bullmq';

// 1. Initialize your BullMQ Queue
const emailQueue = new Queue('email_notifications', {
  connection: { host: 'localhost', port: 6379 }
});

// 2. Wrap queue with QueueWatch monitor to stream telemetry
monitorQueue(emailQueue, {
  apiKey: '${apiKey}',
  backendUrl: 'http://localhost:3001',
  environment: 'production',
  heartbeatIntervalMs: 5000
});

console.log('📡 QueueWatch monitoring enabled for queue: email_notifications');`;

  const sdkLogCode = `import { queuewatchLogger } from '@queuewatch/node';

// Set credentials for logger (if not using monitorQueue or in a worker context)
queuewatchLogger.configure({
  apiKey: '${apiKey}',
  backendUrl: 'http://localhost:3001',
  queueName: 'email_notifications'
});

// Stream runtime diagnostic logs directly to QueueWatch
queuewatchLogger.info('Initiating SMTP handshake with mail server', { jobId: '12345', traceId: 'tr_abc123' });
try {
  throw new Error('SMTP Connection timed out after 5000ms');
} catch (error) {
  queuewatchLogger.error('SMTP Delivery failed permanently', {
    jobId: '12345',
    traceId: 'tr_abc123',
    errorStack: error.stack
  });
}`;

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>QueueWatch Node SDK Integration Guide</span>
        </h2>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          Step-by-step instructions to instrument your NestJS/Express background microservices using the QueueWatch telemetry SDK.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column - Info card */}
        <div className="space-y-4 lg:col-span-1">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4 shadow">
            <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center space-x-1.5">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Authentication Token</span>
            </h3>
            <p className="text-zinc-450 leading-relaxed font-sans text-xs">
              This API key authenticates telemetry streams and logs from your workers to the ingestion endpoints.
            </p>
            <div className="bg-black/50 border border-zinc-900 rounded p-3 flex items-center justify-between">
              <span className="text-indigo-400 select-all font-mono font-bold tracking-tight">{apiKey}</span>
              <button
                onClick={() => handleCopy(apiKey, setCopiedKey)}
                className="text-zinc-500 hover:text-white transition-colors"
                title="Copy API Key"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            
            <div className="border-t border-zinc-900/60 pt-4 space-y-2.5">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">SDK Capabilities</span>
              <ul className="space-y-2 text-zinc-400 font-sans text-xs">
                <li className="flex items-start space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Real-time BullMQ event hook captures job completions, delays, stalls, and exception dumps automatically.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Sub-second heartbeat metrics reporting queue backlog sizes and worker load averages.</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Code className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Integrated logger streams diagnostic context and correlates traces with BullMQ task execution steps.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right column - Steps & Code Blocks */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Step 1: Install */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase">Step 01</span>
              <span className="text-zinc-500 text-[9px]">Package Installation</span>
            </div>
            <h3 className="font-bold text-white text-xs uppercase">Install SDK Package</h3>
            <p className="text-zinc-450 font-sans text-xs">Add the lightweight QueueWatch agent dependency to your TypeScript/JavaScript project.</p>
            <div className="bg-black/55 border border-zinc-900 rounded p-3.5 flex items-center justify-between">
              <span className="text-zinc-300 font-mono tracking-tight">{installCmd}</span>
              <button
                onClick={() => handleCopy(installCmd, setCopiedInstall)}
                className="text-zinc-500 hover:text-white transition-colors"
                title="Copy Command"
              >
                {copiedInstall ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Step 2: Initialize Telemetry */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase">Step 02</span>
              <span className="text-zinc-500 text-[9px]">Queue Telemetry Binding</span>
            </div>
            <h3 className="font-bold text-white text-xs uppercase">Bind Queue Monitor</h3>
            <p className="text-zinc-450 font-sans text-xs">Initialize telemetry tracking by wrapping your active BullMQ queues. It attaches queue lifecycle hooks transparently without altering your worker execution logic.</p>
            
            <div className="relative">
              <pre className="bg-black/55 border border-zinc-900 p-4 rounded text-[9.5px] text-zinc-350 overflow-x-auto whitespace-pre leading-normal max-h-72 overflow-y-auto">
                {sdkSetupCode}
              </pre>
              <button
                onClick={() => handleCopy(sdkSetupCode, setCopiedCode)}
                className="absolute top-3 right-3 p-1.5 rounded bg-zinc-900/80 border border-zinc-850 text-zinc-450 hover:text-white transition-all shadow"
                title="Copy Code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Step 3: Diagnostic Logs Streaming */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase">Step 03</span>
              <span className="text-zinc-500 text-[9px]">SRE Trace Logging</span>
            </div>
            <h3 className="font-bold text-white text-xs uppercase">Instrument Custom Logs</h3>
            <p className="text-zinc-450 font-sans text-xs">Inject structured console warning logs or system error dumps that link directly to specific BullMQ jobId scopes for immediate AI troubleshooting.</p>
            
            <div className="relative">
              <pre className="bg-black/55 border border-zinc-900 p-4 rounded text-[9.5px] text-zinc-350 overflow-x-auto whitespace-pre leading-normal max-h-72 overflow-y-auto">
                {sdkLogCode}
              </pre>
              <button
                onClick={() => handleCopy(sdkLogCode, setCopiedLogCode)}
                className="absolute top-3 right-3 p-1.5 rounded bg-zinc-900/80 border border-zinc-850 text-zinc-450 hover:text-white transition-all shadow"
                title="Copy Code"
              >
                {copiedLogCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
