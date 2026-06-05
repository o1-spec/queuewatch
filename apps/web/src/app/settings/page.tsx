'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import { 
  Sliders, Plus, Trash2, ShieldAlert, CheckCircle2, Save, 
  Mail, Terminal, Send, Check, Activity, Sparkles, 
  RefreshCw, Radio, ServerCrash, Loader2 
} from 'lucide-react';
import { QueueName, EscalationRule, NotificationSetting } from '@queuewatch/shared';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const QUEUES = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export default function ConsolidatedSettings() {
  const { authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<'sandbox' | 'escalation' | 'notifications'>('sandbox');

  // --- Sandbox State ---
  const [simConfig, setSimConfig] = useState({
    generateTraffic: true,
    simulateSmtpFailure: false,
    simulateWebhookOutage: false,
    simulateWorkerSlowdown: false,
    simulateInvalidPayload: false,
    simulateTimeoutFailure: false,
  });
  const [simLoading, setSimLoading] = useState(false);
  const [simSubmitting, setSimSubmitting] = useState<string | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState<string | null>(null);
  const [customPayload, setCustomPayload] = useState<string>('{\n  "email": "user@queuewatch.dev",\n  "name": "Jane Miller"\n}');
  const [selectedQueue, setSelectedQueue] = useState<QueueName>('email_notifications');
  const [selectedJobAction, setSelectedJobAction] = useState<string>('send_welcome_email');

  // --- Escalation State ---
  const [escRules, setEscRules] = useState<EscalationRule[]>([]);
  const [escLoading, setEscLoading] = useState(true);
  const [escName, setEscName] = useState('');
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);
  const [escQueue, setEscQueue] = useState('all');
  const [escSeverity, setEscSeverity] = useState('all');
  const [escCondition, setEscCondition] = useState('Unacknowledged > 10 min');
  const [escDelay, setEscDelay] = useState(10);
  const [escChannels, setEscChannels] = useState<string[]>(['dashboard']);

  // --- Notifications State ---
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [dashboardEnabled, setDashboardEnabled] = useState(true);
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [slackUrl, setSlackUrl] = useState('');
  const [discordUrl, setDiscordUrl] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedQueues, setSelectedQueues] = useState<string[]>([]);

  // Sync state to simulation toggle switches automatically
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

  // --- Load Data Effects ---
  useEffect(() => {
    if (activeTab === 'escalation') {
      loadEscRules();
    } else if (activeTab === 'notifications') {
      loadNotifSettings();
    }
  }, [activeTab]);

  // --- Simulation Logic ---
  const updateSimConfig = async (key: string, value: boolean) => {
    setSimSubmitting(key);
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
      setSimSubmitting(null);
    }
  };

  const recoverAllWorkers = async () => {
    setSimSubmitting('recovery');
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
      setSimSubmitting(null);
    }
  };

  const handleQueueChange = (queue: QueueName) => {
    setSelectedQueue(queue);
    if (queue === 'email_notifications') {
      setSelectedJobAction('send_welcome_email');
      setCustomPayload(JSON.stringify({ email: "user@queuewatch.dev", name: "Jane Miller" }, null, 2));
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

  // --- Escalation Logic ---
  const loadEscRules = async () => {
    setEscLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/escalation-rules`);
      if (res.ok) {
        setEscRules(await res.json());
      }
    } catch (e) {
      console.error('Failed to load escalation rules:', e);
    } finally {
      setEscLoading(false);
    }
  };

  const handleCreateEscRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escName.trim()) return;

    try {
      const res = await authFetch(`${API_URL}/api/escalation-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: escName.trim(),
          queueName: escQueue,
          severity: escSeverity,
          condition: escCondition,
          delayMinutes: Number(escDelay),
          channels: escChannels,
          enabled: true,
        }),
      });

      if (res.ok) {
        const newRule = await res.json();
        setEscRules((prev) => [...prev, newRule]);
        setEscName('');
      }
    } catch (e) {
      console.error('Failed to create escalation rule:', e);
    }
  };

  const handleDeleteEscRule = async (id: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/escalation-rules/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setEscRules((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete rule:', e);
    }
  };

  const handleToggleEscRule = async (rule: EscalationRule) => {
    try {
      const res = await authFetch(`${API_URL}/api/escalation-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (res.ok) {
        setEscRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, enabled: !rule.enabled } : r))
        );
      }
    } catch (e) {
      console.error('Failed to toggle rule:', e);
    }
  };

  const handleEscChannelToggle = (channel: string) => {
    setEscChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  // --- Notifications Logic ---
  const loadNotifSettings = async () => {
    setNotifLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/notifications/settings`);
      if (res.ok) {
        const data: NotificationSetting = await res.json();
        setEmailEnabled(data.emailEnabled);
        setDashboardEnabled(data.dashboardEnabled);
        setWebhookEnabled(data.webhookEnabled || false);
        setSlackUrl(data.slackWebhookUrl || '');
        setDiscordUrl(data.discordWebhookUrl || '');
        setSelectedSeverities(data.severities || []);
        setSelectedQueues(data.queues || []);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleSaveNotifSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifSaving(true);
    setNotifSaved(false);

    try {
      const res = await authFetch(`${API_URL}/api/notifications/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailEnabled,
          dashboardEnabled,
          webhookEnabled,
          slackWebhookUrl: slackUrl,
          discordWebhookUrl: discordUrl,
          severities: selectedSeverities,
          queues: selectedQueues,
        }),
      });

      if (res.ok) {
        setNotifSaved(true);
        setTimeout(() => setNotifSaved(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setNotifSaving(false);
    }
  };

  const toggleSeverity = (sev: string) => {
    setSelectedSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
    );
  };

  const toggleQueue = (q: string) => {
    setSelectedQueues((prev) =>
      prev.includes(q) ? prev.filter((item) => item !== q) : [...prev, q]
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans text-sm text-zinc-350">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage your project configurations, SLAs, and notification options.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-900 space-x-6 text-sm font-medium pb-px">
        <button
          onClick={() => setActiveTab('sandbox')}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === 'sandbox' 
              ? 'border-white text-white font-semibold' 
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Simulation Sandbox
        </button>
        <button
          onClick={() => setActiveTab('escalation')}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === 'escalation' 
              ? 'border-white text-white font-semibold' 
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Escalation Rules
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === 'notifications' 
              ? 'border-white text-white font-semibold' 
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Notification Preferences
        </button>
      </div>

      {/* --- Simulation Tab --- */}
      {activeTab === 'sandbox' && (
        <div className="space-y-6">
          <div className="bg-amber-950/10 border border-amber-900/30 text-amber-300 rounded-lg p-4 flex items-start space-x-3 leading-relaxed">
            <Radio className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <strong className="font-bold text-xs uppercase tracking-wider block mb-1">Sandbox Environment Only</strong>
              <span className="text-sm">These controls trigger real simulated job failures and delays. Ensure you are connected to a sandbox Redis instance prior to testing error-path rules.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Outage Injectors */}
            <div className="bg-zinc-900/10 border border-zinc-900 rounded-lg p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <div>
                  <h3 className="font-semibold text-white text-base">Outage Injectors</h3>
                  <p className="text-xs text-zinc-500 mt-1">Toggle failure states to evaluate worker recovery mechanisms.</p>
                </div>
                <button
                  onClick={recoverAllWorkers}
                  disabled={simSubmitting === 'recovery'}
                  className="px-3 py-1.5 rounded-md bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 text-xs font-bold transition-all disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {simSubmitting === 'recovery' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Activity className="w-3.5 h-3.5" />
                  )}
                  <span>Recover Workers</span>
                </button>
              </div>

              <div className="space-y-4">
                {/* Traffic generator */}
                <div className="p-4 bg-zinc-900/20 rounded-lg border border-zinc-900 flex items-center justify-between">
                  <div className="space-y-1 pr-4">
                    <h4 className="text-sm font-semibold text-white">Load Generator</h4>
                    <p className="text-xs text-zinc-500 leading-normal">Generates continuous mock telemetry workloads across all queues.</p>
                  </div>
                  <button
                    disabled={simSubmitting !== null}
                    onClick={() => updateSimConfig('generateTraffic', !simConfig.generateTraffic)}
                    className={`w-9 h-5 rounded-full relative transition-all duration-300 shrink-0 ${simConfig.generateTraffic ? 'bg-zinc-600' : 'bg-zinc-900'} border border-zinc-800`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 left-0.5 transition-all duration-300 ${simConfig.generateTraffic ? 'translate-x-4' : ''}`}></span>
                  </button>
                </div>

                {/* SMTP Failure */}
                <div className="p-4 bg-zinc-900/20 rounded-lg border border-zinc-900 flex items-center justify-between">
                  <div className="space-y-1 pr-4">
                    <h4 className="text-sm font-semibold text-white">SMTP Outage</h4>
                    <p className="text-xs text-zinc-500 leading-normal">Simulates mail server timeout blockages (email queue fails and retries).</p>
                  </div>
                  <button
                    disabled={simSubmitting !== null}
                    onClick={() => updateSimConfig('simulateSmtpFailure', !simConfig.simulateSmtpFailure)}
                    className={`w-9 h-5 rounded-full relative transition-all duration-300 shrink-0 ${simConfig.simulateSmtpFailure ? 'bg-rose-950 border-rose-900' : 'bg-zinc-900 border-zinc-800'} border`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 left-0.5 transition-all duration-300 ${simConfig.simulateSmtpFailure ? 'translate-x-4' : ''}`}></span>
                  </button>
                </div>

                {/* Webhook Outage */}
                <div className="p-4 bg-zinc-900/20 rounded-lg border border-zinc-900 flex items-center justify-between">
                  <div className="space-y-1 pr-4">
                    <h4 className="text-sm font-semibold text-white">Webhook Endpoint Timeout</h4>
                    <p className="text-xs text-zinc-500 leading-normal">Simulates Stripe callback server exceptions and payload losses.</p>
                  </div>
                  <button
                    disabled={simSubmitting !== null}
                    onClick={() => updateSimConfig('simulateWebhookOutage', !simConfig.simulateWebhookOutage)}
                    className={`w-9 h-5 rounded-full relative transition-all duration-300 shrink-0 ${simConfig.simulateWebhookOutage ? 'bg-rose-950 border-rose-900' : 'bg-zinc-900 border-zinc-800'} border`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 left-0.5 transition-all duration-300 ${simConfig.simulateWebhookOutage ? 'translate-x-4' : ''}`}></span>
                  </button>
                </div>

                {/* Schema validation exception */}
                <div className="p-4 bg-zinc-900/20 rounded-lg border border-zinc-900 flex items-center justify-between">
                  <div className="space-y-1 pr-4">
                    <h4 className="text-sm font-semibold text-white">Schema validation failures</h4>
                    <p className="text-xs text-zinc-500 leading-normal">Throws schema discrepancies on image-resizing pipeline jobs.</p>
                  </div>
                  <button
                    disabled={simSubmitting !== null}
                    onClick={() => updateSimConfig('simulateInvalidPayload', !simConfig.simulateInvalidPayload)}
                    className={`w-9 h-5 rounded-full relative transition-all duration-300 shrink-0 ${simConfig.simulateInvalidPayload ? 'bg-rose-950 border-rose-900' : 'bg-zinc-900 border-zinc-800'} border`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 left-0.5 transition-all duration-300 ${simConfig.simulateInvalidPayload ? 'translate-x-4' : ''}`}></span>
                  </button>
                </div>

                {/* CPU slowdown */}
                <div className="p-4 bg-zinc-900/20 rounded-lg border border-zinc-900 flex items-center justify-between">
                  <div className="space-y-1 pr-4">
                    <h4 className="text-sm font-semibold text-white">CPU Execution Bottlenecks</h4>
                    <p className="text-xs text-zinc-500 leading-normal">Introduces an 8,000ms delay in queue consumers to simulate overloading.</p>
                  </div>
                  <button
                    disabled={simSubmitting !== null}
                    onClick={() => updateSimConfig('simulateWorkerSlowdown', !simConfig.simulateWorkerSlowdown)}
                    className={`w-9 h-5 rounded-full relative transition-all duration-300 shrink-0 ${simConfig.simulateWorkerSlowdown ? 'bg-amber-950 border-amber-900' : 'bg-zinc-900 border-zinc-800'} border`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 left-0.5 transition-all duration-300 ${simConfig.simulateWorkerSlowdown ? 'translate-x-4' : ''}`}></span>
                  </button>
                </div>
              </div>
            </div>

            {/* Manual Payload Dispatcher */}
            <div className="bg-zinc-900/10 border border-zinc-900 rounded-lg p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-zinc-900 pb-3">
                  <h3 className="font-semibold text-white text-base">Payload Dispatcher</h3>
                  <p className="text-xs text-zinc-500 mt-1">Directly enqueue a job with custom parameters into BullMQ queues.</p>
                </div>

                {/* Queue Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Target Queue</label>
                  <div className="grid grid-cols-2 gap-2">
                    {QUEUES.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleQueueChange(q as QueueName)}
                        className={`px-3 py-2 rounded-md text-xs font-semibold transition-all border text-center ${
                          selectedQueue === q 
                            ? 'bg-zinc-900 border-zinc-700 text-white' 
                            : 'bg-zinc-950 border-zinc-900 text-zinc-550 hover:border-zinc-800 hover:text-zinc-300'
                        }`}
                      >
                        {q.replace('_notifications', '').replace('_tasks', '')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Job Action */}
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Job Name</label>
                  <input
                    type="text"
                    value={selectedJobAction}
                    onChange={(e) => setSelectedJobAction(e.target.value)}
                    className="w-full bg-zinc-900/20 border border-zinc-900 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700"
                    placeholder="e.g. send_welcome_email"
                  />
                </div>

                {/* Custom Payload */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                    <label className="text-zinc-400">JSON Payload</label>
                    <button 
                      onClick={() => {
                        if (selectedQueue === 'image_processing') {
                          setCustomPayload('{\n  "userId": "usr_avatar_9182"\n}'); // missing imageUrl
                        }
                      }}
                      className="text-zinc-500 hover:text-white text-xs lowercase flex items-center space-x-1"
                    >
                      <span>Trigger invalid schema mock</span>
                    </button>
                  </div>
                  <textarea
                    value={customPayload}
                    onChange={(e) => setCustomPayload(e.target.value)}
                    className="w-full bg-black/40 border border-zinc-900 rounded-md p-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-700 h-32 whitespace-pre resize-none"
                    placeholder="{}"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-900/60 pt-4 flex items-center justify-between mt-4">
                <span className="text-xs text-zinc-500 font-medium flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Channel: {selectedQueue}</span>
                </span>

                <button
                  onClick={dispatchManualJob}
                  disabled={dispatchLoading !== null}
                  className="px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-semibold border border-zinc-800 text-xs transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {dispatchLoading === selectedQueue ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Enqueuing...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Enqueue Job</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- Escalation Tab --- */}
      {activeTab === 'escalation' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Create Rule Form */}
          <div className="bg-zinc-900/10 border border-zinc-900 p-6 rounded-lg h-fit space-y-4">
            <div className="border-b border-zinc-900 pb-3">
              <h3 className="font-semibold text-white text-base flex items-center space-x-2">
                <Plus className="w-4 h-4 text-zinc-400" />
                <span>Create Escalation Rule</span>
              </h3>
            </div>

            <form onSubmit={handleCreateEscRule} className="space-y-4 font-sans">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Critical SLA Exceeded"
                  value={escName}
                  onChange={(e) => setEscName(e.target.value)}
                  className="w-full bg-zinc-900/20 border border-zinc-900 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-700"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Queue Scope</label>
                <select
                  value={escQueue}
                  onChange={(e) => setEscQueue(e.target.value)}
                  className="w-full bg-zinc-900/20 border border-zinc-900 rounded-md px-3 py-2 text-white focus:outline-none text-sm"
                >
                  <option value="all">All Queues</option>
                  {QUEUES.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Severity Filter</label>
                <select
                  value={escSeverity}
                  onChange={(e) => setEscSeverity(e.target.value)}
                  className="w-full bg-zinc-900/20 border border-zinc-900 rounded-md px-3 py-2 text-white focus:outline-none text-sm"
                >
                  <option value="all">All Severities</option>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Delay (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    value={escDelay}
                    onChange={(e) => setEscDelay(Number(e.target.value))}
                    className="w-full bg-zinc-900/20 border border-zinc-900 rounded-md px-3 py-2 text-white focus:outline-none text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Condition Hint</label>
                  <input
                    type="text"
                    value={escCondition}
                    onChange={(e) => setEscCondition(e.target.value)}
                    className="w-full bg-zinc-900/20 border border-zinc-900 rounded-md px-3 py-2 text-white focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Escalation Channels</label>
                <div className="space-y-1.5 text-sm">
                  {['dashboard', 'email', 'slack_webhook', 'discord_webhook'].map((c) => (
                    <label key={c} className="flex items-center space-x-2 text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={escChannels.includes(c)}
                        onChange={() => handleEscChannelToggle(c)}
                        className="rounded border-zinc-800 bg-zinc-900 text-indigo-500 w-4 h-4"
                      />
                      <span className="capitalize">{c.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-md bg-zinc-900 hover:bg-zinc-850 text-white font-bold border border-zinc-800 transition-all flex items-center justify-center space-x-1"
              >
                <span>Register SLA Rule</span>
              </button>
            </form>
          </div>

          {/* Rules Catalog */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-zinc-900/10 border border-zinc-900 p-6 rounded-lg">
              <h3 className="font-semibold text-white text-base border-b border-zinc-900 pb-3 mb-4">
                Escalation Rules Catalog
              </h3>

              {escLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 text-zinc-550 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {escRules.map((rule) => (
                    <div key={rule.id} className="p-4 bg-zinc-900/20 rounded-lg border border-zinc-900 flex items-center justify-between gap-4 font-sans">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <strong className="text-white text-sm">{rule.name}</strong>
                          <span className={`px-2 py-0.5 rounded text-[9px] border uppercase font-mono ${
                            rule.severity === 'critical' ? 'bg-rose-950/20 border-rose-900 text-rose-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                          }`}>
                            {rule.severity}
                          </span>
                        </div>
                        <p className="text-zinc-400 text-xs leading-normal">
                          If unacknowledged for <strong className="text-zinc-200 font-mono">{rule.delayMinutes} min</strong> on queue <strong className="text-zinc-200 font-mono">{rule.queueName}</strong>, escalate to:
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {rule.channels.map((chan) => (
                            <span key={chan} className="px-2 py-0.5 rounded text-[9px] bg-zinc-900 border border-zinc-850 text-zinc-400 uppercase font-mono">
                              {chan.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <button
                          onClick={() => handleToggleEscRule(rule)}
                          className={`px-2 py-1 rounded text-xs border font-bold ${
                            rule.enabled ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-650'
                          }`}
                        >
                          {rule.enabled ? 'ACTIVE' : 'MUTED'}
                        </button>
                        <button
                          onClick={() => setRuleToDelete(rule.id)}
                          className="p-2 rounded hover:bg-rose-500/10 text-zinc-500 hover:text-rose-455 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {escRules.length === 0 && (
                    <div className="text-center py-10 text-zinc-550 font-medium">
                      No active incident escalation rules setup.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Notification Preferences Tab --- */}
      {activeTab === 'notifications' && (
        <form onSubmit={handleSaveNotifSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
          
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900/10 border border-zinc-900 p-6 rounded-lg space-y-4">
              <h3 className="text-white text-base font-semibold border-b border-zinc-900 pb-3">
                Alert Notification Channels
              </h3>
              
              {/* Dashboard toggle */}
              <div className="flex items-center justify-between p-4 bg-zinc-900/20 border border-zinc-900 rounded-lg">
                <div className="space-y-1 pr-4">
                  <span className="font-semibold text-white flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-zinc-400" />
                    <span>Dashboard Alert Ledger</span>
                  </span>
                  <p className="text-zinc-500 text-xs leading-normal">Persist active anomalies within the main alert notifications center.</p>
                </div>
                <input
                  type="checkbox"
                  checked={dashboardEnabled}
                  onChange={(e) => setDashboardEnabled(e.target.checked)}
                  className="rounded border-zinc-800 bg-zinc-900 text-indigo-500 w-4 h-4"
                />
              </div>

              {/* Email toggle */}
              <div className="flex items-center justify-between p-4 bg-zinc-900/20 border border-zinc-900 rounded-lg">
                <div className="space-y-1 pr-4">
                  <span className="font-semibold text-white flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-indigo-400" />
                    <span>Email Dispatch Alerts</span>
                  </span>
                  <p className="text-zinc-500 text-xs leading-normal">Send automated emails directly to engineers when incidents spike.</p>
                </div>
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="rounded border-zinc-800 bg-zinc-900 text-indigo-500 w-4 h-4"
                />
              </div>

              {/* Webhook toggle */}
              <div className="flex items-center justify-between p-4 bg-zinc-900/20 border border-zinc-900 rounded-lg">
                <div className="space-y-1 pr-4">
                  <span className="font-semibold text-white flex items-center space-x-2">
                    <Send className="w-4 h-4 text-indigo-400" />
                    <span>External Webhook Integration</span>
                  </span>
                  <p className="text-zinc-500 text-xs leading-normal">Integrate Slack and Discord alerts into system worker routines.</p>
                </div>
                <input
                  type="checkbox"
                  checked={webhookEnabled}
                  onChange={(e) => setWebhookEnabled(e.target.checked)}
                  className="rounded border-zinc-800 bg-zinc-900 text-indigo-500 w-4 h-4"
                />
              </div>

              {webhookEnabled && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Slack Webhook URL</label>
                    <input
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={slackUrl}
                      onChange={(e) => setSlackUrl(e.target.value)}
                      className="w-full bg-zinc-900/20 border border-zinc-900 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Discord Webhook URL</label>
                    <input
                      type="url"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={discordUrl}
                      onChange={(e) => setDiscordUrl(e.target.value)}
                      className="w-full bg-zinc-900/20 border border-zinc-900 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Scope filters */}
            <div className="bg-zinc-900/10 border border-zinc-900 p-6 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Severity Limit */}
              <div className="space-y-3">
                <h3 className="text-white text-base font-semibold border-b border-zinc-900 pb-2">
                  Severity Thresholds
                </h3>
                <div className="space-y-2">
                  {SEVERITIES.map((sev) => {
                    const active = selectedSeverities.includes(sev);
                    return (
                      <button
                        type="button"
                        key={sev}
                        onClick={() => toggleSeverity(sev)}
                        className={`w-full flex items-center justify-between p-3 rounded-md border transition-all text-left uppercase font-bold text-xs ${
                          active
                            ? 'bg-indigo-950/20 border-indigo-900 text-indigo-400'
                            : 'bg-zinc-900/10 border-zinc-900 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <span>{sev}</span>
                        {active && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Queues */}
              <div className="space-y-3">
                <h3 className="text-white text-base font-semibold border-b border-zinc-900 pb-2">
                  Target Queues
                </h3>
                <div className="space-y-2">
                  {QUEUES.map((q) => {
                    const active = selectedQueues.includes(q);
                    return (
                      <button
                        type="button"
                        key={q}
                        onClick={() => toggleQueue(q)}
                        className={`w-full flex items-center justify-between p-3 rounded-md border transition-all text-left font-bold text-xs ${
                          active
                            ? 'bg-indigo-950/20 border-indigo-900 text-indigo-400'
                            : 'bg-zinc-900/10 border-zinc-900 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <span>{q}</span>
                        {active && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-900/10 border border-zinc-900 p-6 rounded-lg space-y-4">
              <h3 className="text-white text-base font-semibold border-b border-zinc-900 pb-2">
                Actions
              </h3>
              
              <button
                type="submit"
                disabled={notifSaving}
                className="w-full py-2.5 rounded-md bg-zinc-100 hover:bg-white text-black font-semibold transition-all flex items-center justify-center space-x-2 shadow disabled:opacity-50"
              >
                <Save className="w-4 h-4 shrink-0" />
                <span>{notifSaving ? 'Saving...' : 'Save Settings'}</span>
              </button>

              {notifSaved && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-900 rounded text-emerald-400 text-center text-xs">
                  Settings updated successfully.
                </div>
              )}
            </div>

            {/* SMTP config helper */}
            <div className="bg-zinc-900/10 border border-zinc-900 p-6 rounded-lg space-y-3">
              <h3 className="text-white text-base font-semibold border-b border-zinc-900 pb-2 flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-indigo-400" />
                <span>SMTP Variables</span>
              </h3>
              <p className="text-zinc-500 text-xs leading-normal">
                Define these inside the monorepo `.env` file to support Nodemailer email alerts:
              </p>
              <div className="space-y-2 bg-black/40 border border-zinc-900 p-3 rounded font-mono text-[10px] text-zinc-400 leading-normal select-all">
                <p>SMTP_HOST=mail.server.com</p>
                <p>SMTP_PORT=587</p>
                <p>SMTP_USER=username</p>
                <p>SMTP_PASS=password</p>
                <p>SMTP_FROM=alert@queuewatch.io</p>
              </div>
            </div>
          </div>

        </form>
      )}

      {ruleToDelete && (
        <div 
          onClick={() => setRuleToDelete(null)}
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-opacity animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-zinc-900 p-6 rounded-lg w-full max-w-xs shadow-2xl font-sans text-xs space-y-4 animate-slide-up text-zinc-300"
          >
            <div className="flex items-center space-x-2 border-b border-zinc-900 pb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
              <span className="text-sm font-semibold text-white">Delete Escalation Rule?</span>
            </div>
            <p className="leading-relaxed text-zinc-400 text-xs">
              Are you sure you want to permanently delete this incident escalation rule? You will stop receiving alerts for this configuration.
            </p>
            <div className="flex space-x-3 pt-1.5">
              <button
                onClick={() => setRuleToDelete(null)}
                className="flex-1 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = ruleToDelete;
                  setRuleToDelete(null);
                  await handleDeleteEscRule(id);
                }}
                className="flex-1 py-2 rounded-md bg-rose-955/20 hover:bg-rose-955/40 text-rose-455 border border-rose-900/30 text-xs font-semibold transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
