'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import { Sliders, HelpCircle, Activity, Sparkles, Send, RefreshCw, Radio, ServerCrash } from 'lucide-react';
import { QueueName } from '@queuewatch/shared';

import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const QUEUES = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'] as const;

export default function OutageControls() {
  const { authFetch } = useAuth();
  const [simConfig, setSimConfig] = useState({
    generateTraffic: true,
    simulateSmtpFailure: false,
    simulateWebhookOutage: false,
    simulateWorkerSlowdown: false,
    simulateInvalidPayload: false,
    simulateTimeoutFailure: false,
  });

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState<string | null>(null);
  const [customPayload, setCustomPayload] = useState<string>('{\n  "email": "user@hackathon.dev",\n  "name": "Jane Miller"\n}');
  const [selectedQueue, setSelectedQueue] = useState<QueueName>('email_notifications');
  const [selectedJobAction, setSelectedJobAction] = useState<string>('send_welcome_email');

  // Listen to workers updates to sync toggle switches automatically
  useSocket({
    'worker.health.updated': (data: any[]) => {
      const emailWorker = data.find(w => w.queueName === 'email_notifications');
      const webhookWorker = data.find(w => w.queueName === 'webhook_delivery');
      const imageWorker = data.find(w => w.queueName === 'image_processing');
      
      setSimConfig((prev) => ({
        ...prev,
        simulateSmtpFailure: emailWorker?.status === 'down' || false,
        simulateWebhookOutage: webhookWorker?.status === 'down' || false,
        simulateWorkerSlowdown: imageWorker?.status === 'overloaded' || false,
        simulateInvalidPayload: imageWorker?.status === 'down' || false,
      }));
    }
  });

  // Sync state to backend using new endpoints
  const updateConfig = async (key: string, value: boolean) => {
    setSubmitting(key);
    let endpoint = 'normal-traffic';
    
    if (key === 'simulateSmtpFailure' && value) endpoint = 'smtp-failure';
    else if (key === 'simulateWebhookOutage' && value) endpoint = 'webhook-outage';
    else if (key === 'simulateWorkerSlowdown' && value) endpoint = 'worker-slowdown';
    else if (key === 'simulateInvalidPayload' && value) endpoint = 'invalid-payload';
    else if (!value) endpoint = 'recover';

    try {
      const res = await authFetch(`${API_URL}/api/simulation/${endpoint}`, {
        method: 'POST',
      });
      if (res.ok) {
        const body = await res.json();
        setSimConfig(body.config);
      }
    } catch (e) {
      console.error(`Failed to push simulation endpoint ${endpoint}:`, e);
    } finally {
      setSubmitting(null);
    }
  };

  const recoverAllWorkers = async () => {
    setSubmitting('recovery');
    try {
      const res = await authFetch(`${API_URL}/api/simulation/recover`, {
        method: 'POST',
      });
      if (res.ok) {
        const body = await res.json();
        setSimConfig(body.config);
      }
    } catch (e) {
      console.error('Failed to recover simulation settings:', e);
    } finally {
      setSubmitting(null);
    }
  };

  const handleQueueChange = (queue: QueueName) => {
    setSelectedQueue(queue);
    if (queue === 'email_notifications') {
      setSelectedJobAction('send_welcome_email');
      setCustomPayload(JSON.stringify({ email: "user@hackathon.dev", name: "Jane Miller" }, null, 2));
    } else if (queue === 'webhook_delivery') {
      setSelectedJobAction('stripe_invoice_payment_succeeded');
      setCustomPayload(JSON.stringify({ invoiceId: "in_stripe_8231", amount: 4900, currency: "usd" }, null, 2));
    } else if (queue === 'image_processing') {
      setSelectedJobAction('resize_avatar');
      setCustomPayload(JSON.stringify({ userId: "usr_avatar_9182", imageUrl: "https://assets.dev/avatar.jpg" }, null, 2));
    } else if (queue === 'ai_tasks') {
      setSelectedJobAction('vectorize_documents');
      setCustomPayload(JSON.stringify({ docId: "doc_9281", scope: "memory_footprint" }, null, 2));
    }
  };

  const dispatchManualJob = async () => {
    setDispatchLoading(selectedQueue);
    try {
      let parsed = {};
      try {
        parsed = JSON.parse(customPayload);
      } catch (err) {
        alert('Invalid JSON payload formatting. Please fix syntax.');
        setDispatchLoading(null);
        return;
      }

      await authFetch(`${API_URL}/api/queues/${selectedQueue}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedJobAction,
          data: parsed
        })
      });
    } catch (e) {
      console.error('Failed manual job dispatch:', e);
    } finally {
      setDispatchLoading(null);
    }
  };

  return (
    <div className="space-y-5 font-mono text-[10px]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center space-x-2 uppercase">
            <Sliders className="w-4 h-4 text-zinc-400 shrink-0" />
            <span>Incident Sandbox & Outage Injectors</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Inject artificial background traffic, trigger worker bottlenecks, and dispatch custom BullMQ job schemas.
          </p>
        </div>

        <button
          onClick={recoverAllWorkers}
          disabled={submitting === 'recovery'}
          className="px-3 py-1.5 rounded bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 text-[10px] font-bold transition-all disabled:opacity-50 inline-flex items-center space-x-1.5 shadow"
        >
          {submitting === 'recovery' ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Activity className="w-3.5 h-3.5" />
          )}
          <span>RECOVER ALL WORKERS</span>
        </button>
      </div>

      {/* Engineering Warning Banner */}
      <div className="bg-amber-950/10 border border-amber-900/30 text-amber-300 rounded p-3 flex items-start space-x-2.5 font-sans leading-relaxed">
        <Radio className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
        <div>
          <strong className="font-bold font-mono text-[9px] uppercase tracking-wider block mb-0.5">warning: sandbox environment only</strong>
          <span>These incident injection controls generate real background Redis job failures and thread delays. Ensure this node is connected to a local development or sandbox Redis instance prior to enabling outages.</span>
        </div>
      </div>

      {/* Main Grid split: Simulation Settings vs Manual Dispatch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Left Side: Outage Simulators */}
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4">
            <div className="border-b border-zinc-900 pb-2.5">
              <h3 className="font-bold text-white text-xs flex items-center space-x-2 uppercase">
                <ServerCrash className="w-4 h-4 text-rose-500" />
                <span>Outage Injectors</span>
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Toggle error states to test retry and dead-letter routing behaviors.</p>
            </div>

            <div className="space-y-3">
              {/* Traffic generator */}
              <div className="p-3 bg-zinc-900/10 rounded border border-zinc-900 flex items-center justify-between">
                <div>
                  <h4 className="text-[11px] font-bold text-white">Background Load Generator</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5 font-sans">Generates continuous random telemetry workloads across BullMQ queues.</p>
                </div>
                <button
                  disabled={submitting !== null}
                  onClick={() => updateConfig('generateTraffic', !simConfig.generateTraffic)}
                  className={`w-9 h-5 rounded-full relative transition-all duration-300 ${simConfig.generateTraffic ? 'bg-zinc-700' : 'bg-zinc-900'} disabled:opacity-50 border border-zinc-800`}
                >
                  <span className={`w-3 h-3 rounded-full bg-white absolute top-0.5 left-0.5 transition-all duration-300 ${simConfig.generateTraffic ? 'translate-x-4.5' : ''}`}></span>
                </button>
              </div>

              {/* SMTP Outage */}
              <div className="p-3 bg-zinc-900/10 rounded border border-zinc-900 flex items-center justify-between">
                <div>
                  <h4 className="text-[11px] font-bold text-white">SMTP Mail Provider Outage</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5 font-sans">Simulates email worker rate limits, routing straight to BullMQ retries.</p>
                </div>
                <button
                  disabled={submitting !== null}
                  onClick={() => updateConfig('simulateSmtpFailure', !simConfig.simulateSmtpFailure)}
                  className={`w-9 h-5 rounded-full relative transition-all duration-300 ${simConfig.simulateSmtpFailure ? 'bg-rose-950 border-rose-900' : 'bg-zinc-900 border-zinc-800'} disabled:opacity-50 border`}
                >
                  <span className={`w-3 h-3 rounded-full bg-white absolute top-0.5 left-0.5 transition-all duration-300 ${simConfig.simulateSmtpFailure ? 'translate-x-4.5' : ''}`}></span>
                </button>
              </div>

              {/* Stripe Outage */}
              <div className="p-3 bg-zinc-900/10 rounded border border-zinc-900 flex items-center justify-between">
                <div>
                  <h4 className="text-[11px] font-bold text-white">Webhook Endpoint Timeout</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5 font-sans">Forces Webhook workers to time out under gateway crashes.</p>
                </div>
                <button
                  disabled={submitting !== null}
                  onClick={() => updateConfig('simulateWebhookOutage', !simConfig.simulateWebhookOutage)}
                  className={`w-9 h-5 rounded-full relative transition-all duration-300 ${simConfig.simulateWebhookOutage ? 'bg-rose-950 border-rose-900' : 'bg-zinc-900 border-zinc-800'} disabled:opacity-50 border`}
                >
                  <span className={`w-3 h-3 rounded-full bg-white absolute top-0.5 left-0.5 transition-all duration-300 ${simConfig.simulateWebhookOutage ? 'translate-x-4.5' : ''}`}></span>
                </button>
              </div>

              {/* Schema Mismatch */}
              <div className="p-3 bg-zinc-900/10 rounded border border-zinc-900 flex items-center justify-between">
                <div>
                  <h4 className="text-[11px] font-bold text-white">Schema Validation Exception</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5 font-sans">Throws Zod schema validation errors on image-processing threads.</p>
                </div>
                <button
                  disabled={submitting !== null}
                  onClick={() => updateConfig('simulateInvalidPayload', !simConfig.simulateInvalidPayload)}
                  className={`w-9 h-5 rounded-full relative transition-all duration-300 ${simConfig.simulateInvalidPayload ? 'bg-rose-950 border-rose-900' : 'bg-zinc-900 border-zinc-800'} disabled:opacity-50 border`}
                >
                  <span className={`w-3 h-3 rounded-full bg-white absolute top-0.5 left-0.5 transition-all duration-300 ${simConfig.simulateInvalidPayload ? 'translate-x-4.5' : ''}`}></span>
                </button>
              </div>

              {/* Worker Slowdown */}
              <div className="p-3 bg-zinc-900/10 rounded border border-zinc-900 flex items-center justify-between">
                <div>
                  <h4 className="text-[11px] font-bold text-white">Worker Executor CPU Bottleneck</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5 font-sans">Adds an 8,000ms delay block to simulate latency bottlenecks.</p>
                </div>
                <button
                  disabled={submitting !== null}
                  onClick={() => updateConfig('simulateWorkerSlowdown', !simConfig.simulateWorkerSlowdown)}
                  className={`w-9 h-5 rounded-full relative transition-all duration-300 ${simConfig.simulateWorkerSlowdown ? 'bg-amber-950 border-amber-900' : 'bg-zinc-900 border-zinc-800'} disabled:opacity-50 border`}
                >
                  <span className={`w-3 h-3 rounded-full bg-white absolute top-0.5 left-0.5 transition-all duration-300 ${simConfig.simulateWorkerSlowdown ? 'translate-x-4.5' : ''}`}></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Manual Dispatch Room */}
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg flex flex-col justify-between min-h-[460px]">
            <div className="space-y-4">
              <div className="border-b border-zinc-900 pb-2.5">
                <h3 className="font-bold text-white text-xs flex items-center space-x-2 uppercase">
                  <Sparkles className="w-4 h-4 text-zinc-400" />
                  <span>Manual Payload Dispatcher</span>
                </h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Enqueue a job with customized JSON parameters to watch workers execute.</p>
              </div>

              {/* Queue Selector */}
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Target Queue Channel</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {QUEUES.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleQueueChange(q as QueueName)}
                      className={`px-2 py-1.5 rounded text-[10px] font-bold font-mono transition-all border text-center ${
                        selectedQueue === q 
                          ? 'bg-zinc-900 border-zinc-700 text-white' 
                          : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:border-zinc-800 hover:text-zinc-300'
                      }`}
                    >
                      {q.replace('_notifications', '').replace('_tasks', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Name */}
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Job Action Name</label>
                <input
                  type="text"
                  value={selectedJobAction}
                  onChange={(e) => setSelectedJobAction(e.target.value)}
                  className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-3 py-2 text-[10px] text-white focus:outline-none focus:border-zinc-850"
                  placeholder="e.g. send_welcome_email"
                />
              </div>

              {/* Custom payload */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
                  <label className="text-zinc-500">JSON Parameters Payload Input</label>
                  <button 
                    onClick={() => {
                      if (selectedQueue === 'image_processing') {
                        setCustomPayload('{\n  "userId": "usr_avatar_9182"\n}'); // missing imageUrl
                      }
                    }}
                    className="text-zinc-400 hover:text-white text-[8px] lowercase flex items-center space-x-1"
                  >
                    <span>Trigger invalid schema mock</span>
                  </button>
                </div>
                <textarea
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-900 rounded p-3 text-[9.5px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-850 h-36 whitespace-pre select-text resize-none"
                  placeholder="{}"
                />
              </div>
            </div>

            {/* Enqueue button */}
            <div className="border-t border-zinc-900/60 pt-3 flex items-center justify-between mt-4">
              <span className="text-[9px] text-zinc-500 font-bold uppercase flex items-center space-x-1">
                <Radio className="w-3.5 h-3.5 text-zinc-650 shrink-0" />
                <span>active connection: {selectedQueue}</span>
              </span>

              <button
                onClick={dispatchManualJob}
                disabled={dispatchLoading !== null}
                className="px-3.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-bold border border-zinc-800 text-[10px] transition-all flex items-center space-x-1.5 disabled:opacity-50 shadow"
              >
                {dispatchLoading === selectedQueue ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>enqueuing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>ENQUEUE JOB</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
