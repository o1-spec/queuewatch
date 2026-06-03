'use client';

import React, { useState, useEffect } from 'react';
import { Sliders, Save, ShieldAlert, Mail, Terminal, Send, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NotificationSetting } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function NotificationSettings() {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Settings state
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [dashboardEnabled, setEmailDashboardEnabled] = useState(true);
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [slackUrl, setSlackUrl] = useState('');
  const [discordUrl, setDiscordUrl] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedQueues, setSelectedQueues] = useState<string[]>([]);

  const queues = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];
  const severities = ['low', 'medium', 'high', 'critical'];

  const loadSettings = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/notifications/settings`);
      if (res.ok) {
        const data: NotificationSetting = await res.json();
        setEmailEnabled(data.emailEnabled);
        setEmailDashboardEnabled(data.dashboardEnabled);
        setWebhookEnabled(data.webhookEnabled || false);
        setSlackUrl(data.slackWebhookUrl || '');
        setDiscordUrl(data.discordWebhookUrl || '');
        setSelectedSeverities(data.severities || []);
        setSelectedQueues(data.queues || []);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

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
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
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
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Notification Channel Preferences</span>
        </h2>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          Configure active alerting paths, filters, and SRE messaging settings.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="bg-zinc-950 border border-zinc-900 h-64 rounded-lg"></div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Channels settings */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4">
              <h3 className="text-white text-xs font-bold uppercase tracking-wider pb-2 border-b border-zinc-900">
                Active Notification Channels
              </h3>
              
              {/* Dashboard toggle */}
              <div className="flex items-center justify-between p-3.5 bg-zinc-900/10 border border-zinc-900 rounded">
                <div className="space-y-0.5">
                  <span className="font-bold text-white uppercase flex items-center space-x-1.5">
                    <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Dashboard Alerts</span>
                  </span>
                  <p className="text-zinc-550 font-sans text-xs">Save anomalies to the live notification center ledger.</p>
                </div>
                <input
                  type="checkbox"
                  checked={dashboardEnabled}
                  onChange={(e) => setEmailDashboardEnabled(e.target.checked)}
                  className="rounded border-zinc-800 bg-zinc-900 text-indigo-500 w-4 h-4 focus:ring-0 focus:ring-offset-0"
                />
              </div>

              {/* Email toggle */}
              <div className="flex items-center justify-between p-3.5 bg-zinc-900/10 border border-zinc-900 rounded">
                <div className="space-y-0.5">
                  <span className="font-bold text-white uppercase flex items-center space-x-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Email Dispatch Alerts (Nodemailer)</span>
                  </span>
                  <p className="text-zinc-550 font-sans text-xs">Send critical SRE logs directly to system developers.</p>
                </div>
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="rounded border-zinc-800 bg-zinc-900 text-indigo-500 w-4 h-4 focus:ring-0 focus:ring-offset-0"
                />
              </div>

              {/* Webhook toggle */}
              <div className="flex items-center justify-between p-3.5 bg-zinc-900/10 border border-zinc-900 rounded">
                <div className="space-y-0.5">
                  <span className="font-bold text-white uppercase flex items-center space-x-1.5">
                    <Send className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Slack & Discord Webhook Integration</span>
                  </span>
                  <p className="text-zinc-550 font-sans text-xs">Post real-time incident updates to configured webhooks.</p>
                </div>
                <input
                  type="checkbox"
                  checked={webhookEnabled}
                  onChange={(e) => setWebhookEnabled(e.target.checked)}
                  className="rounded border-zinc-800 bg-zinc-900 text-indigo-500 w-4 h-4 focus:ring-0 focus:ring-offset-0"
                />
              </div>

              {webhookEnabled && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Slack Webhook URL</label>
                    <input
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={slackUrl}
                      onChange={(e) => setSlackUrl(e.target.value)}
                      className="w-full bg-black/40 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-zinc-800 text-xs font-sans"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Discord Webhook URL</label>
                    <input
                      type="url"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={discordUrl}
                      onChange={(e) => setDiscordUrl(e.target.value)}
                      className="w-full bg-black/40 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-zinc-800 text-xs font-sans"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Scope filters */}
            <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Severity Scope */}
              <div className="space-y-3">
                <h3 className="text-white text-xs font-bold uppercase tracking-wider pb-1.5 border-b border-zinc-900">
                  Severity Scope Limits
                </h3>
                <div className="space-y-2">
                  {severities.map((sev) => {
                    const active = selectedSeverities.includes(sev);
                    return (
                      <button
                        type="button"
                        key={sev}
                        onClick={() => toggleSeverity(sev)}
                        className={`w-full flex items-center justify-between p-2 rounded border transition-all text-left uppercase font-bold text-[9px] ${
                          active
                            ? 'bg-indigo-950/15 border-indigo-900 text-indigo-400'
                            : 'bg-zinc-900/10 border-zinc-900 text-zinc-500 hover:text-zinc-350'
                        }`}
                      >
                        <span>{sev}</span>
                        {active && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Queue Scope */}
              <div className="space-y-3">
                <h3 className="text-white text-xs font-bold uppercase tracking-wider pb-1.5 border-b border-zinc-900">
                  Target Queue Channels
                </h3>
                <div className="space-y-2">
                  {queues.map((q) => {
                    const active = selectedQueues.includes(q);
                    return (
                      <button
                        type="button"
                        key={q}
                        onClick={() => toggleQueue(q)}
                        className={`w-full flex items-center justify-between p-2 rounded border transition-all text-left font-bold text-[9px] ${
                          active
                            ? 'bg-indigo-950/15 border-indigo-900 text-indigo-400'
                            : 'bg-zinc-900/10 border-zinc-900 text-zinc-500 hover:text-zinc-350'
                        }`}
                      >
                        <span>{q}</span>
                        {active && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Configuration sidebar and save trigger */}
          <div className="space-y-5">
            <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4">
              <h3 className="text-white text-xs font-bold uppercase tracking-wider pb-2 border-b border-zinc-900">
                Actions
              </h3>
              
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 rounded bg-indigo-900 hover:bg-indigo-950 text-white font-bold border border-indigo-800 transition-all flex items-center justify-center space-x-1.5 shadow disabled:opacity-55"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'SAVING PREFERENCES...' : 'SAVE SETTINGS'}</span>
              </button>

              {saved && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-900 rounded text-emerald-400 text-center font-sans text-xs">
                  Notification settings saved successfully.
                </div>
              )}
            </div>

            {/* SMTP Guide */}
            <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3.5">
              <h3 className="text-white text-xs font-bold uppercase tracking-wider pb-2 border-b border-zinc-900 flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-indigo-400" />
                <span>SMTP Environment Setup</span>
              </h3>
              <p className="text-zinc-500 font-sans text-xs leading-normal">
                To activate Nodemailer outbound alerts, define the following variables inside your monorepo `.env` file and restart backend workers:
              </p>
              <div className="space-y-2 bg-black/40 border border-zinc-900 p-3 rounded font-mono text-[9px] text-zinc-400 leading-normal select-all">
                <p>SMTP_HOST=mail.server.com</p>
                <p>SMTP_PORT=587</p>
                <p>SMTP_USER=your_smtp_username</p>
                <p>SMTP_PASS=•••••••••••••••</p>
                <p>SMTP_FROM=alert@queuewatch.io</p>
                <p>SMTP_SECURE=false</p>
              </div>
            </div>
          </div>

        </form>
      )}
    </div>
  );
}
