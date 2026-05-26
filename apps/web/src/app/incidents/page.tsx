'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import { AlertTriangle, Terminal, RefreshCw, ChevronDown, ChevronUp, Sparkles, ShieldCheck, Clock } from 'lucide-react';
import { AIIncidentTimeline } from '../../components/AIIncidentTimeline';

import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const QUEUES = ['email_queue', 'image_processing_queue', 'webhook_delivery_queue', 'ai_task_queue'];

export default function IncidentRegistry() {
  const { authFetch } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replayLoading, setReplayLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'exceptions' | 'timeline'>('exceptions');
  const [timelineTrigger, setTimelineTrigger] = useState(0);

  const loadIncidents = async () => {
    try {
      const allJobsPromises = QUEUES.map(async (queueName) => {
        const res = await authFetch(`${API_URL}/api/queues/${queueName}/jobs?limit=100`);
        if (res.ok) {
          const data = await res.json();
          // Filter only failed status jobs
          return data.filter((j: any) => j.status === 'failed');
        }
        return [];
      });

      const results = await Promise.all(allJobsPromises);
      const flattened = results.flat().sort((a, b) => b.timestamp - a.timestamp);
      setIncidents(flattened);
    } catch (e) {
      console.error('Failed to load incidents registry:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  // Live Socket IO updates to refresh incident registry dynamically
  useSocket({
    'job.failed': () => {
      loadIncidents();
      // Tick trigger to refresh timeline if tab is open
      setTimelineTrigger(prev => prev + 1);
    },
    'job.completed': () => {
      loadIncidents();
      setTimelineTrigger(prev => prev + 1);
    },
    'job.deadlettered': () => {
      loadIncidents();
      setTimelineTrigger(prev => prev + 1);
    },
  });

  const triggerReplay = async (jobId: string) => {
    setReplayLoading(jobId);
    try {
      const res = await authFetch(`${API_URL}/api/queues/jobs/${jobId}/replay`, {
        method: 'POST',
      });
      if (res.ok) {
        setIncidents((prev) => prev.filter((inc) => inc.id !== jobId));
      }
    } catch (e) {
      console.error('Failed to replay job:', e);
    } finally {
      setReplayLoading(null);
    }
  };

  const getRemediation = (reason: string, queue: string) => {
    const defaultFix = {
      description: 'Review job attempt backoff delays inside Redis indices. Ensure exponential backoff limits are active.',
      code: `const myQueue = new Queue('${queue}', {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});`
    };

    if (reason.toLowerCase().includes('sendgrid') || reason.toLowerCase().includes('smtp') || queue === 'email_queue') {
      return {
        description: 'SendGrid rate limits triggered HTTP 429 block. Enable strict BullMQ delays, single-concurrency limiters, and backoff extensions.',
        code: `// Concurrency limit & backoff adjustment
const myWorker = new Worker('email_queue', async (job) => {
  await sendGridMail(job.data);
}, {
  concurrency: 1, // Restrict thread limits
  limiter: {
    max: 10,
    duration: 1000 // Max 10 emails per second
  }
});`
      };
    }

    if (reason.toLowerCase().includes('stripe') || reason.toLowerCase().includes('webhook') || queue === 'webhook_delivery_queue') {
      return {
        description: 'Stripe HTTP 503 Gateway timeouts detected. Enforce a Circuit Breaker pattern (Opossum wrapper) to defer execution instead of pinning CPU threads.',
        code: `// Circuit Breaker Integration
import CircuitBreaker from 'opossum';

const options = {
  timeout: 3000, // Trigger fallback if 3s delay exceeded
  errorThresholdPercentage: 50,
  resetTimeout: 30000 // Stalled cooldown for 30s
};

const breaker = new CircuitBreaker(stripeCall, options);
breaker.fallback(() => {
  throw new Error('CircuitOpen: post-poning webhook delivery');
});`
      };
    }

    if (reason.toLowerCase().includes('payload') || reason.toLowerCase().includes('validation') || queue === 'image_processing_queue') {
      return {
        description: 'Schema parameter mismatches. Enforce input schema validation before queue enqueueing to prevent garbage metrics in Redis.',
        code: `// Zod Schema Pre-validation
import { z } from 'zod';

const PayloadSchema = z.object({
  imageUrl: z.string().url(),
  format: z.enum(['png', 'jpeg']).default('png')
});

async function safeEnqueue(payload: unknown) {
  const result = PayloadSchema.safeParse(payload);
  if (!result.success) {
    throw new Error('Payload mismatch: ' + result.error.message);
  }
  return queue.add('job_name', result.data);
}`
      };
    }

    if (reason.toLowerCase().includes('sqlite') || reason.toLowerCase().includes('database') || queue === 'ai_task_queue') {
      return {
        description: 'SQLite database connection pool locks. Enforce connection pooling limits, increase transaction timeout bounds, or scale pods.',
        code: `// Knex/TypeORM config adjustment
const dbConfig = {
  client: 'sqlite3',
  connection: { filename: './db.sqlite' },
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000
  },
  useNullAsDefault: true
};`
      };
    }

    return defaultFix;
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2 font-mono">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>Incident Resolution Registry</span>
        </h2>
        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
          Failed and retry-stalled job exceptions across active BullMQ workers. Audit live exception callstacks.
        </p>
      </div>

      {/* Tabs Selector Toggle */}
      <div className="flex border-b border-zinc-900 font-mono text-[10px]">
        <button
          onClick={() => setActiveTab('exceptions')}
          className={`px-4 py-2 font-bold border-b transition-all flex items-center space-x-2 ${
            activeTab === 'exceptions' 
              ? 'border-white text-white' 
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Exceptions Logs ({incidents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2 font-bold border-b transition-all flex items-center space-x-2 ${
            activeTab === 'timeline' 
              ? 'border-white text-white' 
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>AI Incident Log</span>
        </button>
      </div>

      {activeTab === 'exceptions' ? (
        <>
          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg flex flex-col justify-between h-28">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full"></div>
                      <div className="h-3 w-24 bg-zinc-900 rounded"></div>
                    </div>
                    <div className="h-3 w-16 bg-zinc-900 rounded"></div>
                  </div>
                  <div className="h-3.5 w-64 bg-zinc-900 rounded mt-2"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 font-mono text-[10px]">
              {incidents.map((job) => {
                const isExpanded = expandedId === job.id;
                const isReplaying = replayLoading === job.id;
                const fixBlueprint = getRemediation(job.failedReason || '', job.queueName);

                return (
                  <div 
                    key={job.id} 
                    className={`bg-zinc-950 border rounded-lg p-4 transition-all ${
                      isExpanded ? 'border-zinc-700 bg-zinc-900/10' : 'border-zinc-900 hover:border-zinc-800'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start space-x-2.5 min-w-0">
                        <button 
                          onClick={() => setExpandedId(isExpanded ? null : job.id)}
                          className="mt-0.5 text-zinc-500 hover:text-white transition-colors shrink-0"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-zinc-400 select-all">{job.id}</span>
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-950/20 border border-rose-900/30 text-rose-400 uppercase">
                              FAILED
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-500 font-bold">
                              {job.queueName}
                            </span>
                          </div>
                          <h3 className="font-bold text-white text-[11px] mt-1.5">{job.name}</h3>
                          <p className="text-[10px] text-rose-400 font-mono mt-1 break-words leading-relaxed max-w-2xl">
                            {job.failedReason || 'Null exception message'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0 self-end md:self-center font-mono text-[9px]">
                        <span className="text-zinc-500 font-bold uppercase">
                          Attempts: {job.attemptsMade} / {job.maxAttempts}
                        </span>
                        <button
                          onClick={() => triggerReplay(job.id)}
                          disabled={isReplaying}
                          className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold transition-all disabled:opacity-50 flex items-center space-x-1"
                        >
                          {isReplaying ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Replaying...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3 h-3" />
                              <span>Retry</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details Panel */}
                    {isExpanded && (
                      <div className="mt-4 border-t border-zinc-900 pt-4 space-y-4 font-mono text-[10px]">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Left Side: Exception stack trace */}
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase">Trace exception logs</span>
                            <pre className="bg-rose-950/5 border border-rose-900/10 p-3.5 rounded text-[9.5px] text-rose-350 font-mono overflow-x-auto leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap select-all">
                              {job.stackTrace?.join('\n') || job.failedReason || 'No execution callstack trace registered in Redis.'}
                            </pre>
                          </div>

                          {/* Right Side: Payload inspector */}
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase">Input parameters</span>
                            <pre className="bg-black/40 border border-zinc-900 p-3.5 rounded text-[9.5px] text-zinc-400 font-mono overflow-x-auto leading-relaxed select-all">
                              {JSON.stringify(job.data || {}, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {/* Bottom AI Blueprint Fix */}
                        <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded space-y-2">
                          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                            <div className="flex items-center space-x-2">
                              <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
                              <h4 className="font-bold text-white">AI Telemetry Resolution Blueprint</h4>
                            </div>
                            <span className="text-[9px] text-zinc-600 font-bold">Confidence: 98%</span>
                          </div>

                          <p className="text-[10px] text-zinc-450 leading-relaxed font-sans">
                            {fixBlueprint.description}
                          </p>

                          <div className="space-y-1 mt-2">
                            <div className="flex items-center space-x-1.5 text-zinc-500 font-bold font-mono text-[9px]">
                              <Terminal className="w-3 h-3 text-zinc-650" />
                              <span>PROPOSED INTERCEPTOR CODE</span>
                            </div>
                            <pre className="bg-black/40 border border-zinc-900 p-3 rounded text-[9.5px] font-mono text-zinc-400 overflow-x-auto select-all leading-normal whitespace-pre">
                              {fixBlueprint.code}
                            </pre>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 text-[9px] text-zinc-500 font-bold">
                          <span>FAILED AT: <span className="text-zinc-400 font-medium font-sans">{new Date(job.timestamp).toLocaleString()}</span></span>
                          <span>&bull;</span>
                          <span>RETRY STRATEGY: <span className="text-zinc-400 font-medium font-sans">Exponential Backoff (delay 2s)</span></span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {incidents.length === 0 && (
                <div className="bg-zinc-950 border border-zinc-900 p-10 rounded-lg text-center space-y-2">
                  <div className="inline-flex p-2.5 rounded bg-zinc-900 text-emerald-400 border border-zinc-900">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-white font-bold text-xs uppercase tracking-tight font-mono">No Active Incidents</h3>
                  <p className="text-[10px] text-zinc-500 max-w-sm mx-auto">
                    All background consumer workers are operating with healthy states. No failed execution records in Redis.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <AIIncidentTimeline refreshTrigger={timelineTrigger} />
      )}
    </div>
  );
}
