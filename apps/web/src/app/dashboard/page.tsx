'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import Link from 'next/link';
import { QueueMetrics, WorkerHealth, QueueName, Incident } from '@queuewatch/shared';
import { CheckCircle2, Activity, Skull, Clock, AlertTriangle, Play, Sparkles, Server, GitCommit, BellRing, Loader2, Check, Copy, ArrowRight, Circle, X, Layers, Terminal } from 'lucide-react';
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

  // Onboarding & Celebration Flow States
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [wasWaiting, setWasWaiting] = useState(false);

  // High-Fidelity SRE Onboarding & Discovery states
  const [onboardingDismissed, setOnboardingDismissed] = useState(true);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState(0);
  const [systemDiscovered, setSystemDiscovered] = useState(false);
  const [fastTracked, setFastTracked] = useState(false);
  const [firstTelemetryTime, setFirstTelemetryTime] = useState<number | null>(null);
  const [baselineEventsCount, setBaselineEventsCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [services, setServices] = useState<any[]>([]);
  const [lastTelemetryTime, setLastTelemetryTime] = useState<number | null>(null);

  // SRE Queue Inspector Modal State
  const [selectedQueueForInspector, setSelectedQueueForInspector] = useState<string | null>(null);
  const [inspectorJobs, setInspectorJobs] = useState<any[]>([]);
  const [inspectorLoadingJobs, setInspectorLoadingJobs] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'jobs' | 'errors'>('jobs');

  useEffect(() => {
    if (selectedQueueForInspector) {
      const loadInspectorJobs = async () => {
        try {
          setInspectorLoadingJobs(true);
          const res = await authFetch(`${API_URL}/api/queues/${selectedQueueForInspector}/jobs?limit=50`);
          if (res.ok) {
            setInspectorJobs(await res.json());
          }
        } catch (e) {
          console.error('Failed to load SRE queue inspector jobs:', e);
        } finally {
          setInspectorLoadingJobs(false);
        }
      };
      loadInspectorJobs();
      const interval = setInterval(loadInspectorJobs, 3000);
      return () => clearInterval(interval);
    } else {
      setInspectorJobs([]);
    }
  }, [selectedQueueForInspector, authFetch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedQueueForInspector(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      const [queuesRes, dlqRes, incidentsRes, workersRes, recurringRes, deploymentsRes, notificationsRes, servicesRes] = await Promise.all([
        authFetch(`${API_URL}/api/queues`),
        authFetch(`${API_URL}/api/queues/dead_letter_queue/jobs`),
        authFetch(`${API_URL}/api/incidents`),
        authFetch(`${API_URL}/api/workers`),
        authFetch(`${API_URL}/api/copilot/recurring-incidents`),
        authFetch(`${API_URL}/api/deployments`),
        authFetch(`${API_URL}/api/notifications`),
        authFetch(`${API_URL}/api/services`),
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

      if (servicesRes && servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(data);
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
    const hasTelemetry =
      activeProjectId === 'proj_demo' ||
      (activeProject && activeProject.hasReceivedTelemetry === true);

    if (activeProjectId && !hasTelemetry && !loadingData) {
      interval = setInterval(() => {
        loadData();
        fetchProjects();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeProjectId, activeProject?.hasReceivedTelemetry, loadingData]);

  // Load local storage states on project switch
  useEffect(() => {
    if (activeProjectId) {
      if (typeof window !== 'undefined') {
        const dismissed = localStorage.getItem(`onboarding_dismissed_${activeProjectId}`) === 'true';
        setOnboardingDismissed(dismissed);
        
        const ft = localStorage.getItem(`fast_tracked_${activeProjectId}`) === 'true';
        setFastTracked(ft);

        const firstTimeStr = localStorage.getItem(`first_telemetry_${activeProjectId}`);
        if (firstTimeStr) {
          const t = parseInt(firstTimeStr, 10);
          setFirstTelemetryTime(t);
          setElapsedSeconds(Math.floor((Date.now() - t) / 1000));
        } else {
          setFirstTelemetryTime(null);
          setElapsedSeconds(0);
        }

        const storedCount = localStorage.getItem(`telemetry_count_${activeProjectId}`);
        setBaselineEventsCount(storedCount ? parseInt(storedCount, 10) : 0);

        const lastTimeStr = localStorage.getItem(`last_telemetry_${activeProjectId}`);
        if (lastTimeStr) {
          setLastTelemetryTime(parseInt(lastTimeStr, 10));
        } else {
          setLastTelemetryTime(null);
        }
      }
      setIsDiscovering(false);
      setDiscoveryProgress(0);
      setSystemDiscovered(false);
    }
  }, [activeProjectId]);

  // Track telemetry status change to trigger discovery
  useEffect(() => {
    if (!loadingData && activeProjectId && activeProjectId !== 'proj_demo') {
      const hasTelemetry = activeProject && activeProject.hasReceivedTelemetry === true;
      if (!hasTelemetry) {
        setWasWaiting(true);
      } else if (hasTelemetry) {
        // Save first telemetry timestamp if not present
        if (typeof window !== 'undefined') {
          const storedTime = localStorage.getItem(`first_telemetry_${activeProjectId}`);
          if (!storedTime) {
            const nowStr = Date.now().toString();
            localStorage.setItem(`first_telemetry_${activeProjectId}`, nowStr);
            setFirstTelemetryTime(Date.now());
            localStorage.setItem(`telemetry_count_${activeProjectId}`, '0');
            setBaselineEventsCount(0);
            localStorage.setItem(`last_telemetry_${activeProjectId}`, nowStr);
            setLastTelemetryTime(Date.now());
          }
        }

        // Trigger discovery if not dismissed and not already completed
        const dismissed = typeof window !== 'undefined' && localStorage.getItem(`onboarding_dismissed_${activeProjectId}`) === 'true';
        if (!dismissed && !isDiscovering && !systemDiscovered) {
          setIsDiscovering(true);
          setDiscoveryProgress(0);
        }
      }
    }
  }, [activeProject?.hasReceivedTelemetry, loadingData, activeProjectId, isDiscovering, systemDiscovered]);

  // Manage discovery step timers
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isDiscovering) {
      interval = setInterval(() => {
        setDiscoveryProgress((prev) => {
          if (prev >= 6) {
            clearInterval(interval);
            setIsDiscovering(false);
            setSystemDiscovered(true);
            return 6;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDiscovering]);

  // Keep track of elapsed baseline seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (firstTelemetryTime && !fastTracked && baselineEventsCount < 15) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - firstTelemetryTime) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [firstTelemetryTime, fastTracked, baselineEventsCount]);

  const socketListeners = {
    'metrics.updated': (data: QueueMetrics[]) => {
      setMetrics(data);
    },
    'worker.health.updated': (data: WorkerHealth[]) => {
      const match = data.find((w: any) => w.projectId === activeProjectId);
      if (match) {
        fetchProjects();
        loadData();
      }
      setWorkers(data);
      loadAiReport();
    },
    'incident.created': (data: Incident) => {
      if ((data as any).projectId === activeProjectId) {
        fetchProjects();
        loadData();
      }
      setIncidents((prev) => [data, ...prev.filter(i => i.id !== data.id)]);
      pushLiveEvent(data.affectedQueue, 'DLQ', `NEW INCIDENT: ${data.title}`);
    },
    'incident.updated': (data: Incident) => {
      setIncidents((prev) => prev.map(i => i.id === data.id ? data : i));
    },
    'telemetry.event': (data: any) => {
      if (data.projectId === activeProjectId) {
        fetchProjects();
        loadData();

        // Immediate enqueued jobs list refresh inside open SRE Queue Inspector
        if (selectedQueueForInspector && data.queueName === selectedQueueForInspector) {
          authFetch(`${API_URL}/api/queues/${selectedQueueForInspector}/jobs?limit=50`)
            .then((res) => {
              if (res.ok) res.json().then(setInspectorJobs);
            })
            .catch(() => {});
        }

        // Increment baseline events count
        setBaselineEventsCount((prev) => {
          const nextVal = prev + 1;
          if (typeof window !== 'undefined') {
            localStorage.setItem(`telemetry_count_${activeProjectId}`, nextVal.toString());
            localStorage.setItem(`last_telemetry_${activeProjectId}`, Date.now().toString());
          }
          setLastTelemetryTime(Date.now());
          return nextVal;
        });
      }
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

  const handleFastTrack = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`fast_tracked_${activeProjectId}`, 'true');
        localStorage.setItem(`telemetry_count_${activeProjectId}`, '15');
        if (!localStorage.getItem(`first_telemetry_${activeProjectId}`)) {
          localStorage.setItem(`first_telemetry_${activeProjectId}`, Date.now().toString());
        }
      }
      
      setFastTracked(true);
      setBaselineEventsCount(15);
      
      setAiLoading(true);
      await Promise.all([loadData(), loadAiReport()]);
    } catch (err) {
      console.error('Fast-track failed:', err);
    }
  };

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
        <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-3 text-center relative font-sans">
            <div className="w-12 h-12 rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-center mx-auto mb-3 text-zinc-300">
              <Activity className="w-6 h-6 text-indigo-400 animate-pulse" />
            </div>
            <h1 className="text-white text-2xl font-bold tracking-tight font-sans">
              Welcome to QueueWatch
            </h1>
            <p className="text-zinc-405 leading-relaxed text-sm max-w-sm mx-auto font-sans">
              Let&apos;s connect your first system. Live dashboard updates require an active project connection.
            </p>
          </div>

          {/* Progress Tracker */}
          <div className="bg-zinc-900/30 border border-zinc-900/50 p-5 rounded-lg space-y-4 font-sans max-w-md mx-auto w-full">
            <h3 className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest font-mono">Progress</h3>
            <div className="space-y-3.5">
              <div className="flex items-center space-x-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-zinc-500 line-through">Create Account</span>
              </div>
              <div className="flex items-center space-x-3 text-sm font-semibold text-white">
                <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
                <span>Create Project</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-zinc-600">
                <Circle className="w-4 h-4 shrink-0" />
                <span>Install SDK</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-zinc-600">
                <Circle className="w-4 h-4 shrink-0" />
                <span>Connect Application</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-zinc-600">
                <Circle className="w-4 h-4 shrink-0" />
                <span>Receive Telemetry</span>
              </div>
            </div>
          </div>

          <div className="max-w-md mx-auto pt-2 w-full">
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full py-3 rounded-md bg-white hover:bg-zinc-100 text-black font-semibold transition-all flex items-center justify-center space-x-2 text-sm shadow-lg shadow-white/5"
              >
                <span>Create First Project</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!projectName.trim()) return;
                  try {
                    setCreating(true);
                    setError('');
                    const project = await createProject(projectName.trim());
                    if (project) {
                      router.push('/dashboard');
                    }
                  } catch (err: any) {
                    setError(err.message || 'Failed to create project');
                  } finally {
                    setCreating(false);
                  }
                }}
                className="space-y-4 relative font-sans text-left"
              >
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Project Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. ShopFlow Production"
                    className="w-full bg-zinc-900/60 border border-zinc-900 rounded-md px-3.5 py-2.5 focus:outline-none focus:border-zinc-700 text-sm text-white placeholder-zinc-650 transition-colors"
                    disabled={creating}
                  />
                </div>

                {error && (
                  <div className="text-rose-455 text-xs bg-rose-950/10 border border-rose-900/30 p-3 rounded-md">
                    {error}
                  </div>
                )}

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-850 font-semibold transition-all text-sm"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !projectName.trim()}
                    className="flex-1 py-2.5 rounded-md bg-white hover:bg-zinc-100 text-black font-semibold transition-all disabled:opacity-50 flex items-center justify-center space-x-2 text-sm"
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
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Discovery Screen when telemetry is first received but not yet completed
  if (isDiscovering) {
    const queueNames = metrics.map(q => q.queueName).join(', ') || 'Scanning...';
    const workerCount = workers.length;
    const projName = activeProject?.name || 'payment-service';

    return (
      <div className="min-h-[80vh] flex items-center justify-center font-sans text-zinc-350 px-4 py-8">
        <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-900 rounded-xl shadow-2xl overflow-hidden relative">
          {/* Terminal Title Bar */}
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-950 flex items-center justify-between">
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-rose-500/80 animate-pulse" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80 animate-pulse" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80 animate-pulse" />
            </div>
            <span className="text-[11px] font-mono text-zinc-500 tracking-wider">queuewatch-agent@host:~</span>
            <div className="w-12" />
          </div>

          {/* Terminal Content */}
          <div className="p-6 font-mono text-xs leading-relaxed space-y-3.5 bg-black/90 min-h-[320px] relative">
            <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
              <Activity className="w-48 h-48 text-indigo-500 animate-pulse" />
            </div>

            <div className="flex items-center space-x-2 text-indigo-400">
              <span className="text-zinc-650 font-bold font-sans">$</span>
              <span>queuewatch-cli discover --project-id={activeProjectId}</span>
            </div>

            <div className="text-zinc-450 border-b border-zinc-900 pb-2 flex items-center justify-between">
              <span>Discovering Infrastructure...</span>
              <span className="animate-pulse px-2 py-0.5 text-[10px] rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold uppercase font-mono">
                SCANNING ACTIVE
              </span>
            </div>

            <div className="space-y-2.5 pt-1.5 text-zinc-350">
              {discoveryProgress >= 0 && (
                <div className="flex items-center space-x-2.5">
                  {discoveryProgress > 0 ? (
                    <span className="text-emerald-400 font-bold">✔</span>
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                  )}
                  <span className={discoveryProgress > 0 ? "text-zinc-200" : "text-zinc-400 font-medium animate-pulse"}>
                    SDK Connected <span className="text-zinc-600 text-[10px]">(protocol: WebSocket secure)</span>
                  </span>
                </div>
              )}

              {discoveryProgress >= 1 && (
                <div className="flex items-center space-x-2.5">
                  {discoveryProgress > 1 ? (
                    <span className="text-emerald-400 font-bold">✔</span>
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                  )}
                  <span className={discoveryProgress > 1 ? "text-zinc-200" : "text-zinc-400 font-medium animate-pulse"}>
                    Service Registered: <span className="text-indigo-400 font-bold">{projName}</span>
                  </span>
                </div>
              )}

              {discoveryProgress >= 2 && (
                <div className="flex items-start space-x-2.5">
                  {discoveryProgress > 2 ? (
                    <span className="text-emerald-400 font-bold mt-0.5">✔</span>
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0 mt-0.5" />
                  )}
                  <span className={discoveryProgress > 2 ? "text-zinc-200" : "text-zinc-400 font-medium animate-pulse"}>
                    Queues Discovered: <span className="text-zinc-400">{queueNames}</span>
                  </span>
                </div>
              )}

              {discoveryProgress >= 3 && (
                <div className="flex items-center space-x-2.5">
                  {discoveryProgress > 3 ? (
                    <span className="text-emerald-400 font-bold">✔</span>
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                  )}
                  <span className={discoveryProgress > 3 ? "text-zinc-200" : "text-zinc-400 font-medium animate-pulse"}>
                    Workers Detected: <span className="text-indigo-400">{workerCount} active client instances</span>
                  </span>
                </div>
              )}

              {discoveryProgress >= 4 && (
                <div className="flex items-center space-x-2.5">
                  {discoveryProgress > 4 ? (
                    <span className="text-emerald-400 font-bold">✔</span>
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                  )}
                  <span className={discoveryProgress > 4 ? "text-zinc-200" : "text-zinc-400 font-medium animate-pulse"}>
                    Initial Health Analysis: <span className="text-emerald-400">Optimal (100% healthy worker heartbeats)</span>
                  </span>
                </div>
              )}

              {discoveryProgress >= 5 && (
                <div className="flex items-center space-x-2.5">
                  {discoveryProgress > 5 ? (
                    <span className="text-emerald-400 font-bold">✔</span>
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                  )}
                  <span className={discoveryProgress > 5 ? "text-zinc-200" : "text-zinc-400 font-medium animate-pulse"}>
                    Generating operational baseline & risk models...
                  </span>
                </div>
              )}

              {discoveryProgress >= 6 && (
                <div className="pt-2 text-indigo-400 flex items-center space-x-2 animate-bounce">
                  <span>► Discovery Complete. Ready to map dashboard.</span>
                  <span className="w-1.5 h-3.5 bg-indigo-400 animate-blink inline-block" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Summary Screen before unlocking
  if (systemDiscovered) {
    const queueCount = metrics.length;
    const workerCount = workers.length;
    const incidentCount = incidents.filter(i => i.status === 'open').length;
    const projName = activeProject?.name || 'payment-service';

    const handleDismissOnboarding = () => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`onboarding_dismissed_${activeProjectId}`, 'true');
        setOnboardingDismissed(true);
      }
      setSystemDiscovered(false);
    };

    return (
      <div className="min-h-[80vh] flex items-center justify-center font-sans text-zinc-350 px-4 py-8">
        <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-2xl p-8 space-y-6 shadow-2xl relative overflow-hidden text-center">
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex items-center justify-center w-16 h-16 mx-auto bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400">
            <Check className="w-8 h-8" />
          </div>

          <div className="space-y-2.5">
            <h1 className="text-white text-2xl font-bold tracking-tight">
              System Discovered Successfully
            </h1>
            <p className="text-zinc-450 text-xs font-mono uppercase tracking-wider font-semibold">
              QueueWatch SRE Analysis Complete
            </p>
          </div>

          {/* Checklist report */}
          <div className="bg-zinc-900/30 border border-zinc-900 p-6 rounded-xl text-left space-y-4 font-sans max-w-sm mx-auto w-full">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono border-b border-zinc-800 pb-2.5 flex items-center justify-between">
              <span>Discovered Metrics Report</span>
              <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold uppercase">Active</span>
            </h3>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-450 font-medium">Services Mapped</span>
                <span className="font-mono text-white font-bold">{services.length || 1} ({projName})</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-450 font-medium">Active Queues</span>
                <span className="font-mono text-white font-bold">{queueCount} Found</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-450 font-medium">Workers Registered</span>
                <span className="font-mono text-white font-bold">{workerCount} Online</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-450 font-medium">Initial Health</span>
                <span className="font-mono text-emerald-400 font-bold">{incidentCount === 0 ? 'No incidents detected' : `${incidentCount} Active`}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2.5 border-t border-zinc-900">
                <span className="text-zinc-350 font-bold">Baseline Mapping</span>
                <span className="font-mono text-amber-500 font-bold">In progress</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleDismissOnboarding}
              className="w-full max-w-sm mx-auto py-3 rounded-lg bg-indigo-650 hover:bg-indigo-600 text-white font-semibold transition-all flex items-center justify-center space-x-2 text-sm shadow-lg shadow-indigo-655/15"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasTelemetry =
    activeProjectId === 'proj_demo' ||
    (activeProject && activeProject.hasReceivedTelemetry === true);

  // 3. SDK Connection Pending wait screen if project exists but has no telemetry
  if (!hasTelemetry) {
    const activeApiKey = activeProject?.apiKey || 'qw_pk_demo_key';
    const activeProjectIdVal = activeProject?.id || 'proj_demo';
    const activeEndpoint = API_URL;
    const installCommand = 'npm install @queuewatch/node';
    const envExample = `QUEUEWATCH_PROJECT_ID=${activeProjectIdVal}
QUEUEWATCH_API_KEY=${activeApiKey}
QUEUEWATCH_ENDPOINT=${activeEndpoint}`;

    const initCode = `const queuewatch = new QueueWatch({
  projectId: process.env.QUEUEWATCH_PROJECT_ID,
  apiKey: process.env.QUEUEWATCH_API_KEY,
});

queuewatch.monitorQueue(emailQueue);`;

    return (
      <div className="min-h-[80vh] flex flex-col justify-center font-sans text-zinc-300 px-2 lg:px-4 py-8 animate-fade-in">
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Setup Instructions Column */}
          <div className="lg:col-span-7 bg-zinc-950 border border-zinc-900 rounded-xl p-6 lg:p-8 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="border-b border-zinc-900 pb-5">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium text-[10px] uppercase tracking-wider">
                Project Created Successfully
              </span>
              <h1 className="text-white text-2xl font-bold tracking-tight mt-3">
                Let&apos;s connect your application
              </h1>
              <p className="text-zinc-400 leading-relaxed text-sm mt-1 max-w-lg">
                Follow these simple steps to integrate the QueueWatch SDK and unlock live telemetry diagnostics.
              </p>
            </div>

            <div className="space-y-5">
              {/* Step 1: Install */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">1. Install the SDK</span>
                </div>
                <div className="flex items-center justify-between bg-black/60 border border-zinc-900 rounded-md p-3.5 font-mono text-xs text-zinc-300">
                  <span className="select-all">{installCommand}</span>
                  <button 
                    onClick={() => handleCopy(installCommand, 'npm')}
                    className="text-zinc-500 hover:text-white transition-colors"
                    title="Copy"
                  >
                    {copiedText === 'npm' ? (
                      <span className="text-[10px] font-sans font-medium text-emerald-400 flex items-center space-x-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Step 2: Config variables */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">2. Environment configuration</span>
                  <button 
                    onClick={() => handleCopy(envExample, 'js')}
                    className="text-zinc-500 hover:text-white text-xs font-sans flex items-center space-x-1.5"
                  >
                    {copiedText === 'js' ? (
                      <span className="text-emerald-400 font-medium flex items-center space-x-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </span>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Environment Block</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-black/60 border border-zinc-900 rounded-md p-4 font-mono text-xs text-zinc-350 overflow-x-auto leading-normal">
                  {envExample}
                </pre>
              </div>

              {/* Step 3: Initialization Snippet */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">3. Initialize SDK Constructor</span>
                </div>
                <pre className="bg-black/60 border border-zinc-900 rounded-md p-4 font-mono text-xs text-zinc-350 overflow-x-auto leading-normal">
                  {initCode}
                </pre>
              </div>
            </div>
          </div>

          {/* Right Status / Dashboard Lock Column */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Checklist */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono border-b border-zinc-900 pb-2">Onboarding Checklist</h3>
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-zinc-500 line-through">Create Account</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-zinc-500 line-through">Create Project</span>
                </div>
                <div className="flex items-center space-x-2.5 font-semibold text-white">
                  <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
                  <span>Install SDK</span>
                </div>
                <div className="flex items-center space-x-2.5 text-zinc-650">
                  <Circle className="w-4 h-4 shrink-0" />
                  <span>Connect Application</span>
                </div>
                <div className="flex items-center space-x-2.5 text-zinc-655">
                  <Circle className="w-4 h-4 shrink-0" />
                  <span>Receive Telemetry</span>
                </div>
              </div>
            </div>

            {/* Locked Live Status Monitor */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 shadow-xl space-y-6 relative overflow-hidden">
              <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="space-y-1 pb-4 border-b border-zinc-900">
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">Connection Status</span>
                </div>
                <h3 className="text-sm font-semibold text-zinc-400 mt-1">No telemetry detected yet</h3>
              </div>

              {/* Locked stats counters */}
              <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                <div className="bg-zinc-900/20 border border-zinc-900 p-3 rounded-lg">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono block">Last connection</span>
                  <span className="text-zinc-400 font-semibold font-mono mt-0.5 block">Never</span>
                </div>
                <div className="bg-zinc-900/20 border border-zinc-900 p-3 rounded-lg">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono block">Queues Discovered</span>
                  <span className="text-zinc-400 font-semibold font-mono mt-0.5 block">0</span>
                </div>
                <div className="bg-zinc-900/20 border border-zinc-900 p-3 rounded-lg">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono block">Workers Discovered</span>
                  <span className="text-zinc-400 font-semibold font-mono mt-0.5 block">0</span>
                </div>
                <div className="bg-zinc-900/20 border border-zinc-900 p-3 rounded-lg">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono block">Services Discovered</span>
                  <span className="text-zinc-400 font-semibold font-mono mt-0.5 block">0</span>
                </div>
              </div>

              {/* Pulsing Radar Animation */}
              <div className="bg-black/40 border border-zinc-900/60 rounded-lg p-6 text-center space-y-4">
                <div className="relative flex items-center justify-center w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" />
                  <div className="absolute inset-3 rounded-full bg-indigo-500/20 animate-pulse" />
                  <div className="relative w-10 h-10 rounded-full bg-zinc-900 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white">Waiting for QueueWatch SDK connection...</p>
                  <p className="text-[10px] text-zinc-550 font-mono">Listening on port 3001/ingest...</p>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    );
  }

  const workersHealthyCount = workers.filter((w) => w.status === 'healthy').length;
  const workersTotalCount = workers.length || 1;
  const workerHealthScore = Math.round((workersHealthyCount / workersTotalCount) * 100);
  const elapsedSecondsVal = elapsedSeconds;
  const isLearning = activeProjectId !== 'proj_demo' && !fastTracked && (baselineEventsCount < 15 && elapsedSecondsVal < 300);

  const lastTelemetrySeconds = lastTelemetryTime ? Math.floor((Date.now() - lastTelemetryTime) / 1000) : null;
  const lastTelemetryText = lastTelemetrySeconds === null 
    ? 'Never' 
    : (lastTelemetrySeconds < 5 
      ? 'Just now' 
      : (lastTelemetrySeconds < 60 
        ? `${lastTelemetrySeconds}s ago` 
        : `${Math.floor(lastTelemetrySeconds / 60)}m ago`));

  return (
    <div className="space-y-6 font-sans text-sm text-zinc-300">
      
      {/* 1. Metrics Grid (Reliability, Incidents, Risks, Services) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Reliability Score"
          value={isLearning ? 'Learning...' : (activeIncidents.length === 0 ? '92%' : `${Math.max(60, 92 - activeIncidents.length * 15)}%`)}
          subtext={isLearning ? 'Collecting operational parameters' : (activeIncidents.length === 0 ? 'Optimal operational reliability' : 'Degraded reliability signals')}
          icon={CheckCircle2}
          iconColor={isLearning ? 'text-indigo-400' : (activeIncidents.length === 0 ? 'text-emerald-400' : 'text-rose-500')}
          pulseActive={!isLearning && activeIncidents.length > 0}
          pulseColor="bg-rose-500"
        />

        <MetricCard
          title="Active Incidents"
          value={activeIncidents.length === 0 ? 'No incidents detected' : activeIncidents.length}
          subtext={activeIncidents.length === 0 ? 'Optimal service status' : 'Current open alerts'}
          icon={AlertTriangle}
          iconColor={activeIncidents.length > 0 ? 'text-rose-500' : 'text-emerald-400'}
          pulseActive={activeIncidents.length > 0}
          pulseColor="bg-rose-500"
        />

        <MetricCard
          title="Predicted Risks"
          value={isLearning ? 'Calculating...' : recurringCount}
          subtext={isLearning ? 'Building risk-factor matrix' : 'Anticipated system bottlenecks'}
          icon={Activity}
          iconColor={isLearning ? 'text-zinc-550' : (recurringCount > 0 ? 'text-amber-500' : 'text-zinc-555')}
          pulseActive={!isLearning && recurringCount > 0}
          pulseColor="bg-amber-500"
        />

        <MetricCard
          title={isLearning ? 'Affected Services' : 'Connected Services'}
          value={isLearning ? 'Discovering...' : services.length}
          subtext={isLearning ? 'Mapping SRE endpoints' : 'Active microservice boundaries'}
          icon={Server}
          iconColor={isLearning ? 'text-zinc-550' : 'text-zinc-400'}
        />
      </div>

      {/* 2. Copilot Insights or Learning Baseline Card */}
      {isLearning ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-900 pb-5 mb-5 space-y-4 md:space-y-0">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <h3 className="font-bold text-white text-base tracking-tight font-sans">
                  Learning Your System
                </h3>
              </div>
              <p className="text-xs text-zinc-400">
                Baseline Progress: <span className="text-white font-mono font-semibold">{baselineEventsCount}/15 events</span>
                {firstTelemetryTime && (
                  <span className="text-zinc-600 ml-2">
                    (First event received {elapsedSecondsVal}s ago)
                  </span>
                )}
              </p>
            </div>
            
            <button
              onClick={handleFastTrack}
              className="px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-805 text-zinc-300 border border-zinc-800 text-xs font-semibold tracking-wider font-mono transition-all flex items-center space-x-2 hover:border-zinc-700"
            >
              <span>Fast-Track Baseline (Developer Skip)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-zinc-405 text-sm leading-relaxed">
                QueueWatch is analyzing and mapping your background processing pipeline. Reliability insights, anomaly detection, predictive risk alerts, and automated copilot diagnoses will unlock dynamically once the operational baseline is established.
              </p>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-zinc-500 uppercase">
                  <span>Profiling pipeline signature</span>
                  <span>{Math.round((baselineEventsCount / 15) * 100)}%</span>
                </div>
                <div className="w-full bg-zinc-905 border border-zinc-900 h-2 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-500 ease-out" 
                    style={{ width: `${(baselineEventsCount / 15) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-black/40 border border-zinc-900 rounded-lg p-4 space-y-3 font-mono text-xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block border-b border-zinc-900 pb-2">Active Monitors</span>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">✓ Hosts and Workers</span>
                  <span className="text-emerald-400 font-semibold">LISTENING</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">✓ Redis Queue Memory</span>
                  <span className="text-emerald-400 font-semibold">PROFILING</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">✓ Job Throughput Logs</span>
                  <span className="text-emerald-400 font-semibold">SAMPLING</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeProjectId !== 'proj_demo' ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-900 pb-5 mb-5 space-y-4 md:space-y-0">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                <h3 className="font-bold text-white text-base tracking-tight font-sans">
                  Reliability Engine
                </h3>
              </div>
              <p className="text-xs text-zinc-400 font-sans">
                Continuous SRE performance profiling & failure modeling
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block font-mono">Reliability Score</span>
                <span className="font-mono text-emerald-450 font-bold text-xl">92%</span>
              </div>
              <div className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                +3% this week
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Insights & Recommendations */}
            <div className="lg:col-span-7 space-y-5">
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block font-mono">Copilot Insights</span>
                <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg space-y-3 text-sm">
                  <div className="flex items-start space-x-2.5">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
                    <p className="text-zinc-350 leading-relaxed">
                      Most job execution failures originate from <code className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-900 text-indigo-400 font-mono text-xs">payment_queue</code> due to high rate-limit conditions on external APIs.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-zinc-500 pt-1.5 border-t border-zinc-900">
                    <span>Average processing latency: <strong className="text-zinc-300 font-mono">1.8s</strong></span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block font-mono">Recommendation</span>
                <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-lg flex items-start space-x-3 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <strong className="text-[10px] uppercase tracking-wider text-indigo-400 block mb-0.5 font-bold">Action Item</strong>
                    <p className="text-zinc-350 text-xs">
                      Increase worker concurrency from <span className="font-bold text-white font-mono">5 → 10</span> threads in payment-service client to clear the backlog faster and prevent queue starvation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* SRE Timeline */}
            <div className="lg:col-span-5 space-y-2.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block font-mono">Reliability Timeline</span>
              <div className="bg-black/40 border border-zinc-900 rounded-lg p-4 font-mono text-xs space-y-4 relative min-h-[160px]">
                <div className="absolute top-4 bottom-4 left-6 border-l border-zinc-900" />
                
                <div className="flex items-start space-x-4 relative">
                  <div className="w-4 h-4 rounded-full bg-zinc-950 border-2 border-emerald-500 shrink-0 flex items-center justify-center z-10 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-zinc-500 text-[10px] font-semibold">12:01</span>
                    <p className="text-zinc-300 font-bold">Queue Connected</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 relative">
                  <div className="w-4 h-4 rounded-full bg-zinc-950 border-2 border-emerald-500 shrink-0 flex items-center justify-center z-10 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-zinc-500 text-[10px] font-semibold">12:03</span>
                    <p className="text-zinc-300 font-bold">Worker Registered</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 relative">
                  <div className="w-4 h-4 rounded-full bg-zinc-950 border-2 border-rose-500 shrink-0 flex items-center justify-center z-10 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-zinc-500 text-[10px] font-semibold">12:07</span>
                    <p className="text-rose-455 font-bold">First Job Failure</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 relative">
                  <div className="w-4 h-4 rounded-full bg-zinc-950 border-2 border-amber-500 shrink-0 flex items-center justify-center z-10 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-zinc-500 text-[10px] font-semibold">12:10</span>
                    <p className="text-amber-500 font-bold">Retry Spike Detected</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <AIInsightPanel 
          report={aiReport} 
          loading={aiLoading} 
        />
      )}

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
        {/* Queue Health and Services Discovered Tree */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Services Discovered Panel */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-3">
              <div>
                <h3 className="font-semibold text-white text-base tracking-tight flex items-center space-x-2">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span>Services Discovery Ledger</span>
                </h3>
                <p className="text-xs text-zinc-400 font-sans">Microservices dynamically discovered from SDK telemetry mapping</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-[10px] text-zinc-400">
              {services.map((svc) => {
                const serviceQueues = svc.queues || [];
                const serviceWorkers = svc.workers || [];
                const serviceErrors = serviceQueues.reduce((sum: number, qName: string) => {
                  const qMetric = metrics.find(m => m.queueName === qName);
                  return sum + (qMetric ? qMetric.failedCount : 0);
                }, 0);

                return (
                  <div key={svc.id} className="p-4 bg-zinc-900/10 border border-zinc-900/80 rounded-lg space-y-3 relative hover:border-zinc-800 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <strong className="text-white text-[11px] uppercase tracking-wide">{svc.name}</strong>
                      </div>
                      <span className="text-[8px] bg-zinc-900 border border-zinc-850 px-1.5 py-0.2 rounded text-zinc-450 uppercase">{svc.environment}</span>
                    </div>

                    <div className="pl-1 space-y-1 text-zinc-550 font-mono text-[9.5px]">
                      <div>
                        <span>├─ Queues: </span>
                        <strong className="text-indigo-400 font-bold">{serviceQueues.length}</strong>
                      </div>
                      <div>
                        <span>├─ Workers: </span>
                        <strong className="text-zinc-350 font-bold">{serviceWorkers.length}</strong>
                      </div>
                      <div>
                        <span>└─ Errors: </span>
                        <strong className={`font-bold ${serviceErrors > 0 ? 'text-rose-500 animate-pulse' : 'text-zinc-650'}`}>
                          {serviceErrors}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}

              {services.length === 0 && (
                <div className="col-span-full py-8 text-center text-zinc-600 font-bold animate-pulse">
                  Waiting for SDK telemetry to map services architecture...
                </div>
              )}
            </div>
          </div>

          {/* Queue Health */}
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
                    onInspect={(name) => setSelectedQueueForInspector(name)}
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

        {/* Connected Workers and System Discovery Card */}
        <div className="space-y-6">
          {/* Connected Workers */}
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

          {/* System Discovery Card */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6 relative overflow-hidden">
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-3">
              <div>
                <h3 className="font-semibold text-white text-base tracking-tight font-sans">System Discovery</h3>
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider font-semibold">Mapped Resources</p>
              </div>
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full text-xs font-semibold font-mono">
                v1.4.2
              </span>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Services Mapped</span>
                <span className="text-white font-mono font-bold">{services.length || 1}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Active Queues</span>
                <span className="text-white font-mono font-bold">{metrics.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Active Workers</span>
                <span className="text-white font-mono font-bold">{workers.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Environment</span>
                <span className="text-emerald-450 font-mono font-bold">{activeProjectId === 'proj_demo' ? 'Demo' : 'Production'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Last Telemetry</span>
                <span className="text-white font-mono font-bold">{lastTelemetryText}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-zinc-900">
                <span className="text-zinc-550 font-bold uppercase tracking-wider text-[10px] font-mono">Discovery Engine</span>
                <span className="text-zinc-400 font-semibold">AUTOMATIC</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Logs (Live Event Activity Feed) */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6">
        <ActivityFeed events={liveEvents} />
      </div>

      {/* SRE Queue Inspector Modal Overlay */}
      {selectedQueueForInspector && (() => {
        const qMetrics = metrics.find(m => m.queueName === selectedQueueForInspector);
        const qWorkers = workers.filter(w => w.queueName === selectedQueueForInspector);
        
        const waiting = qMetrics ? qMetrics.waitingCount : 0;
        const active = qMetrics ? qMetrics.activeCount : 0;
        const completed = qMetrics ? qMetrics.completedCount : 0;
        const failed = qMetrics ? qMetrics.failedCount : 0;
        const delayed = qMetrics ? qMetrics.delayedCount : 0;
        const throughput = qMetrics ? qMetrics.throughput : 0;
        const latency = qMetrics ? qMetrics.averageLatency : 0;

        const failedJobs = inspectorJobs.filter(j => j.status === 'failed');

        return (
          <>
            {/* Backdrop Blur */}
            <div 
              onClick={() => setSelectedQueueForInspector(null)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 transition-opacity duration-300 animate-fade-in"
            />

            {/* Sidebar Inspector Drawer */}
            <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-zinc-950 border-l border-zinc-900 shadow-2xl z-50 overflow-hidden flex flex-col font-sans text-xs text-zinc-300 animate-slide-left">
              
              {/* Header */}
              <div className="p-6 border-b border-zinc-900/60 flex items-center justify-between bg-zinc-950/80 sticky top-0 z-10 backdrop-blur-md">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h2 className="text-sm font-bold text-white uppercase font-mono tracking-tight">{selectedQueueForInspector}</h2>
                  </div>
                  <p className="text-[10px] text-zinc-550 font-mono uppercase tracking-wider">Queue Inspector telemetry profile</p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={async () => {
                      if (qMetrics) {
                        await togglePause(selectedQueueForInspector, qMetrics.paused);
                      }
                    }}
                    className={`px-3 py-1.5 rounded border text-[10px] font-bold uppercase transition-all ${
                      qMetrics?.paused 
                        ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40 hover:bg-emerald-950/30' 
                        : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    {qMetrics?.paused ? 'Resume Queue' : 'Pause Queue'}
                  </button>
                  <button
                    onClick={() => setSelectedQueueForInspector(null)}
                    className="p-1.5 rounded hover:bg-zinc-900 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 5-Column SRE Scorecard row */}
                <div className="grid grid-cols-5 gap-2.5 text-center font-mono">
                  <div className="bg-zinc-900/35 border border-zinc-900/80 px-2 py-3 rounded-lg">
                    <span className="text-[8.5px] text-zinc-500 uppercase tracking-widest font-bold block">Waiting</span>
                    <strong className="text-sm text-blue-400 font-bold block mt-1.5">{waiting}</strong>
                  </div>
                  <div className="bg-zinc-900/35 border border-zinc-900/80 px-2 py-3 rounded-lg">
                    <span className="text-[8.5px] text-zinc-500 uppercase tracking-widest font-bold block">Active</span>
                    <strong className="text-sm text-indigo-400 font-bold block mt-1.5">{active}</strong>
                  </div>
                  <div className="bg-zinc-900/35 border border-zinc-900/80 px-2 py-3 rounded-lg">
                    <span className="text-[8.5px] text-zinc-500 uppercase tracking-widest font-bold block">Completed</span>
                    <strong className="text-sm text-emerald-400 font-bold block mt-1.5">{completed}</strong>
                  </div>
                  <div className="bg-zinc-900/35 border border-zinc-900/80 px-2 py-3 rounded-lg">
                    <span className="text-[8.5px] text-zinc-500 uppercase tracking-widest font-bold block">Failed</span>
                    <strong className="text-sm text-rose-500 font-bold block mt-1.5">{failed}</strong>
                  </div>
                  <div className="bg-zinc-900/35 border border-zinc-900/80 px-2 py-3 rounded-lg">
                    <span className="text-[8.5px] text-zinc-500 uppercase tracking-widest font-bold block">Delayed</span>
                    <strong className="text-sm text-amber-500 font-bold block mt-1.5">{delayed}</strong>
                  </div>
                </div>

                {/* Performance Stats row */}
                <div className="grid grid-cols-2 gap-4 bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg text-xs font-mono">
                  <div className="flex items-center justify-between border-r border-zinc-900 pr-4">
                    <span className="text-zinc-500">THROUGHPUT:</span>
                    <strong className="text-white">{throughput} jobs / min</strong>
                  </div>
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-zinc-500">AVERAGE LATENCY:</span>
                    <strong className="text-white">{latency} ms</strong>
                  </div>
                </div>

                {/* Tab Controls */}
                <div className="flex border-b border-zinc-900">
                  <button
                    onClick={() => setInspectorTab('jobs')}
                    className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-all ${
                      inspectorTab === 'jobs' 
                        ? 'border-indigo-500 text-white' 
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Recent Jobs ({inspectorJobs.length})
                  </button>
                  <button
                    onClick={() => setInspectorTab('errors')}
                    className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-all ${
                      inspectorTab === 'errors' 
                        ? 'border-indigo-500 text-white' 
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Recent Errors ({failedJobs.length})
                  </button>
                </div>

                {/* Tab Content */}
                {inspectorLoadingJobs && inspectorJobs.length === 0 ? (
                  <div className="text-center py-12 text-zinc-650 font-bold animate-pulse font-mono">
                    Resolving enqueued indexes...
                  </div>
                ) : inspectorTab === 'jobs' ? (
                  /* Recent Jobs Table */
                  <div className="space-y-3">
                    <div className="overflow-x-auto border border-zinc-900 rounded-lg">
                      <table className="w-full text-left border-collapse font-mono text-[10px]">
                        <thead>
                          <tr className="bg-zinc-900/30 border-b border-zinc-900 text-zinc-550 font-bold uppercase text-[8.5px]">
                            <th className="p-3">Job ID</th>
                            <th className="p-3">Job Name</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Attempts</th>
                            <th className="p-3 text-right">Age</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectorJobs.map((job) => {
                            const ageMs = Date.now() - job.timestamp;
                            const ageText = ageMs < 5000 ? 'Just now' : `${Math.floor(ageMs / 1000)}s ago`;
                            
                            return (
                              <tr key={job.id} className="border-b border-zinc-900/40 last:border-0 hover:bg-zinc-900/10">
                                <td className="p-3 font-bold text-zinc-300 select-all">{job.id}</td>
                                <td className="p-3 text-white font-semibold">{job.name}</td>
                                <td className="p-3">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase ${
                                    job.status === 'completed' 
                                      ? 'bg-emerald-950/20 text-emerald-450 border-emerald-900/20' 
                                      : job.status === 'active'
                                        ? 'bg-indigo-950/20 text-indigo-400 border-indigo-900/20'
                                        : job.status === 'failed'
                                          ? 'bg-rose-950/20 text-rose-455 border-rose-900/20'
                                          : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                                  }`}>
                                    {job.status}
                                  </span>
                                </td>
                                <td className="p-3 text-zinc-400">{job.attemptsMade} / {job.maxAttempts}</td>
                                <td className="p-3 text-right text-zinc-500">{ageText}</td>
                              </tr>
                            );
                          })}

                          {inspectorJobs.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-zinc-650 font-bold">
                                No active job states enqueued in this queue.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* Recent Errors list with Stacktraces */
                  <div className="space-y-4">
                    {failedJobs.map((job) => (
                      <div key={job.id} className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                          <span className="font-mono text-zinc-400 font-bold uppercase">{job.id} - {job.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border bg-rose-950/20 text-rose-455 border-rose-900/20 uppercase">FAILED</span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block font-mono">Error Message</span>
                          <p className="text-rose-400 font-mono font-bold leading-normal p-2.5 bg-rose-950/5 border border-rose-950/25 rounded">
                            {job.failedReason || 'Stripe API Connection Timeout'}
                          </p>
                        </div>

                        {job.stackTrace && job.stackTrace.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block font-mono">Stacktrace</span>
                            <pre className="p-3 bg-black/45 border border-zinc-900 rounded text-[9.5px] font-mono overflow-x-auto text-zinc-500 max-h-40 leading-relaxed">
                              {job.stackTrace.join('\n')}
                            </pre>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block font-mono">Payload Audit</span>
                          <pre className="p-2.5 bg-zinc-900/20 border border-zinc-900 rounded text-[9px] font-mono text-zinc-400">
                            {JSON.stringify(job.data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))}

                    {failedJobs.length === 0 && (
                      <div className="text-center py-12 text-zinc-650 font-bold font-mono">
                        No recent exceptions logged inside Redis database indexing.
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="p-4 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between text-[10px] text-zinc-550 font-mono">
                <span>Auto-refreshing enqueued indices...</span>
                <span>ESC to dismiss</span>
              </div>
            </div>
          </>
        );
      })()}

    </div>
  );
}
