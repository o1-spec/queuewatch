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
    <div className="space-y-5">
      {/* Header breadcrumb */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
            <Link href="/queues" className="hover:text-white transition-colors">Queue Registry</Link>
            <span>/</span>
            <span className="text-zinc-300">{queueName}</span>
          </div>
          <h2 className="text-sm font-bold text-white mt-1.5 uppercase font-mono tracking-tight">{queueName} telemetry detail</h2>
        </div>

        {worker && (
          <div className="flex items-center space-x-2 bg-zinc-900/40 border border-zinc-900 px-3 py-1.5 rounded text-[10px] font-mono">
            <span className={`w-1.5 h-1.5 rounded-full ${
              worker.status === 'healthy' ? 'bg-emerald-500' : 
              worker.status === 'overloaded' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500 animate-ping'
            }`}></span>
            <span className="text-zinc-500">worker status:</span>
            <strong className="text-white uppercase">{worker.status}</strong>
          </div>
        )}
      </div>

      {/* Grid: 4 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-[10px]">
        <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg">
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Waiting Jobs</p>
          <p className="text-xl font-bold text-blue-400 mt-2.5">{metrics?.waitingCount ?? 0}</p>
        </div>
        <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg">
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Active Run</p>
          <p className="text-xl font-bold text-indigo-400 mt-2.5">{metrics?.activeCount ?? 0}</p>
        </div>
        <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg">
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Done</p>
          <p className="text-xl font-bold text-emerald-400 mt-2.5">{metrics?.completedCount ?? 0}</p>
        </div>
        <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg">
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Failed</p>
          <p className="text-xl font-bold text-rose-500 mt-2.5">{metrics?.failedCount ?? 0}</p>
        </div>
      </div>

      {/* Recharts Timelines Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[10px]">
        
        {/* Throughput Area chart */}
        <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg">
          <h3 className="font-bold text-white text-[11px] mb-4 uppercase tracking-wider">Throughput Completions (Completed/Min)</h3>
          <div className="h-52 w-full text-zinc-500">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#27272a" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#27272a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#18181b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" stroke="#3f3f46" fontSize={8} tickLine={false} />
                <YAxis stroke="#3f3f46" fontSize={8} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#18181b', borderRadius: '4px' }}
                  labelStyle={{ color: '#fff', fontSize: '9px', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#a1a1aa', fontSize: '10px' }}
                />
                <Area type="monotone" dataKey="throughput" stroke="#a1a1aa" strokeWidth={1.5} fillOpacity={1} fill="url(#throughputGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency Bar chart */}
        <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg">
          <h3 className="font-bold text-white text-[11px] mb-4 uppercase tracking-wider">Worker Processing Duration Delay (ms)</h3>
          <div className="h-52 w-full text-zinc-500">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <CartesianGrid stroke="#18181b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" stroke="#3f3f46" fontSize={8} tickLine={false} />
                <YAxis stroke="#3f3f46" fontSize={8} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#18181b', borderRadius: '4px' }}
                  labelStyle={{ color: '#fff', fontSize: '9px', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#a1a1aa', fontSize: '10px' }}
                />
                <Bar dataKey="latency" fill="#3f3f46" radius={[2, 2, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Failed Jobs Table */}
      <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg">
        <div className="border-b border-zinc-900 pb-3 mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-xs font-mono uppercase tracking-tight">Active Failure Registry</h3>
            <p className="text-[10px] text-zinc-500 font-mono">Job exceptions awaiting exponential retry backoff intervals</p>
          </div>
          <span className="bg-rose-950/20 px-2 py-0.5 rounded border border-rose-900/30 text-[9px] text-rose-400 font-mono font-bold">
            {failedJobs.length} Failed
          </span>
        </div>

        <div className="overflow-x-auto text-[10px] font-mono">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider text-[9px]">
                <th className="pb-2">Job ID</th>
                <th className="pb-2">Job Action</th>
                <th className="pb-2">State</th>
                <th className="pb-2">Attempts</th>
                <th className="pb-2">Failure Reason</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {failedJobs.map((job) => (
                <tr key={job.id} className="border-b border-zinc-900/40 last:border-0 hover:bg-zinc-900/10">
                  <td className="py-3 font-bold text-zinc-300 select-all">{job.id}</td>
                  <td className="py-3 font-semibold text-white">{job.name}</td>
                  <td className="py-3">
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border text-rose-400 bg-rose-950/20 border-rose-900/30 uppercase">
                      {job.status}
                    </span>
                  </td>
                  <td className="py-3 text-zinc-400">{job.attemptsMade} / {job.maxAttempts}</td>
                  <td className="py-3 text-zinc-300 font-mono max-w-xs truncate">{job.failedReason || 'Connection blip'}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => replayJob(job.id)}
                      disabled={replayLoading === job.id}
                      className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 text-[9px] font-bold transition-all disabled:opacity-50"
                    >
                      {replayLoading === job.id ? 'replaying...' : 'replay now'}
                    </button>
                  </td>
                </tr>
              ))}

              {failedJobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-650 font-bold">
                    No failed job states registered inside Redis indices.
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
