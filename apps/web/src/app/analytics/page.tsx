'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Layers, ShieldAlert, Sparkles, AlertTriangle, Calendar, Clock, BarChart3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AnalyticsData {
  incidentsBySeverity: Record<string, number>;
  mttrMinutes: number;
  topRecurringIssues: { pattern: string; count: number }[];
  deploymentStabilityRate: number;
  queuePerformance: { name: string; throughput: number; failureRate: number }[];
  serviceReliability: { name: string; score: number }[];
}

export default function AnalyticsReport() {
  const { authFetch } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/analytics`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>SRE Operational Analytics & MTTR report</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Aggregated statistics for mean-time-to-resolution, deployment stability, and incident distribution indices.
          </p>
        </div>

        <button
          onClick={loadAnalytics}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>REFRESH REPORT</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-650 animate-pulse">generating report...</div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Columns: SLA and Performance Metrics */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* General metrics widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-lg space-y-2">
                <span className="text-zinc-550 uppercase text-[9px] font-bold block">Mean Time to Resolution</span>
                <div className="flex items-baseline space-x-1.5 mt-2">
                  <span className="text-2xl font-bold text-white">{data.mttrMinutes} min</span>
                </div>
                <p className="text-[9px] text-zinc-500 font-sans">rolling 30-day average MTTR index</p>
              </div>

              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-lg space-y-2">
                <span className="text-zinc-550 uppercase text-[9px] font-bold block">Release Stability Rate</span>
                <div className="flex items-baseline space-x-1.5 mt-2">
                  <span className="text-2xl font-bold text-emerald-450">{data.deploymentStabilityRate}%</span>
                </div>
                <p className="text-[9px] text-zinc-500 font-sans">releases processed without failures</p>
              </div>

              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-lg space-y-2">
                <span className="text-zinc-550 uppercase text-[9px] font-bold block">Telemetry SLA Score</span>
                <div className="flex items-baseline space-x-1.5 mt-2">
                  <span className="text-2xl font-bold text-white">99.98%</span>
                </div>
                <p className="text-[9px] text-zinc-500 font-sans">uptime metrics for background queue loops</p>
              </div>
            </div>

            {/* Queue Performance stats */}
            <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4">
              <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2.5">
                Subsystem Performance Indices
              </h3>

              <div className="border border-zinc-900 rounded overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900/30 border-b border-zinc-900 text-zinc-500 font-bold uppercase text-[8px]">
                      <th className="p-3">Queue Channel</th>
                      <th className="p-3">Average Throughput</th>
                      <th className="p-3">Rolling Failure Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.queuePerformance.map((queue) => (
                      <tr key={queue.name} className="border-b border-zinc-900/40 last:border-0 hover:bg-zinc-900/5">
                        <td className="p-3 font-bold text-white">{queue.name}</td>
                        <td className="p-3 text-zinc-400">{queue.throughput} jobs/min</td>
                        <td className="p-3 text-rose-450 font-bold">{queue.failureRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Columns: Severity counts & Recurring issues */}
          <div className="space-y-4">
            
            {/* Incident severity counts */}
            <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3">
              <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2">
                Incidents Severity Distribution
              </h3>

              <div className="space-y-2.5 pt-1">
                {Object.entries(data.incidentsBySeverity).map(([severity, count]) => (
                  <div key={severity} className="flex justify-between items-center border-b border-zinc-900/50 pb-1.5 last:border-0">
                    <span className="capitalize text-zinc-400 font-mono text-[9.5px]">{severity}</span>
                    <strong className="text-white text-xs font-bold">{count}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Top recurring issues */}
            <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3">
              <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2">
                Top Root Cause Signatures
              </h3>

              <div className="space-y-3 pt-1">
                {data.topRecurringIssues.map((issue, idx) => (
                  <div key={idx} className="p-3 bg-zinc-900/25 border border-zinc-900 rounded space-y-1.5">
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-indigo-400 font-bold">Signature #{idx + 1}</span>
                      <span className="text-zinc-550">{issue.count} occurrences</span>
                    </div>
                    <p className="text-zinc-400 font-sans text-xs leading-normal">
                      {issue.pattern}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="text-center py-10 text-zinc-650">
          Failed to generate analytics summaries.
        </div>
      )}
    </div>
  );
}
