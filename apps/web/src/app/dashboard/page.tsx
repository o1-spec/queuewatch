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
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DashboardOverview() {
  const { authFetch, projects, projectsLoaded, createProject, activeProjectId, activeProject, fetchProjects } = useAuth();
  const router = useRouter();
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
  const [loadingData, setLoadingData] = useState(true);
  const [copiedText, setCopiedText] = useState<'npm' | 'js' | null>(null);

  const copyTextToClipboard = (text: string) => {
    if (typeof window === 'undefined') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch((err) => {
        console.error('Failed to copy text: ', err);
        fallbackCopyText(text);
      });
    } else {
      fallbackCopyText(text);
    }
  };

  const fallbackCopyText = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed: ', err);
    }
    document.body.removeChild(textArea);
  };

  const handleCopy = (text: string, type: 'npm' | 'js') => {
    copyTextToClipboard(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

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

  // Run on project switch
  useEffect(() => {
    if (activeProjectId) {
      setLoadingData(true);
      Promise.all([loadData(), loadAiReport()]).finally(() => {
        setLoadingData(false);
      });
    } else {
      setLoadingData(false);
    }
  }, [activeProjectId]);

  // Polling loop for active connection when telemetry is pending
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const hasTelemetry = metrics.length > 0 || workers.length > 0 || incidents.length > 0;
    if (activeProjectId && !hasTelemetry && !loadingData) {
      interval = setInterval(() => {
        loadData();
        fetchProjects();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeProjectId, metrics.length, workers.length, incidents.length, loadingData]);

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

  if (!projectsLoaded || loadingData) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4 font-sans text-zinc-400">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        <span className="text-xs uppercase tracking-widest font-semibold text-zinc-500">Loading Telemetry Project Data...</span>
      </div>
    );
  }

  // 1. Onboarding Screen if 0 projects exist
  if (projects.length === 0) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center font-sans text-zinc-300 px-4">
        <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-3 text-center relative font-sans">
            <div className="w-12 h-12 rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-center mx-auto mb-3 text-zinc-350">
              <Activity className="w-6 h-6 text-zinc-400 animate-pulse" />
            </div>
            <h1 className="text-white text-xl font-bold tracking-tight">
              Welcome to QueueWatch
            </h1>
            <p className="text-zinc-400 leading-relaxed text-sm">
              Create a project to begin monitoring asynchronous systems, investigate incidents, and improve operational reliability.
            </p>
          </div>

          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              if (!projectName.trim()) return;
              try {
                setCreating(true);
                setError('');
                const project = await createProject(projectName.trim());
                if (project) {
                  router.push('/sdk');
                }
              } catch (err: any) {
                setError(err.message || 'Failed to create project');
              } finally {
                setCreating(false);
              }
            }}
            className="space-y-4 relative font-sans"
          >
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-medium block">Project Name</label>
              <input
                autoFocus
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Production Web Service"
                className="w-full bg-zinc-900/40 border border-zinc-900 rounded-md px-3.5 py-2.5 focus:outline-none focus:border-zinc-700 text-sm text-white placeholder-zinc-650 transition-colors"
                disabled={creating}
              />
            </div>

            {error && (
              <div className="text-rose-400 text-xs bg-rose-950/10 border border-rose-900/30 p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="flex flex-col space-y-3 pt-2">
              <button
                type="submit"
                disabled={creating || !projectName.trim()}
                className="w-full py-2.5 rounded-md bg-white hover:bg-zinc-100 text-black font-semibold transition-all disabled:opacity-50 flex items-center justify-center space-x-2 text-sm"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Creating Project...</span>
                  </>
                ) : (
                  <span>Create Project</span>
                )}
              </button>
              
              <a
                href="https://docs.queuewatch.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-350 border border-zinc-800 text-center font-semibold transition-all text-sm block"
              >
                Read Documentation
              </a>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const hasTelemetry =
    activeProjectId === 'proj_demo' ||
    (activeProject && activeProject.hasReceivedTelemetry === true);

  // 2. SDK Connection Pending wait screen if project exists but has no telemetry
  if (!hasTelemetry) {
    const activeApiKey = activeProject?.apiKey || 'qw_pk_demo_key';
    const activeProjectIdVal = activeProject?.id || 'proj_demo';
    const installCommand = 'pnpm add @queuewatch/node';
    const envExample = `QUEUEWATCH_PROJECT_ID=${activeProjectIdVal}
QUEUEWATCH_API_KEY=${activeApiKey}
QUEUEWATCH_ENDPOINT=http://localhost:3001`;

    const initCode = `monitorQueue(emailQueue, {
  apiKey: process.env.QUEUEWATCH_API_KEY,
  projectId: process.env.QUEUEWATCH_PROJECT_ID,
  endpoint: process.env.QUEUEWATCH_ENDPOINT,
  queueName: "email_notifications",
});`;

    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center font-sans text-zinc-300 px-4">
        <div className="w-full max-w-xl bg-zinc-950 border border-zinc-900 rounded-xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-3 text-center relative border-b border-zinc-900 pb-5">
            <div className="flex items-center justify-center space-x-2.5 bg-zinc-900/60 border border-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider mx-auto w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span>Waiting for telemetry</span>
            </div>
            <h1 className="text-white text-xl font-bold tracking-tight mt-2.5">
              Connect your application
            </h1>
            <p className="text-zinc-400 leading-relaxed text-sm max-w-md mx-auto">
              QueueWatch has not received telemetry for this project yet. Please integrate the SDK to unlock the dashboard.
            </p>
          </div>

          <div className="space-y-5 relative">
            {/* Checklist */}
            <div className="space-y-3 bg-zinc-900/20 border border-zinc-900/50 p-4 rounded-lg">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">SDK Setup Checklist</h3>
              <ul className="space-y-2.5 text-zinc-400 text-xs font-sans">
                <li className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-950 border border-indigo-850 text-indigo-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Copy your Project ID and API Key into your environment variables.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-950 border border-indigo-850 text-indigo-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Install the QueueWatch Node SDK in your application.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-950 border border-indigo-850 text-indigo-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Call <code>monitorQueue()</code> to instrument your BullMQ queue instances.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-950 border border-indigo-850 text-indigo-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <span>Trigger a job or worker activity to transmit the first telemetry event.</span>
                </li>
              </ul>
            </div>

            {/* Step 1: Install */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white font-mono uppercase tracking-wide">1. Install command</span>
              </div>
              <div className="flex items-center justify-between bg-black/60 border border-zinc-900 rounded-md p-3 font-mono text-xs text-zinc-300">
                <span className="select-all">{installCommand}</span>
                <button 
                  onClick={() => handleCopy(installCommand, 'npm')}
                  className="text-zinc-500 hover:text-white transition-colors"
                  title="Copy"
                >
                  {copiedText === 'npm' ? (
                    <span className="text-[10px] font-sans font-medium text-emerald-400">Copied!</span>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Step 2: Env */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white font-mono uppercase tracking-wide">2. Environment configuration</span>
                <button 
                  onClick={() => handleCopy(envExample, 'js')}
                  className="text-zinc-500 hover:text-white text-[10px] font-sans flex items-center space-x-1"
                >
                  {copiedText === 'js' ? (
                    <span className="text-emerald-400 font-medium">Copied!</span>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      <span>Copy Config</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-black/60 border border-zinc-900 rounded-md p-4 font-mono text-xs text-zinc-350 overflow-x-auto leading-normal">
                {envExample}
              </pre>
            </div>

            {/* Step 3: Example Code */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-white font-mono uppercase tracking-wide">3. Initialization snippet</span>
              <pre className="bg-black/60 border border-zinc-900 rounded-md p-4 font-mono text-xs text-zinc-350 overflow-x-auto leading-normal">
                {initCode}
              </pre>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => handleCopy(activeApiKey, 'npm')}
                className="flex-1 py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-850 text-white font-semibold text-xs border border-zinc-800 transition-all flex items-center justify-center space-x-2"
              >
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>Copy API Key</span>
              </button>
              
              <Link
                href="/sdk"
                className="flex-1 py-2.5 rounded-md bg-white hover:bg-zinc-100 text-black font-semibold text-xs text-center transition-all block"
              >
                View setup guide
              </Link>
            </div>

            {/* Waiting Status */}
            <div className="flex items-center justify-center space-x-2.5 pt-4 border-t border-zinc-900/60">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] text-zinc-500 font-medium tracking-wide">Waiting for ingestion status...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const workersHealthyCount = workers.filter((w) => w.status === 'healthy').length;
  const workersTotalCount = workers.length || 1;
  const workerHealthScore = Math.round((workersHealthyCount / workersTotalCount) * 100);

  return (
    <div className="space-y-6 font-sans text-sm text-zinc-300">
      
      {/* 1. Metrics Grid (Reliability, Incidents, Risks, Services) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Reliability Score"
          value={activeIncidents.length === 0 ? '100%' : `${Math.max(60, 100 - activeIncidents.length * 15)}%`}
          subtext={activeIncidents.length === 0 ? 'Optimal operational reliability' : 'Degraded reliability signals'}
          icon={CheckCircle2}
          iconColor={activeIncidents.length === 0 ? 'text-emerald-400' : 'text-rose-500'}
          pulseActive={activeIncidents.length > 0}
          pulseColor="bg-rose-500"
        />

        <MetricCard
          title="Active Incidents"
          value={activeIncidents.length}
          subtext="Current open alerts"
          icon={AlertTriangle}
          iconColor={activeIncidents.length > 0 ? 'text-rose-500' : 'text-zinc-500'}
          pulseActive={activeIncidents.length > 0}
          pulseColor="bg-rose-500"
        />

        <MetricCard
          title="Predicted Risks"
          value={recurringCount}
          subtext="Anticipated system bottlenecks"
          icon={Activity}
          iconColor={recurringCount > 0 ? 'text-amber-500' : 'text-zinc-550'}
          pulseActive={recurringCount > 0}
          pulseColor="bg-amber-500"
        />

        <MetricCard
          title="Affected Services"
          value={metrics.length}
          subtext="Connected background processes"
          icon={Server}
          iconColor="text-zinc-400"
        />
      </div>

      {/* 2. Copilot Insights (AI Diagnostic Panel) */}
      <AIInsightPanel 
        report={aiReport} 
        loading={aiLoading} 
      />

      {/* 3. Active Incidents (Details card list if any exist) */}
      {activeIncidents.length > 0 && (
        <div className="bg-rose-950/10 border border-rose-900/40 rounded-lg p-6 space-y-4">
          <div className="flex items-center space-x-2.5 pb-2.5 border-b border-rose-900/20">
            <AlertTriangle className="w-5 h-5 text-rose-455 animate-pulse" />
            <h2 className="font-semibold text-white text-base">Active Operational Incidents ({activeIncidents.length})</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeIncidents.map((inc) => (
              <div key={inc.id} className="bg-zinc-900/30 border border-rose-905/40 p-5 rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium text-[10px] uppercase">
                      {inc.severity}
                    </span>
                    <h3 className="font-bold text-white text-base mt-2">{inc.title}</h3>
                    <p className="text-zinc-550 text-xs mt-1">Affected queue: <span className="text-zinc-300 font-semibold">{inc.affectedQueue}</span></p>
                  </div>
                </div>

                <div className="space-y-2 text-zinc-405 leading-relaxed text-sm">
                  <p><strong>Impact:</strong> {inc.impact}</p>
                  <p><strong>Suspected Cause:</strong> {inc.suspectedRootCause}</p>
                </div>

                {inc.recommendation && (
                  <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-md text-zinc-300 text-xs flex items-start space-x-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[10px] uppercase tracking-wider text-indigo-400 block mb-0.5 font-semibold">Remediation Action</strong>
                      {inc.recommendation}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 & 5. Queue Health and Connected Workers Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue Health */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-3">
              <div>
                <h3 className="font-semibold text-white text-base tracking-tight">Queue Health</h3>
                <p className="text-xs text-zinc-400 font-sans">Active queues and worker execution telemetry</p>
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
                <div className="col-span-2 text-center py-10 text-zinc-500 font-sans text-xs">
                  Loading queue telemetry metrics...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Connected Workers */}
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-3">
              <div>
                <h3 className="font-semibold text-white text-base tracking-tight">Connected Workers</h3>
                <p className="text-xs text-zinc-400 font-sans">Redis consumer client connections</p>
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-medium">
                {workerHealthScore}% healthy
              </span>
            </div>

            <div className="space-y-3">
              {workers.map((worker) => (
                <WorkerCard key={worker.workerId} worker={worker} />
              ))}

              {workers.length === 0 && (
                <div className="text-center py-6 text-xs text-zinc-550 font-sans">
                  Waiting for worker heartbeat tokens...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Logs (Live Event Activity Feed) */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6">
        <ActivityFeed events={liveEvents} />
      </div>

    </div>
  );
}
