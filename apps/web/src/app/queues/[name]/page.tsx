'use client';

import React, { useState, useEffect, useCallback } from 'react';
import useSocket from '../../../hooks/useSocket';
import { QueueMetrics, WorkerHealth, QueueName } from '@queuewatch/shared';
import Link from 'next/link';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid
} from 'recharts';

import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function QueueDetailPage({ params }: { params: { name: string } }) {
  const queueName = params.name as QueueName;
  const { authFetch } = useAuth();

  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [worker, setWorker] = useState<WorkerHealth | null>(null);
  const [replayLoading, setReplayLoading] = useState<string | null>(null);

  // Load metrics logs
  const loadDetails = useCallback(async () => {
    try {
      const [jobsRes] = await Promise.all([
        authFetch(`${API_URL}/api/queues/${queueName}/jobs?limit=50`),
      ]);

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData);
      }
    } catch (e) {
      console.error('Failed to load queue details:', e);
    }
  }, [queueName, authFetch]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Hook real-time websocket metrics
  useSocket({
    'queue.metrics.updated': (data: QueueMetrics[]) => {
      const match = data.find((m) => m.queueName === queueName);
      if (match) {
        setMetrics(match);
        // Add to historical charting list
        setHistory((prev) => {
          const timestampLabel = new Date(match.timestamp).toLocaleTimeString();
          const item = {
            time: timestampLabel,
            throughput: match.throughput,
            latency: match.averageLatency,
          };
          return [...prev, item].slice(-15); // Keep last 15 ticks
        });
      }
    },
    'worker.health.updated': (data: WorkerHealth[]) => {
      const match = data.find((w) => w.queueName === queueName);
      if (match) {
        setWorker(match);
      }
    },
    'job.completed': () => refreshJobs(),
    'job.failed': () => refreshJobs(),
    'job.deadlettered': () => refreshJobs(),
  });

  const refreshJobs = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/queues/${queueName}/jobs?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (e) {
      console.error('Failed to refresh jobs list:', e);
    }
  };

  const replayJob = async (jobId: string) => {
    setReplayLoading(jobId);
    try {
      const res = await authFetch(`${API_URL}/api/queues/jobs/${jobId}/replay`, {
        method: 'POST',
      });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
      }
    } catch (e) {
      console.error('Failed to replay job:', e);
    } finally {
      setReplayLoading(null);
    }
  };

  // filter failed jobs
  const failedJobs = jobs.filter((j) => j.status === 'failed');

  return (
    <div className="space-y-8">
      {/* Header breadcrumb */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            <Link href="/queues" className="hover:text-indigo-400 transition-colors">Queues Explorer</Link>
            <span>&bull;</span>
            <span className="text-slate-300 font-mono">{queueName}</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white mt-1 tracking-tight font-mono">{queueName} Detail</h2>
        </div>

        {worker && (
          <div className="flex items-center space-x-3 bg-slate-950/40 border border-slate-900 px-4 py-2 rounded-xl text-xs">
            <span className={`w-2 h-2 rounded-full ${
              worker.status === 'healthy' ? 'bg-emerald-500 glow-emerald' : 
              worker.status === 'overloaded' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500 animate-ping'
            }`}></span>
            <span className="text-slate-500 font-medium">Worker Status:</span>
            <strong className="text-white uppercase font-mono">{worker.status}</strong>
          </div>
        )}
      </div>

      {/* Grid: 4 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="glass-card p-4 rounded-xl">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Waiting Jobs</p>
          <p className="text-2xl font-extrabold text-cyan-400 mt-1 font-mono">{metrics?.waitingCount ?? 0}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Active Jobs</p>
          <p className="text-2xl font-extrabold text-indigo-400 mt-1 font-mono">{metrics?.activeCount ?? 0}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Completed Jobs</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">{metrics?.completedCount ?? 0}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Failed Jobs</p>
          <p className="text-2xl font-extrabold text-rose-500 mt-1 font-mono">{metrics?.failedCount ?? 0}</p>
        </div>
      </div>

      {/* Recharts Timelines Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Throughput Area chart */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="font-bold text-white text-sm mb-4">Completions Throughput (Completed/Min)</h3>
          <div className="h-56 w-full text-slate-400">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} />
                <YAxis stroke="#475569" fontSize={9} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff', fontSize: '10px', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#818cf8', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="throughput" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#throughputGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency Bar chart */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="font-bold text-white text-sm mb-4">Processing Delay Latency (ms)</h3>
          <div className="h-56 w-full text-slate-400">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} />
                <YAxis stroke="#475569" fontSize={9} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff', fontSize: '10px', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#22d3ee', fontSize: '11px' }}
                />
                <Bar dataKey="latency" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Failed Jobs Table */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="border-b border-slate-900 pb-3 mb-6">
          <h3 className="font-bold text-white text-md">Failed Jobs Timeline</h3>
          <p className="text-xs text-slate-400">Jobs that experienced failures. Active retries will re-process them under backoff limits.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="pb-3">Job ID</th>
                <th className="pb-3">Job Action</th>
                <th className="pb-3">State</th>
                <th className="pb-3">Attempts</th>
                <th className="pb-3">Failure Reason</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {failedJobs.map((job) => (
                <tr key={job.id} className="border-b border-slate-900/60 last:border-0 hover:bg-slate-950/20">
                  <td className="py-4 font-mono font-bold text-slate-300">{job.id}</td>
                  <td className="py-4 font-semibold text-white">{job.name}</td>
                  <td className="py-4">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border text-amber-500 bg-amber-950/20 border-amber-500/20">
                      {job.status}
                    </span>
                  </td>
                  <td className="py-4 font-mono text-slate-400">{job.attemptsMade} / {job.maxAttempts}</td>
                  <td className="py-4 text-slate-300 font-mono text-[11px] truncate max-w-xs">{job.failedReason || 'Connection blip'}</td>
                  <td className="py-4 text-right">
                    <button
                      onClick={() => replayJob(job.id)}
                      disabled={replayLoading === job.id}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold transition-all disabled:opacity-50"
                    >
                      {replayLoading === job.id ? 'Replaying...' : 'Replay Job'}
                    </button>
                  </td>
                </tr>
              ))}

              {failedJobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                    No failed jobs currently scheduled in Redis memory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
