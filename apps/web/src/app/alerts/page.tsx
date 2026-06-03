'use client';

import React, { useState, useEffect } from 'react';
import { Sliders, Plus, Trash2, Bell, Radio } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AlertRule } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AlertConfiguration() {
  const { authFetch } = useAuth();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [queueName, setQueueName] = useState('email_notifications');
  const [metric, setMetric] = useState('failureRate');
  const [operator, setOperator] = useState('>');
  const [threshold, setThreshold] = useState(15);
  const [severity, setSeverity] = useState('high');

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesRes, notifRes] = await Promise.all([
        authFetch(`${API_URL}/api/alert-rules`),
        authFetch(`${API_URL}/api/alert-rules/notifications`),
      ]);
      if (rulesRes.ok) {
        setRules(await rulesRes.json());
      }
      if (notifRes.ok) {
        setNotifications(await notifRes.json());
      }
    } catch (e) {
      console.error('Failed to load alert rules:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const res = await authFetch(`${API_URL}/api/alert-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          queueName,
          metric,
          operator,
          threshold: Number(threshold),
          durationSeconds: 60,
          severity,
          enabled: true,
        }),
      });

      if (res.ok) {
        const newRule = await res.json();
        setRules((prev) => [...prev, newRule]);
        setName('');
      }
    } catch (e) {
      console.error('Failed to create rule:', e);
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/alert-rules/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete rule:', e);
    }
  };

  const toggleRule = async (id: string, currentlyEnabled: boolean) => {
    try {
      const res = await authFetch(`${API_URL}/api/alert-rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentlyEnabled }),
      });
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, enabled: !currentlyEnabled } : r))
        );
      }
    } catch (e) {
      console.error('Failed to toggle rule:', e);
    }
  };

  return (
    <div className="space-y-5 font-mono text-[10px]">
      
      {/* Header */}
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-zinc-400 shrink-0" />
          <span>Alert Rules & Notification Triggers</span>
        </h2>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          Configure custom triggers on queue metrics and dispatch simulated Slack webhook alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left Side: Create Rule Form */}
        <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg h-fit space-y-4">
          <div className="border-b border-zinc-900 pb-2.5">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5">
              <Plus className="w-4 h-4 text-zinc-400" />
              <span>Define Alert Rule</span>
            </h3>
          </div>

          <form onSubmit={createRule} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Rule Identifier Name</label>
              <input
                type="text"
                placeholder="e.g. FailureRate High Alert"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-zinc-850"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Target Queue</label>
              <select
                value={queueName}
                onChange={(e) => setQueueName(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-900 rounded px-2 py-1.5 text-white focus:outline-none"
              >
                <option value="email_notifications">email_notifications</option>
                <option value="webhook_delivery">webhook_delivery</option>
                <option value="image_processing">image_processing</option>
                <option value="ai_tasks">ai_tasks</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Metric Trigger</label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-900 rounded px-2 py-1.5 text-white focus:outline-none"
              >
                <option value="failureRate">Failure Rate (%)</option>
                <option value="retryRate">Retry Rate (%)</option>
                <option value="backlog">Queue Backlog (Count)</option>
                <option value="avgLatency">Avg Latency (ms)</option>
                <option value="deadLetterCount">Dead Letter Count (Count)</option>
                <option value="workerHealthScore">Worker Health Score (0-100)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Operator</label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-900 rounded px-2 py-1.5 text-white focus:outline-none"
                >
                  <option value=">">&gt; greater than</option>
                  <option value="<">&lt; less than</option>
                  <option value="==">== equal to</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Threshold Value</label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1 text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-900 rounded px-2 py-1.5 text-white focus:outline-none"
              >
                <option value="low">LOW</option>
                <option value="medium">MEDIUM</option>
                <option value="high">HIGH</option>
                <option value="critical">CRITICAL</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-bold border border-zinc-800 transition-all flex items-center justify-center space-x-1 shadow"
            >
              <span>ADD RULE TRIGGER</span>
            </button>
          </form>
        </div>

        {/* Center/Right Side: Active Rules Catalog & Recent Alerts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg">
            <h3 className="font-bold text-white text-xs border-b border-zinc-900 pb-3 mb-4 uppercase tracking-tight">Active Rules Catalog</h3>

            {loading ? (
              <div className="text-center py-6 text-zinc-650 animate-pulse">loading rules...</div>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div key={rule.id} className="p-3 bg-zinc-900/10 rounded border border-zinc-900 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <strong className="text-white text-[11px]">{rule.name}</strong>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] border uppercase ${
                          rule.severity === 'critical' ? 'bg-rose-950/20 border-rose-900 text-rose-450' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                        }`}>
                          {rule.severity}
                        </span>
                      </div>
                      <p className="text-zinc-500 mt-1 font-sans text-[10px]">
                        Condition: <span className="text-zinc-300 font-mono">{rule.queueName}</span> metric <span className="text-zinc-300 font-mono">{rule.metric} {rule.operator} {rule.threshold}</span>
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleRule(rule.id, rule.enabled)}
                        className={`px-2 py-0.5 rounded text-[9px] border font-bold ${
                          rule.enabled ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                        }`}
                      >
                        {rule.enabled ? 'ENABLED' : 'DISABLED'}
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alarm Timeline logs */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg">
            <h3 className="font-bold text-white text-xs border-b border-zinc-900 pb-3 mb-4 uppercase tracking-tight flex items-center space-x-2">
              <Bell className="w-4 h-4 text-zinc-500" />
              <span>Alarm Notification Dispatch Logs</span>
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notifications.map((notif) => (
                <div key={notif.id} className="p-2.5 bg-black/40 border border-zinc-900 rounded font-sans text-[11px] leading-relaxed text-zinc-300 flex items-start space-x-2">
                  <Radio className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0 animate-pulse" />
                  <div>
                    <span className="text-zinc-500 font-mono text-[9px]">{new Date(notif.timestamp).toLocaleTimeString()}</span>
                    <p className="mt-0.5">{notif.message}</p>
                  </div>
                </div>
              ))}

              {notifications.length === 0 && (
                <p className="text-zinc-600 text-center py-6">No alarms triggered in the current session window.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
