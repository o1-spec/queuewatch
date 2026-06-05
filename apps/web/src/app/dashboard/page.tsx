'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import Link from 'next/link';
import { QueueMetrics, WorkerHealth, QueueName, Incident } from '@queuewatch/shared';
import { CheckCircle2, Activity, Skull, Clock, AlertTriangle, Play, Sparkles, Server, GitCommit, BellRing, Loader2 } from 'lucide-react';
import { MetricCard } from '../../components/MetricCard';
import { QueueCard } from '../../components/QueueCard';
import { WorkerCard } from '../../components/WorkerCard';
import { ActivityFeed, LiveEvent } from '../../components/ActivityFeed';
import { AIInsightPanel, AIAnalysisReport } from '../../components/AIInsightPanel';

import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DashboardOverview() {
  const { authFetch, projects, projectsLoaded, createProject, activeProjectId } = useAuth();
  const [projectName, setProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState<QueueMetrics[]>([]);
  const [workers, setWorkers] = useState<WorkerHealth[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [deadLettersCount, setDeadLettersCount] = useState(0);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  // V4 states for Reliability Insights Widget
  const [recurringCount, setRecurringCount] = useState(0);
  const [deploymentsCount, setDeploymentsCount] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);
  
  const [aiReport, setAiReport] = useState<AIAnalysisReport | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  const loadData = async () => {
    try {
      const [queuesRes, dlqRes, incidentsRes, workersRes, recurringRes, deploymentsRes, notificationsRes] = await Promise.all([
        authFetch(`${API_URL}/api/queues`),
        authFetch(`${API_URL}/api/queues/dead_letter_queue/jobs`),
        authFetch(`${API_URL}/api/incidents`),
        authFetch(`${API_URL}/api/workers`),
        authFetch(`${API_URL}/api/copilot/recurring-incidents`),
        authFetch(`${API_URL}/api/deployments`),
        authFetch(`${API_URL}/api/notifications`),
      ]);
      
      if (queuesRes.ok) {
        const queuesData = await queuesRes.json();
        setMetrics(queuesData.map((q: any) => ({
          queueName: q.name,
          waitingCount: q.waiting,
          activeCount: q.active,
          completedCount: q.completed,
          failedCount: q.failed,
          delayedCount: q.delayed,
          paused: q.paused,
          throughput: q.completed > 0 ? Math.round(q.completed / 2) : 0,
          averageLatency: 450,
          timestamp: Date.now(),
        })));
      }

      if (dlqRes.ok) {
        const dlqData = await dlqRes.json();
        setDeadLettersCount(dlqData.length);
      }

      if (incidentsRes.ok) {
        const incidentsData = await incidentsRes.json();
        setIncidents(incidentsData);
      }

      if (workersRes.ok) {
        const workersData = await workersRes.json();
        setWorkers(workersData);
      }

      if (recurringRes && recurringRes.ok) {
        const data = await recurringRes.json();
        setRecurringCount(data.length || 0);
      }

      if (deploymentsRes && deploymentsRes.ok) {
        const data = await deploymentsRes.json();
        setDeploymentsCount(data.length || 0);
      }

      if (notificationsRes && notificationsRes.ok) {
        const data = await notificationsRes.json();
        setNotificationsCount(data.length || 0);
      }
    } catch (err) {
      console.error('Failed to load initial REST telemetry:', err);
    }
  };

  const loadAiReport = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/ai/analyze`);
      if (res.ok) {
        const data = await res.json();
        setAiReport(data);
      }
    } catch (e) {
      console.error('Failed to trigger AI diagnostic audit:', e);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (activeProjectId) {
      loadData();
      loadAiReport();
    }
  }, [activeProjectId]);

  const socketListeners = {
    'metrics.updated': (data: QueueMetrics[]) => {
      setMetrics(data);
    },
    'worker.health.updated': (data: WorkerHealth[]) => {
      setWorkers(data);
      loadAiReport();
    },
    'incident.created': (data: Incident) => {
      setIncidents((prev) => [data, ...prev.filter(i => i.id !== data.id)]);
      pushLiveEvent(data.affectedQueue, 'DLQ', `NEW INCIDENT: ${data.title}`);
    },
    'incident.updated': (data: Incident) => {
      setIncidents((prev) => prev.map(i => i.id === data.id ? data : i));
    },
    'telemetry.event': (data: any) => {
      if (data.type === 'job.created') {
        pushLiveEvent(data.queueName, 'Created', `Job ${data.jobId} enqueued inside Redis`);
      } else if (data.type === 'job.active') {
        pushLiveEvent(data.queueName, 'Active', `Worker started processing job ${data.jobId}`);
      } else if (data.type === 'job.completed') {
        pushLiveEvent(data.queueName, 'Completed', `Job ${data.jobId} successfully finished in ${data.duration}ms`);
      } else if (data.type === 'job.failed') {
        pushLiveEvent(data.queueName, 'Retrying', `Job ${data.jobId} failed (${data.attemptsMade}/${data.maxAttempts}): ${data.errorMessage}`);
      } else if (data.type === 'job.deadlettered') {
        pushLiveEvent(data.queueName, 'DLQ', `Job ${data.jobId} permanently failed! Routed to Dead-Letter Queue.`);
        setDeadLettersCount((prev) => prev + 1);
        loadAiReport();
      }
    }
  };

  useSocket(socketListeners);

  const pushLiveEvent = (queue: QueueName, status: string, message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLiveEvents((prev) => [
      { id: `${Date.now()}_${Math.random()}`, queue, status, message, timestamp },
      ...prev,
    ].slice(0, 15));
  };

  const togglePause = async (name: string, isCurrentlyPaused: boolean) => {
    setToggleLoading(name);
    const action = isCurrentlyPaused ? 'resume' : 'pause';
    try {
      const res = await authFetch(`${API_URL}/api/queues/${name}/${action}`, {
        method: 'POST',
      });
      if (res.ok) {
        setMetrics((prev) =>
          prev.map((q) => (q.queueName === name ? { ...q, paused: !isCurrentlyPaused } : q))
        );
        pushLiveEvent(
          name as QueueName,
          isCurrentlyPaused ? 'Active' : 'Paused',
          `Queue worker channel "${name}" has been ${isCurrentlyPaused ? 'resumed' : 'paused'} by user.`
        );
        loadAiReport();
      }
    } catch (e) {
      console.error(`Failed to ${action} queue:`, e);
    } finally {
      setToggleLoading(null);
    }
  };

  // Aggregated Stats
  const activeIncidents = incidents.filter(i => i.status === 'open');
  const failureRates = metrics.map(q => (q as any).failureRate || 0);
  const maxFailureRate = failureRates.length > 0 ? Math.max(...failureRates) : 0;

  const retryRates = metrics.map(q => (q as any).retryRate || 0);
  const maxRetryRate = retryRates.length > 0 ? Math.max(...retryRates) : 0;

  const backlogGrowths = metrics.map(q => (q as any).backlogGrowth || 0);
  const maxBacklogGrowth = backlogGrowths.length > 0 ? Math.max(...backlogGrowths) : 0;

  const averageLatencies = metrics.map(q => q.averageLatency || 0);
  const runningAverageLatency = averageLatencies.length > 0
    ? Math.round(averageLatencies.reduce((a, b) => a + b, 0) / averageLatencies.length)
    : 0;

  if (!projectsLoaded) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4 font-mono">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Loading Telemetry Projects...</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center font-mono text-zinc-350">
        <div className="w-full max-w-md bg-zinc-950/80 border border-zinc-900 rounded-lg p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
          {/* Subtle neon glow */}
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-zinc-800/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-zinc-850/10 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-2.5 text-center relative">
            <div className="w-10 h-10 rounded border border-zinc-850 bg-zinc-900 flex items-center justify-center mx-auto mb-2 text-zinc-400">
              <Activity className="w-5 h-5 animate-pulse text-zinc-500" />
            </div>
            <h1 className="text-white text-[13px] font-bold uppercase tracking-wider">
              Welcome to QueueWatch SRE Console
            </h1>
            <p className="text-zinc-400 font-sans leading-relaxed text-[11px]">
              To begin observing your background workers and BullMQ queues, create your first project.
            </p>
          </div>

          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              if (!projectName.trim()) return;
              try {
                setCreating(true);
                setError('');
                await createProject(projectName.trim());
              } catch (err: any) {
                setError(err.message || 'Failed to create project');
              } finally {
                setCreating(false);
              }
            }}
            className="space-y-4 relative"
          >
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold block font-mono">Project Name</label>
              <input
                autoFocus
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Production Web Service"
                className="w-full bg-zinc-900/40 border border-zinc-900 rounded px-3 py-2 focus:outline-none focus:border-zinc-700 text-[11px] text-white placeholder-zinc-750 font-mono transition-colors"
                disabled={creating}
              />
            </div>

            {error && (
              <div className="text-rose-500 text-[10px] bg-rose-950/10 border border-rose-950 p-2.5 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={creating || !projectName.trim()}
              className="w-full py-2.5 rounded bg-zinc-900 hover:bg-zinc-850 text-white font-bold transition-all border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 flex items-center justify-center space-x-2 text-[11px] uppercase tracking-wider"
            >
              {creating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Project</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const workersHealthyCount = workers.filter((w) => w.status === 'healthy').length;
  const workersTotalCount = workers.length || 1;
  const workerHealthScore = Math.round((workersHealthyCount / workersTotalCount) * 100);

  return (
    <div className="space-y-5 font-mono text-[10px]">
      
      {/* 1. INCIDENT-FIRST EMERGENCY OVERVIEW */}
      {activeIncidents.length > 0 && (
        <div className="bg-red-950/15 border border-rose-950 rounded-lg p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-rose-950 pb-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
            <h2 className="font-extrabold text-white text-xs uppercase tracking-wider">Active System Incidents ({activeIncidents.length})</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeIncidents.map((inc) => (
              <div key={inc.id} className="bg-black/40 border border-rose-950/40 p-4 rounded space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-rose-950/50 text-rose-400 border border-rose-900/60 font-bold uppercase tracking-wider text-[8px]">
                      {inc.severity}
                    </span>
                    <h3 className="font-extrabold text-white text-sm mt-1">{inc.title}</h3>
                    <p className="text-zinc-500 text-[9px] mt-0.5">Affected channel: <span className="text-zinc-300 font-bold">{inc.affectedQueue}</span></p>
                  </div>
                </div>

                <div className="space-y-1.5 text-zinc-400 leading-relaxed font-sans text-xs">
                  <p><strong>Impact:</strong> {inc.impact}</p>
                  <p><strong>Suspected Cause:</strong> {inc.suspectedRootCause}</p>
                </div>

                {inc.recommendation && (
                  <div className="p-2.5 bg-indigo-950/20 border border-indigo-950 rounded text-zinc-300 font-sans leading-normal text-[11px] flex items-start space-x-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-mono text-[9px] uppercase tracking-wider text-indigo-400 block mb-0.5">Remediation Action</strong>
                      {inc.recommendation}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Console Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="System Health Score"
          value={activeIncidents.length === 0 ? '100%' : `${100 - activeIncidents.length * 25}%`}
          subtext={activeIncidents.length === 0 ? 'all subsystems reporting normal' : 'elevated incident rates'}
          icon={CheckCircle2}
          iconColor={activeIncidents.length === 0 ? 'text-emerald-400' : 'text-rose-500'}
          pulseActive={activeIncidents.length > 0}
          pulseColor="bg-rose-500"
        />

        <MetricCard
          title="Max Queue Failure Rate"
          value={`${maxFailureRate}%`}
          subtext="rolling execution failures"
          icon={Skull}
          iconColor="text-rose-500"
          pulseActive={maxFailureRate > 15}
          pulseColor="bg-rose-500"
        />

        <MetricCard
          title="Max Backlog Growth"
          value={`+${maxBacklogGrowth} jobs`}
          subtext="waiting queue accumulation"
          icon={Activity}
          iconColor="text-blue-400"
          pulseActive={maxBacklogGrowth > 10}
          pulseColor="bg-blue-500"
        />

        <MetricCard
          title="Average Latency"
          value={`${runningAverageLatency} ms`}
          subtext="average worker execution delay"
          icon={Clock}
          iconColor="text-zinc-400"
        />
      </div>

      {/* Reliability Insights Widget */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <div>
            <h3 className="font-bold text-xs font-mono text-white tracking-tight uppercase flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Reliability Insights & Signal Correlation</span>
            </h3>
            <p className="text-[10px] text-zinc-555 font-mono">Cross-signal correlation timelines and chronic failure patterns</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/deployments" className="bg-zinc-905 border border-zinc-900 p-4 rounded hover:border-zinc-800 transition-all flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-zinc-555 uppercase text-[9px] font-bold block">Active Deployments</span>
              <span className="text-xl font-bold text-white">{deploymentsCount} releases</span>
            </div>
            <GitCommit className="w-6 h-6 text-indigo-400 shrink-0" />
          </Link>

          <Link href="/recurring-incidents" className="bg-zinc-905 border border-zinc-900 p-4 rounded hover:border-zinc-800 transition-all flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-zinc-555 uppercase text-[9px] font-bold block">Recurring failure spikes</span>
              <span className="text-xl font-bold text-white">{recurringCount} signature groups</span>
            </div>
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
          </Link>

          <Link href="/notifications" className="bg-zinc-905 border border-zinc-900 p-4 rounded hover:border-zinc-800 transition-all flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-zinc-555 uppercase text-[9px] font-bold block">Memory & SLA Alerts</span>
              <span className="text-xl font-bold text-white">{notificationsCount} dispatched</span>
            </div>
            <BellRing className="w-6 h-6 text-rose-450 shrink-0" />
          </Link>
        </div>
      </div>

      {/* Main Dual Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-3">
              <div>
                <h3 className="font-bold text-xs font-mono text-white tracking-tight uppercase">Active Queue Telemetry Indices</h3>
                <p className="text-[10px] text-zinc-500 font-mono">Telemetry indices enqueued in Redis memory pools</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics.map((queueMetrics) => {
                const mappedQueue = {
                  name: queueMetrics.queueName,
                  waiting: queueMetrics.waitingCount,
                  active: queueMetrics.activeCount,
                  completed: queueMetrics.completedCount,
                  failed: queueMetrics.failedCount,
                  delayed: queueMetrics.delayedCount,
                  paused: queueMetrics.paused,
                };
                return (
                  <QueueCard
                    key={queueMetrics.queueName}
                    queue={mappedQueue}
                    metrics={queueMetrics}
                    onTogglePause={togglePause}
                    toggleLoading={toggleLoading}
                  />
                );
              })}

              {metrics.length === 0 && (
                <div className="col-span-2 text-center py-10 text-zinc-600 font-mono text-[10px]">
                  loading telemetry queue metrics...
                </div>
              )}
            </div>
          </div>

          <AIInsightPanel 
            report={aiReport} 
            loading={aiLoading} 
          />
        </div>

        {/* Right Side: Workers & Console Activity Feed */}
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-3">
              <div>
                <h3 className="font-bold text-white text-xs font-mono uppercase tracking-tight">Connected Workers</h3>
                <p className="text-[10px] text-zinc-500 font-mono">Redis consumer client connections</p>
              </div>
              <div className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-[9px] text-white font-bold font-mono">
                {workerHealthScore}% healthy
              </div>
            </div>

            <div className="space-y-3">
              {workers.map((worker) => (
                <WorkerCard key={worker.workerId} worker={worker} />
              ))}

              {workers.length === 0 && (
                <div className="text-center py-6 text-[10px] text-zinc-600 font-mono">
                  waiting for worker heartbeat tokens...
                </div>
              )}
            </div>
          </div>

          <ActivityFeed events={liveEvents} />
        </div>

      </div>
    </div>
  );
}
