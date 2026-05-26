import React, { useState } from 'react';
import { RefreshCw, Play, AlertCircle, Eye, ChevronDown, ChevronUp } from 'lucide-react';

export interface DLQJob {
  id: string;
  name: string;
  queueName: string;
  status: string;
  data: {
    originalQueue: string;
    originalJobName: string;
    originalData: any;
    failedAt: number;
    errorStack: string;
  };
  attemptsMade: number;
  maxAttempts: number;
  failedReason: string;
  timestamp: number;
}

interface DeadLetterTableProps {
  jobs: DLQJob[];
  onReplay: (jobId: string) => Promise<void>;
  replayLoading: string | null;
}

export function DeadLetterTable({ jobs, onReplay, replayLoading }: DeadLetterTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="glass-card p-6 rounded-2xl">
      <div className="border-b border-slate-900 pb-3 mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white text-md">Dead-Letter Queue Telemetry</h3>
          <p className="text-xs text-slate-400">
            Permanently failed BullMQ jobs. Select replay to route them back into active queues with original params.
          </p>
        </div>
        <div className="bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 text-[11px] text-rose-400 font-bold font-mono">
          {jobs.length} Dead Letters
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="pb-3 w-8"></th>
              <th className="pb-3">Job ID</th>
              <th className="pb-3">Action Name</th>
              <th className="pb-3">Target Queue</th>
              <th className="pb-3">Attempts</th>
              <th className="pb-3">Fatal Failure Reason</th>
              <th className="pb-3 text-right">Dispatch</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const isExpanded = expandedId === job.id;
              const isReplaying = replayLoading === job.id;

              return (
                <React.Fragment key={job.id}>
                  {/* Row */}
                  <tr className={`border-b border-slate-900/60 last:border-0 hover:bg-slate-950/20 transition-colors ${isExpanded ? 'bg-slate-950/10' : ''}`}>
                    <td className="py-4">
                      <button 
                        onClick={() => toggleExpand(job.id)}
                        className="text-slate-500 hover:text-white transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-4 font-mono font-bold text-slate-300">
                      {job.id}
                    </td>
                    <td className="py-4 font-semibold text-white">
                      {job.data?.originalJobName || job.name}
                    </td>
                    <td className="py-4 font-mono">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 border border-slate-800 text-slate-400">
                        {job.data?.originalQueue || job.queueName}
                      </span>
                    </td>
                    <td className="py-4 font-mono text-slate-400">
                      {job.attemptsMade} / {job.maxAttempts}
                    </td>
                    <td className="py-4 text-rose-400 font-mono text-[11px] truncate max-w-xs">
                      {job.failedReason || 'Max attempts reached'}
                    </td>
                    <td className="py-4 text-right">
                      <button
                        onClick={() => onReplay(job.id)}
                        disabled={isReplaying}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold transition-all disabled:opacity-50 inline-flex items-center space-x-1.5 shadow-md"
                      >
                        {isReplaying ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Replaying...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Replay Job</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <tr className="bg-slate-950/30 border-b border-slate-900">
                      <td colSpan={7} className="p-5 font-mono text-[11px] text-slate-400 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Left: Input Payload */}
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-1.5 text-slate-500 font-bold uppercase text-[10px]">
                              <Eye className="w-3.5 h-3.5" />
                              <span>Original Payload Input Parameters</span>
                            </div>
                            <pre className="bg-black/40 border border-slate-900 p-4 rounded-xl text-[10px] text-cyan-400 overflow-x-auto select-all leading-normal whitespace-pre">
                              {JSON.stringify(job.data?.originalData || job.data || {}, null, 2)}
                            </pre>
                          </div>

                          {/* Right: Exception Callstack */}
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-1.5 text-rose-500/80 font-bold uppercase text-[10px]">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Trace exception logs</span>
                            </div>
                            <pre className="bg-rose-950/5 border border-rose-950/15 p-4 rounded-xl text-[10px] text-rose-300 overflow-x-auto leading-normal whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {job.data?.errorStack || job.failedReason || 'No trace callstack captured in Redis memory.'}
                            </pre>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 border-t border-slate-900/60 pt-3 text-[10px] text-slate-500 font-bold">
                          <span>FAILED ON: <span className="text-slate-300 font-medium font-sans">{new Date(job.data?.failedAt || job.timestamp).toLocaleString()}</span></span>
                          <span>&bull;</span>
                          <span>BULLMQ ATTEMPTS EXCEEDED: <span className="text-slate-300 font-medium font-mono">{job.attemptsMade} attempts max limits</span></span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500 font-medium text-xs">
                  No dead-lettered jobs pending replay inside Redis memory. All queues active.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DeadLetterTable;
