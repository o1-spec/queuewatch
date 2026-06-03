'use client';

import React, { useState, useEffect } from 'react';
import { Sliders, Plus, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { EscalationRule } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function EscalationRulesManager() {
  const { authFetch } = useAuth();
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [queueName, setQueueName] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [condition, setCondition] = useState('Unacknowledged > 10 min');
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [channels, setChannels] = useState<string[]>(['dashboard']);

  const loadRules = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/escalation-rules`);
      if (res.ok) {
        setRules(await res.json());
      }
    } catch (e) {
      console.error('Failed to load escalation rules:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const res = await authFetch(`${API_URL}/api/escalation-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          queueName,
          severity,
          condition,
          delayMinutes: Number(delayMinutes),
          channels,
          enabled: true,
        }),
      });

      if (res.ok) {
        const newRule = await res.json();
        setRules((prev) => [...prev, newRule]);
        setName('');
      }
    } catch (e) {
      console.error('Failed to create escalation rule:', e);
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/escalation-rules/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete rule:', e);
    }
  };

  const toggleRule = async (rule: EscalationRule) => {
    try {
      const res = await authFetch(`${API_URL}/api/escalation-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, enabled: !rule.enabled } : r))
        );
      }
    } catch (e) {
      console.error('Failed to toggle rule:', e);
    }
  };

  const handleChannelToggle = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
          <span>Incident Escalation & SLA Rules</span>
        </h2>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          Configure rule delays to automatically page developers or dispatch webhook notifications when incidents linger unacknowledged.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Create Rule Form */}
        <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg h-fit space-y-4 shadow">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-zinc-900 pb-2">
            <Plus className="w-4 h-4 text-zinc-400" />
            <span>Create Escalation Rule</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Rule Name</label>
              <input
                type="text"
                placeholder="e.g. Critical SLA Exceeded"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-zinc-800 text-xs font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Queue Scope</label>
              <select
                value={queueName}
                onChange={(e) => setQueueName(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-900 rounded px-2 py-1.5 text-white focus:outline-none"
              >
                <option value="all">ALL QUEUES (Wildcard)</option>
                <option value="email_notifications">email_notifications</option>
                <option value="webhook_delivery">webhook_delivery</option>
                <option value="image_processing">image_processing</option>
                <option value="ai_tasks">ai_tasks</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Severity Filter</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-900 rounded px-2 py-1.5 text-white focus:outline-none"
              >
                <option value="all">ALL SEVERITIES</option>
                <option value="critical">CRITICAL Only</option>
                <option value="high">HIGH and above</option>
                <option value="medium">MEDIUM and above</option>
                <option value="low">LOW and above</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Delay (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(Number(e.target.value))}
                  className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1 text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Condition Hint</label>
                <input
                  type="text"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1 text-white focus:outline-none font-sans"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Escalation Channels</label>
              <div className="space-y-1 text-xs">
                {['dashboard', 'email', 'slack_webhook', 'discord_webhook'].map((c) => (
                  <label key={c} className="flex items-center space-x-2 text-zinc-300 font-sans cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channels.includes(c)}
                      onChange={() => handleChannelToggle(c)}
                      className="rounded border-zinc-800 bg-zinc-900 text-indigo-500 w-3.5 h-3.5"
                    />
                    <span className="capitalize">{c.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 mt-2 rounded bg-zinc-900 hover:bg-zinc-850 text-white font-bold border border-zinc-800 transition-all flex items-center justify-center space-x-1 shadow"
            >
              <span>REGISTER SLA RULE</span>
            </button>
          </form>
        </div>

        {/* Right/Center Column: Rules list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg">
            <h3 className="font-bold text-white text-xs uppercase tracking-tight border-b border-zinc-900 pb-3 mb-4">
              Escalation Rules Catalog
            </h3>

            {loading ? (
              <div className="text-center py-8 text-zinc-650 animate-pulse">loading escalation rules...</div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div key={rule.id} className="p-4 bg-zinc-900/10 rounded border border-zinc-900 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <strong className="text-white text-[11px]">{rule.name}</strong>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] border uppercase ${
                          rule.severity === 'critical' ? 'bg-rose-950/20 border-rose-900 text-rose-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                        }`}>
                          {rule.severity}
                        </span>
                      </div>
                      <p className="text-zinc-500 font-sans text-xs">
                        If unacknowledged for <strong className="text-zinc-300 font-mono">{rule.delayMinutes} min</strong> on queue <strong className="text-zinc-300 font-mono">{rule.queueName}</strong>, escalate to:
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rule.channels.map((chan) => (
                          <span key={chan} className="px-1.5 py-0.2 rounded text-[7px] bg-zinc-900 border border-zinc-850 text-zinc-400 uppercase font-mono">
                            {chan.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <button
                        onClick={() => toggleRule(rule)}
                        className={`px-2 py-0.5 rounded text-[9px] border font-bold ${
                          rule.enabled ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                        }`}
                      >
                        {rule.enabled ? 'ACTIVE' : 'MUTED'}
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {rules.length === 0 && (
                  <div className="text-center py-10 text-zinc-600 font-bold">
                    No incident escalation rules loaded. Add a rule to evaluate unacknowledged incident thresholds.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
