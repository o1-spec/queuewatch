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

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Reliability Scoring Center & rankings</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Realtime reliability scoring engine mapping execution failures, MTTR delay factors, and queues backlogs into active index scores.
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns: Rankings scoreboard */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4">
          <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2.5">
            Subsystem Reliability Rankings
          </h3>

          {loading ? (
            <div className="text-center py-12 text-zinc-650 animate-pulse">calculating indices...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedScores.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => {
                      setSelectedTarget(item.targetId);
                      loadHistory(item.targetId);
                    }}
                    className={`p-4 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-4 ${
                      selectedTarget === item.targetId ? 'bg-indigo-950/10 border-indigo-500' : 'bg-zinc-900/10 border-zinc-900 hover:border-zinc-850'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${item.score >= 85 ? 'bg-emerald-450' : item.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                        <span className="font-bold text-white text-[11px] uppercase tracking-tight">{item.targetId}</span>
                      </div>
                      <p className="text-zinc-550 text-[9px] mt-1">
                        Type: <span className="text-zinc-400 uppercase font-mono">{item.targetType}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <div className={`text-2xl font-bold ${item.score >= 85 ? 'text-emerald-450' : item.score >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {item.score}
                      </div>
                      <span className="text-[8px] text-zinc-500 uppercase font-bold">SLO score</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Metrics table breakdown */}
              <div className="border border-zinc-900 rounded overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900/30 border-b border-zinc-900 text-zinc-500 font-bold uppercase text-[8px]">
                      <th className="p-3">Target Name</th>
                      <th className="p-3">Failure Rate</th>
                      <th className="p-3">Retry Rate</th>
                      <th className="p-3">Backlog Growth</th>
                      <th className="p-3">Worker Health</th>
                      <th className="p-3">MTTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-900/40 last:border-0 hover:bg-zinc-900/5">
                        <td className="p-3 font-bold text-white">{item.targetId}</td>
                        <td className="p-3 text-zinc-400">{item.failureRate}%</td>
                        <td className="p-3 text-zinc-400">{item.retryRate}%</td>
                        <td className="p-3 text-zinc-400">+{item.backlogGrowth}</td>
                        <td className="p-3 text-zinc-400">{item.workerHealthScore}%</td>
                        <td className="p-3 text-zinc-400">{item.mttrMinutes} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Columns: Trend Chart list */}
        <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4">
          <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2.5">
            Reliability Score History
          </h3>

          {!selectedTarget ? (
            <div className="text-center py-16 text-zinc-650">Select target node to view history logs</div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-zinc-900/40 border border-zinc-900 rounded flex items-center justify-between">
                <span className="text-zinc-500 uppercase text-[9px] font-bold">INSIDER FOCUS INDEX</span>
                <span className="text-white font-bold uppercase text-[11px]">{selectedTarget}</span>
              </div>

              <div className="space-y-3">
                {(history[selectedTarget] || []).map((hist, idx) => (
                  <div key={idx} className="p-3 bg-zinc-900/10 border border-zinc-900/50 rounded flex items-center justify-between">
                    <div>
                      <span className="text-zinc-550 text-[8.5px] block font-sans">
                        {new Date(hist.timestamp).toLocaleString()}
                      </span>
                      <p className="text-[9px] text-zinc-400 mt-0.5">
                        Failures: <span className="text-zinc-300 font-bold">{hist.failureRate}%</span> &bull; Backlog Growth: <span className="text-zinc-300 font-bold">+{hist.backlogGrowth}</span>
                      </p>
                    </div>

                    <strong className={`text-sm font-bold ${hist.score >= 85 ? 'text-emerald-450' : hist.score >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                      {hist.score}
                    </strong>
                  </div>
                ))}

                {(!history[selectedTarget] || history[selectedTarget].length === 0) && (
                  <div className="text-center py-10 text-zinc-650 font-sans text-xs">
                    No historical logs recorded. Score telemetry updates will populate indices on the next cron check.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
