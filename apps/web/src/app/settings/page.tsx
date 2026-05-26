'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import { Sliders, HelpCircle, Activity, Sparkles, Send, RefreshCw, Radio, ServerCrash } from 'lucide-react';
import { QueueName } from '@queuewatch/shared';

import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const QUEUES = ['email_queue', 'image_processing_queue', 'webhook_delivery_queue', 'ai_task_queue'] as const;

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

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState<string | null>(null);
  const [customPayload, setCustomPayload] = useState<string>('{\n  "email": "user@hackathon.dev",\n  "name": "Jane Miller"\n}');
  const [selectedQueue, setSelectedQueue] = useState<QueueName>('email_queue');
  const [selectedJobAction, setSelectedJobAction] = useState<string>('welcome_email');

  // Load active simulation states from backend on mount
  const fetchSimConfig = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/queues`);
      if (res.ok) {
        // Since config resides in memory, it will map to running settings
        // We can check if any worker indicates active simulations
      }
    } catch (e) {
      console.error('Failed to load active simulation flags:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimConfig();
  }, []);

  // Listen to workers updates to sync toggle switches automatically
  useSocket({
    'worker.health.updated': (data: any[]) => {
      const emailWorker = data.find(w => w.queueName === 'email_queue');
      const webhookWorker = data.find(w => w.queueName === 'webhook_delivery_queue');
      const imageWorker = data.find(w => w.queueName === 'image_processing_queue');
      
      setSimConfig((prev) => ({
        ...prev,
        simulateSmtpFailure: emailWorker?.status === 'down' || false,
        simulateWebhookOutage: webhookWorker?.status === 'down' || false,
        simulateWorkerSlowdown: imageWorker?.status === 'overloaded' || false,
        simulateInvalidPayload: imageWorker?.status === 'down' || false,
      }));
    }
  });

  // Sync state to backend
  const updateConfig = async (key: string, value: boolean) => {
    const newConfig = { ...simConfig, [key]: value };
    setSimConfig(newConfig);
    setSubmitting(key);

    try {
      await authFetch(`${API_URL}/api/queues/email_queue/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
    } catch (e) {
      console.error(`Failed to push simulation key ${key}:`, e);
    } finally {
      setSubmitting(null);
    }
  };

  const recoverAllWorkers = async () => {
    setSubmitting('recovery');
    const healthyConfig = {
      generateTraffic: true,
      simulateSmtpFailure: false,
      simulateWebhookOutage: false,
      simulateWorkerSlowdown: false,
      simulateInvalidPayload: false,
      simulateTimeoutFailure: false,
    };

    setSimConfig(healthyConfig);

    try {
      await authFetch(`${API_URL}/api/queues/email_queue/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(healthyConfig),
      });
    } catch (e) {
      console.error('Failed to recovery simulation settings:', e);
    } finally {
      setSubmitting(null);
    }
  };

  const handleQueueChange = (queue: QueueName) => {
    setSelectedQueue(queue);
    // Pre-populate sensible actions and payloads based on queue selection
    if (queue === 'email_queue') {
      setSelectedJobAction('welcome_email');
      setCustomPayload(JSON.stringify({ email: "user@hackathon.dev", name: "Jane Miller" }, null, 2));
    } else if (queue === 'webhook_delivery_queue') {
      setSelectedJobAction('stripe_invoice');
      setCustomPayload(JSON.stringify({ invoiceId: "in_stripe_8231", amount: 4900, currency: "usd" }, null, 2));
    } else if (queue === 'image_processing_queue') {
      setSelectedJobAction('profile_avatar');
      setCustomPayload(JSON.stringify({ userId: "usr_avatar_9182", imageUrl: "https://assets.dev/avatar.jpg" }, null, 2));
    } else if (queue === 'ai_task_queue') {
      setSelectedJobAction('reliability_audit');
      setCustomPayload(JSON.stringify({ auditId: "aud_9281", targetServer: "us-east-1", scope: "memory_footprint" }, null, 2));
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

      const res = await authFetch(`${API_URL}/api/queues/${selectedQueue}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedJobAction,
          data: parsed
        })
      });

      if (res.ok) {
        // Job successfully added.
      } else {
        const errorText = await res.text();
        console.error('Manual enqueue failed:', errorText);
      }
    } catch (e) {
      console.error('Failed manual job dispatch:', e);
    } finally {
      setDispatchLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
            <Sliders className="w-6 h-6 text-indigo-400" />
            <span>Simulation Control Room</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Inject artificial background traffic, trigger outages, and dispatch custom BullMQ job schemas.
          </p>
        </div>

        <button
          onClick={recoverAllWorkers}
          disabled={submitting === 'recovery'}
          className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-all disabled:opacity-50 inline-flex items-center space-x-1.5 shadow-md"
        >
          {submitting === 'recovery' ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Activity className="w-3.5 h-3.5" />
          )}
          <span>RECOVER ALL WORKERS</span>
        </button>
      </div>

      {/* Main Grid split: Simulation Settings vs Manual Dispatch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Side: Outage Simulators */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="border-b border-slate-900 pb-3">
              <h3 className="font-bold text-white text-md flex items-center space-x-2">
                <ServerCrash className="w-4 h-4 text-rose-500" />
                <span>Outage Injectors</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Toggle error states to test retry and dead-letter routing behaviors.</p>
            </div>

            <div className="space-y-4">
              {/* Traffic generator */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-900 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Continuous Background Traffic</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Generates random jobs across all active BullMQ channels.</p>
                </div>
                <button
                  disabled={submitting !== null}
                  onClick={() => updateConfig('generateTraffic', !simConfig.generateTraffic)}
                  className={`w-10 h-5.5 rounded-full relative transition-all duration-300 ${simConfig.generateTraffic ? 'bg-indigo-600' : 'bg-slate-800'} disabled:opacity-50`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-1 left-1 transition-all duration-300 ${simConfig.generateTraffic ? 'translate-x-4.5' : ''}`}></span>
                </button>
              </div>

              {/* SMTP Outage */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-900 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">SendGrid SMTP Outage (429)</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Simulates email worker rate limits, routing straight to retries.</p>
                </div>
                <button
                  disabled={submitting !== null}
                  onClick={() => updateConfig('simulateSmtpFailure', !simConfig.simulateSmtpFailure)}
                  className={`w-10 h-5.5 rounded-full relative transition-all duration-300 ${simConfig.simulateSmtpFailure ? 'bg-rose-600 shadow-lg shadow-rose-500/20' : 'bg-slate-800'} disabled:opacity-50`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-1 left-1 transition-all duration-300 ${simConfig.simulateSmtpFailure ? 'translate-x-4.5' : ''}`}></span>
                </button>
              </div>

              {/* Stripe Outage */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-900 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Stripe API Outage (503)</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Forces Webhook workers to time out under Stripe gateway crashes.</p>
                </div>
                <button
                  disabled={submitting !== null}
                  onClick={() => updateConfig('simulateWebhookOutage', !simConfig.simulateWebhookOutage)}
                  className={`w-10 h-5.5 rounded-full relative transition-all duration-300 ${simConfig.simulateWebhookOutage ? 'bg-rose-600 shadow-lg shadow-rose-500/20' : 'bg-slate-800'} disabled:opacity-50`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-1 left-1 transition-all duration-300 ${simConfig.simulateWebhookOutage ? 'translate-x-4.5' : ''}`}></span>
                </button>
              </div>

              {/* Schema Mismatch */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-900 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Zod Schema Validation Failure</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Throws InvalidPayloadError exceptions on image worker streams.</p>
                </div>
                <button
                  disabled={submitting !== null}
                  onClick={() => updateConfig('simulateInvalidPayload', !simConfig.simulateInvalidPayload)}
                  className={`w-10 h-5.5 rounded-full relative transition-all duration-300 ${simConfig.simulateInvalidPayload ? 'bg-rose-600 shadow-lg shadow-rose-500/20' : 'bg-slate-800'} disabled:opacity-50`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-1 left-1 transition-all duration-300 ${simConfig.simulateInvalidPayload ? 'translate-x-4.5' : ''}`}></span>
                </button>
              </div>

              {/* Worker Slowdown */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-900 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Worker Thread CPU Slowdown</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Adds an 8,000ms delay block to simulate latency bottlenecks.</p>
                </div>
                <button
                  disabled={submitting !== null}
                  onClick={() => updateConfig('simulateWorkerSlowdown', !simConfig.simulateWorkerSlowdown)}
                  className={`w-10 h-5.5 rounded-full relative transition-all duration-300 ${simConfig.simulateWorkerSlowdown ? 'bg-amber-500' : 'bg-slate-800'} disabled:opacity-50`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-1 left-1 transition-all duration-300 ${simConfig.simulateWorkerSlowdown ? 'translate-x-4.5' : ''}`}></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Manual Dispatch Room */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between min-h-[500px]">
            <div className="space-y-5">
              <div className="border-b border-slate-900 pb-3">
                <h3 className="font-bold text-white text-md flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <span>Manual Payload Dispatcher</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Enqueue a job with customized JSON parameters to watch workers execute.</p>
              </div>

              {/* Queue Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Target BullMQ Queue Channel</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {QUEUES.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleQueueChange(q as QueueName)}
                      className={`px-3 py-2 rounded-lg text-[10.5px] font-bold font-mono transition-all border text-center ${
                        selectedQueue === q 
                          ? 'bg-indigo-500/10 hover:bg-indigo-500/15 border-indigo-500/30 text-indigo-300' 
                          : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {q.replace('_queue', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono block">Job Action Name</label>
                <input
                  type="text"
                  value={selectedJobAction}
                  onChange={(e) => setSelectedJobAction(e.target.value)}
                  className="w-full bg-slate-950/40 border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-slate-850"
                  placeholder="e.g. welcome_email"
                />
              </div>

              {/* Custom payload */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider font-mono">
                  <label className="text-slate-500">JSON Parameters Payload Input</label>
                  <button 
                    onClick={() => {
                      if (selectedQueue === 'image_processing_queue') {
                        setCustomPayload('{\n  "userId": "usr_avatar_9182"\n}'); // missing imageUrl, triggers invalid schema
                      }
                    }}
                    className="text-indigo-400 hover:text-indigo-300 text-[9px] lowercase flex items-center space-x-1"
                  >
                    <span>Trigger invalid schema mock</span>
                  </button>
                </div>
                <textarea
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-900 rounded-xl p-4 text-[10.5px] font-mono text-cyan-400 focus:outline-none focus:border-slate-850 h-44 whitespace-pre select-text resize-none"
                  placeholder="{}"
                />
              </div>
            </div>

            {/* Enqueue button */}
            <div className="border-t border-slate-900/60 pt-4 flex items-center justify-between mt-4">
              <span className="text-[10px] text-slate-500 font-bold font-mono uppercase inline-flex items-center space-x-1">
                <Radio className="w-3.5 h-3.5 text-indigo-500 animate-pulse shrink-0" />
                <span>Redis stream: {selectedQueue}</span>
              </span>

              <button
                onClick={dispatchManualJob}
                disabled={dispatchLoading !== null}
                className="px-4.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/25 flex items-center space-x-2 disabled:opacity-50"
              >
                {dispatchLoading === selectedQueue ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enqueuing...</span>
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
