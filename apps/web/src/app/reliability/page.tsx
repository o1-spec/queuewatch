'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, GitCommit, Layers, Server, Activity, ShieldAlert, Sparkles, AlertTriangle, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ReliabilityScore } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ReliabilityCenter() {
  const { authFetch } = useAuth();
  const [scores, setScores] = useState<ReliabilityScore[]>([]);
  const [history, setHistory] = useState<Record<string, ReliabilityScore[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  const loadReliability = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/reliability`);
      if (res.ok) {
        const data: ReliabilityScore[] = await res.json();
        setScores(data);
        if (data.length > 0 && !selectedTarget) {
          setSelectedTarget(data[0].targetId);
          loadHistory(data[0].targetId);
        }
      }
    } catch (e) {
      console.error('Failed to load reliability scores:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (targetId: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/reliability/history/${targetId}`);
      if (res.ok) {
        const histData = await res.json();
        setHistory(prev => ({ ...prev, [targetId]: histData }));
      }
    } catch (e) {
      console.error('Failed to load history for:', targetId, e);
    }
  };

  useEffect(() => {
    loadReliability();
  }, []);

  const sortedScores = [...scores].sort((a, b) => b.score - a.score);

  const selectedScoreItem = scores.find(s => s.targetId === selectedTarget);
  const contributors = selectedScoreItem?.contributors || {
    failureRate: 0,
    latency: 0,
    workerHealth: 0,
    incidents: 0,
    blastRadius: 0,
    deployments: 0
  };

  const getLatencySLO = (targetId: string) => {
    if (targetId.includes('ai')) return 5000;
    if (targetId.includes('image') || targetId.includes('media')) return 2000;
    if (targetId.includes('webhook') || targetId.includes('payment')) return 1500;
    return 1000;
  };

  const latencyTarget = selectedTarget ? getLatencySLO(selectedTarget) : 1000;
  const latencyDeduction = Math.abs(contributors.latency || 0);
  // Latency weight is 0.20, so deduction is latencyRatio * 100 * 0.20 = latencyRatio * 20.
  // Therefore, latencyRatio = latencyDeduction / 20.
  // And actualLatency = latencyTarget * (1 + latencyRatio).
  const actualLatency = latencyDeduction > 0 
    ? Math.round(latencyTarget * (1 + (latencyDeduction / 20))) 
    : Math.round(latencyTarget * 0.72);

  const availabilityTarget = 99.0;
  const actualAvailability = selectedScoreItem ? (100 - selectedScoreItem.failureRate) : 100.0;

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Reliability Scoring Center & SLO Compliance</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Realtime scoring framework mapping telemetry, open incidents, and SRE blast-radii cascades to explainable service index scores.
          </p>
        </div>

        <button
          onClick={loadReliability}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>RECALCULATE SCORES</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Columns: Rankings scoreboard */}
        <div className="xl:col-span-2 bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-5 shadow-xl">
          <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2.5">
            System SLO Scoreboard
          </h3>

          {loading ? (
            <div className="text-center py-12 text-zinc-650 animate-pulse">calculating indices...</div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedScores.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => {
                      setSelectedTarget(item.targetId);
                      loadHistory(item.targetId);
                    }}
                    className={`p-4 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-4 ${
                      selectedTarget === item.targetId 
                        ? 'bg-indigo-950/10 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                        : 'bg-zinc-900/10 border-zinc-900 hover:border-zinc-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          item.score >= 85 ? 'bg-emerald-450 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse' : 
                          item.score >= 60 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 
                          'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-ping'
                        }`} />
                        <span className="font-bold text-white text-[11px] uppercase tracking-tight">{item.targetId.startsWith('svc_') ? item.targetId.slice(4).replace(/_/g, '-') : item.targetId}</span>
                      </div>
                      <p className="text-zinc-550 text-[9px] mt-1.5 font-sans">
                        Type: <span className="text-zinc-400 uppercase font-mono font-bold">{item.targetType}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <div className={`text-2xl font-bold font-mono ${
                        item.score >= 85 ? 'text-emerald-400' : 
                        item.score >= 60 ? 'text-amber-400' : 
                        'text-rose-400'
                      }`}>
                        {item.score}
                      </div>
                      <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-wider">Score</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Metrics table breakdown */}
              <div className="border border-zinc-900 rounded-lg overflow-x-auto">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-zinc-900/30 border-b border-zinc-900 text-zinc-500 font-bold uppercase text-[8px]">
                      <th className="p-3">Target Subsystem</th>
                      <th className="p-3">Job Failures</th>
                      <th className="p-3">Job Retries</th>
                      <th className="p-3">Backlog growth</th>
                      <th className="p-3">Workers healthy</th>
                      <th className="p-3">Active Incidents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-900/40 last:border-0 hover:bg-zinc-900/5 transition-colors">
                        <td className="p-3 font-bold text-white select-all">{item.targetId.startsWith('svc_') ? item.targetId.slice(4).replace(/_/g, '-') : item.targetId}</td>
                        <td className="p-3 text-zinc-400">{item.failureRate}%</td>
                        <td className="p-3 text-zinc-400">{item.retryRate}%</td>
                        <td className="p-3 text-zinc-400">+{item.backlogGrowth}</td>
                        <td className="p-3 text-zinc-400">{item.workerHealthScore}%</td>
                        <td className="p-3 text-rose-400 font-bold">{item.incidentFrequency} open</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Columns: Explainable Contributors & SLA Trends */}
        <div className="space-y-6">
          {!selectedTarget ? (
            <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-lg text-center text-zinc-650 font-sans text-xs">
              Select focus node on the left scoreboard to inspect SRE score contributors.
            </div>
          ) : (
            <>
              {/* Score breakdown card */}
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
                  <span className="text-zinc-500 uppercase text-[9px] font-bold">SLO score breakdown</span>
                  <span className="text-white font-bold uppercase text-[11px]">{selectedTarget.startsWith('svc_') ? selectedTarget.slice(4).replace(/_/g, '-') : selectedTarget}</span>
                </div>

                {/* Main Gauge Indicator */}
                <div className="flex items-center space-x-4 p-4 bg-black/40 border border-zinc-900 rounded-lg">
                  <div className={`text-4xl font-bold font-mono ${
                    (selectedScoreItem?.score ?? 100) >= 85 ? 'text-emerald-400' :
                    (selectedScoreItem?.score ?? 100) >= 60 ? 'text-amber-400' :
                    'text-rose-400'
                  }`}>
                    {selectedScoreItem?.score ?? 100}<span className="text-xs text-zinc-650">/100</span>
                  </div>
                  <div className="space-y-0.5 font-sans">
                    <span className="text-zinc-300 font-bold block text-xs uppercase tracking-tight">
                      {(selectedScoreItem?.score ?? 100) >= 85 ? 'Optimal SLO compliance' :
                       (selectedScoreItem?.score ?? 100) >= 60 ? 'Warning: SLO breach risk' :
                       'Critical Outage: SLO breached'}
                    </span>
                    <span className="text-[10px] text-zinc-550 block">
                      Compliance index evaluated from SRE telemetry components.
                    </span>
                  </div>
                </div>

                {/* Explainable Contributors List */}
                <div className="space-y-2.5">
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block">Contributor Deductions</span>
                  <div className="space-y-2 font-mono text-[9.5px]">
                    {[
                      { key: 'failureRate', label: 'Job Failures', value: contributors.failureRate, text: 'Points deducted due to task errors' },
                      { key: 'latency',     label: 'Latency Breach', value: contributors.latency,     text: 'Points deducted due to target SLO latency breach' },
                      { key: 'workerHealth',label: 'Worker Offline', value: contributors.workerHealth, text: 'Points deducted due to offline/overloaded worker processes' },
                      { key: 'incidents',   label: 'Open Incident', value: contributors.incidents,    text: 'Points deducted due to open incident logs' },
                      { key: 'blastRadius', label: 'Blast Radius',  value: contributors.blastRadius,   text: 'Points deducted due to downstream cascading effects' },
                      { key: 'deployments',  label: 'Regression',    value: contributors.deployments,   text: 'Points deducted due to deployment regression' },
                    ].map(c => {
                      const hasDeduction = c.value < 0;
                      return (
                        <div key={c.key} className="p-2.5 bg-black/20 border border-zinc-900 rounded-lg flex flex-col gap-1.5">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-zinc-300 uppercase">{c.label}</span>
                            <span className={`font-bold ${hasDeduction ? 'text-rose-400' : 'text-zinc-650'}`}>
                              {hasDeduction ? `${c.value} pts` : 'Compliant (0)'}
                            </span>
                          </div>
                          <span className="text-[9px] font-sans text-zinc-550 leading-relaxed">{c.text}</span>
                          {hasDeduction && (
                            <div className="w-full bg-zinc-900/50 rounded-full h-1 mt-1 border border-zinc-900">
                              <div 
                                className="bg-rose-500 h-1 rounded-full transition-all" 
                                style={{ width: `${Math.min(100, Math.abs(c.value) * 4)}%` }} 
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SRE SLA Targets compliance block */}
                <div className="space-y-2.5 border-t border-zinc-900 pt-3">
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block">Service Level SLA Metrics</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 bg-black/30 border border-zinc-900 rounded-lg space-y-1">
                      <span className="text-zinc-500 font-sans text-[8.5px] block">Availability SLO</span>
                      <div className="flex items-baseline space-x-1.5">
                        <strong className="text-white font-mono text-xs">{actualAvailability.toFixed(2)}%</strong>
                        <span className="text-zinc-600 text-[8px]">/ {availabilityTarget}%</span>
                      </div>
                      <div className="w-full bg-zinc-900 rounded-full h-1 mt-1.5">
                        <div 
                          className={`h-1 rounded-full ${actualAvailability >= availabilityTarget ? 'bg-emerald-550' : 'bg-rose-500'}`}
                          style={{ width: `${actualAvailability}%` }} 
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-black/30 border border-zinc-900 rounded-lg space-y-1">
                      <span className="text-zinc-550 font-sans text-[8.5px] block">Latency SLA</span>
                      <div className="flex items-baseline space-x-1.5">
                        <strong className="text-white font-mono text-xs">{actualLatency}ms</strong>
                        <span className="text-zinc-600 text-[8px]">/ {latencyTarget}ms</span>
                      </div>
                      <div className="w-full bg-zinc-900 rounded-full h-1 mt-1.5">
                        <div 
                          className={`h-1 rounded-full ${actualLatency <= latencyTarget ? 'bg-emerald-550' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(100, (actualLatency / latencyTarget) * 50)}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* History logs */}
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3.5 shadow-xl">
                <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2.5">
                  Reliability Score History
                </h3>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {(history[selectedTarget] || []).map((hist, idx) => (
                    <div key={idx} className="p-2.5 bg-zinc-900/10 border border-zinc-900/50 rounded flex items-center justify-between gap-4">
                      <div>
                        <span className="text-zinc-550 text-[8px] block font-sans">
                          {new Date(hist.timestamp).toLocaleTimeString()}
                        </span>
                        <p className="text-[9px] text-zinc-500 mt-1 font-sans">
                          Failures: <span className="text-zinc-350 font-mono font-bold">{hist.failureRate}%</span> &bull; Workers: <span className="text-zinc-350 font-mono font-bold">{hist.workerHealthScore}%</span>
                        </p>
                      </div>

                      <strong className={`text-[13px] font-mono font-bold ${
                        hist.score >= 85 ? 'text-emerald-450' : 
                        hist.score >= 60 ? 'text-amber-500' : 
                        'text-rose-500'
                      }`}>
                        {hist.score}
                      </strong>
                    </div>
                  ))}

                  {(!history[selectedTarget] || history[selectedTarget].length === 0) && (
                    <div className="text-center py-8 text-zinc-650 font-sans text-xs">
                      No historical compliance checks recorded.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
