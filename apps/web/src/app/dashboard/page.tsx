'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import { QueueMetrics, WorkerHealth, QueueName } from '@queuewatch/shared';
import { CheckCircle2, Activity, Skull, Clock } from 'lucide-react';
import { MetricCard } from '../../components/MetricCard';
import { QueueCard } from '../../components/QueueCard';
import { WorkerCard } from '../../components/WorkerCard';
import { ActivityFeed, LiveEvent } from '../../components/ActivityFeed';
import { AIInsightPanel, AIAnalysisReport } from '../../components/AIInsightPanel';

import { useAuth } from '../../context/AuthContext';

interface DashboardStats {
  totalProcessed: number;
  activeJobs: number;
  failedJobs: number;
  averageLatency: number;
  dlqCount: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DashboardOverview() {
  const { authFetch } = useAuth();
  const [metrics, setMetrics] = useState<QueueMetrics[]>([]);
  const [workers, setWorkers] = useState<WorkerHealth[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [deadLettersCount, setDeadLettersCount] = useState(0);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  
  const [aiReport, setAiReport] = useState<AIAnalysisReport | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  const loadData = async () => {
    try {
      const [queuesRes, dlqRes] = await Promise.all([
        authFetch(`${API_URL}/api/queues`),
        authFetch(`${API_URL}/api/queues/dead_letter_queue/jobs`),
      ]);
      
      if (queuesRes.ok) {
        const queuesData = await queuesRes.json();
        const mapped: QueueMetrics[] = queuesData.map((q: any) => ({
          queueName: q.name,
          waitingCount: q.waiting,
          activeCount: q.active,
          completedCount: q.completed,
          failedCount: q.failed,
          delayedCount: q.delayed,
          paused: q.paused,
          throughput: q.completed > 0 ? Math.round(q.completed / 2) : 0,
          averageLatency: q.name === 'ai_task_queue' ? 1800 : 450,
          timestamp: Date.now(),
        }));
        setMetrics(mapped);
      }

      if (dlqRes.ok) {
        const dlqData = await dlqRes.json();
        setDeadLettersCount(dlqData.length);
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
    loadData();
    loadAiReport();
  }, []);

  const socketListeners = {
    'queue.metrics.updated': (data: QueueMetrics[]) => {
      setMetrics(data);
    },
    'worker.health.updated': (data: WorkerHealth[]) => {
      setWorkers(data);
      loadAiReport();
    },
    'job.created': (data: any) => {
      pushLiveEvent(data.queueName, 'Created', `Job ${data.jobId} enqueued inside Redis`);
    },
    'job.active': (data: any) => {
      pushLiveEvent(data.queueName, 'Active', `Worker started processing job ${data.jobId}`);
    },
    'job.completed': (data: any) => {
      pushLiveEvent(data.queueName, 'Completed', `Job ${data.jobId} successfully finished in ${data.latency}ms`);
    },
    'job.failed': (data: any) => {
      pushLiveEvent(data.queueName, 'Retrying', `Job ${data.jobId} failed (${data.attemptsMade}/${data.maxAttempts}): ${data.errorMessage}`);
      loadAiReport();
    },
    'job.deadlettered': (data: any) => {
      pushLiveEvent(data.queueName, 'DLQ', `Job ${data.jobId} permanently failed! Routed to Dead-Letter Queue.`);
      setDeadLettersCount((prev) => prev + 1);
      loadAiReport();
    },
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

  const stats: DashboardStats = metrics.reduce(
    (acc, q) => {
      acc.totalProcessed += q.completedCount;
      acc.activeJobs += q.activeCount;
      acc.failedJobs += q.failedCount;
      acc.averageLatency += q.averageLatency;
      return acc;
    },
    { totalProcessed: 0, activeJobs: 0, failedJobs: 0, averageLatency: 0, dlqCount: 0 }
  );

  const totalQueues = metrics.length || 1;
  const runningAverageLatency = Math.round(stats.averageLatency / totalQueues) || 0;

  const workersHealthyCount = workers.filter((w) => w.status === 'healthy').length;
  const workersTotalCount = workers.length || 1;
  const workerHealthScore = Math.round((workersHealthyCount / workersTotalCount) * 100);

  return (
    <div className="space-y-5">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Jobs Processed"
          value={stats.totalProcessed.toLocaleString()}
          subtext="realtime completions streaming"
          icon={CheckCircle2}
          iconColor="text-emerald-400"
          pulseActive={true}
          pulseColor="bg-emerald-400"
        />

        <MetricCard
          title="Active Thread Count"
          value={stats.activeJobs}
          subtext="concurrency thread threads active"
          icon={Activity}
          iconColor="text-blue-400"
          pulseActive={stats.activeJobs > 0}
          pulseColor="bg-blue-500"
        />

        <MetricCard
          title="Dead Letter Queue"
          value={deadLettersCount}
          subtext="requires engineering action"
          icon={Skull}
          iconColor="text-rose-500"
          pulseActive={deadLettersCount > 0}
          pulseColor="bg-rose-500"
        />

        <MetricCard
          title="Average Job Latency"
          value={`${runningAverageLatency} ms`}
          subtext="worker process delay duration"
          icon={Clock}
          iconColor="text-zinc-400"
        />
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
              <a href="/queues" className="text-[10px] font-bold font-mono text-zinc-400 hover:text-white transition-colors flex items-center space-x-1">
                <span>configure indices</span>
                <span>&rarr;</span>
              </a>
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
