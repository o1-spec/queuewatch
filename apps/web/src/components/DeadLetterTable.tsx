import React, { useState } from 'react';
import { RefreshCw, Play, AlertCircle, Eye, X, Terminal } from 'lucide-react';

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
  const [selectedJob, setSelectedJob] = useState<DLQJob | null>(null);

  const handleRowClick = (job: DLQJob) => {
    setSelectedJob(job);
  };

  const closeDrawer = () => {
    setSelectedJob(null);
  };

  const activeReplayLoading = replayLoading === selectedJob?.id;

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 relative overflow-hidden">
      <div className="border-b border-zinc-900 pb-3 mb-4 flex items-center justify-between font-mono text-[10px]">
        <div>
          <h3 className="font-bold text-white text-xs uppercase tracking-tight">Dead-Letter Queue Telemetry</h3>
          <p className="text-[10px] text-zinc-500">
            Permanently failed background transactions. Select row to open active payload drawer.
          </p>
        </div>
        <div className="bg-rose-950/20 px-2 py-0.5 rounded border border-rose-900/30 text-[9px] text-rose-400 font-bold">
          {jobs.length} Dead Letters
        </div>
      </div>

      <div className="overflow-x-auto text-[10px] font-mono">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider text-[9px]">
              <th className="pb-2">Job ID</th>
              <th className="pb-2">Action Name</th>
              <th className="pb-2">Target Queue</th>
              <th className="pb-2">Attempts</th>
              <th className="pb-2">Failure Reason</th>
              <th className="pb-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const isReplaying = replayLoading === job.id;
              const isSelected = selectedJob?.id === job.id;

              return (
                <tr 
                  key={job.id} 
                  onClick={() => handleRowClick(job)}
                  className={`border-b border-zinc-900/40 last:border-0 hover:bg-zinc-900/10 cursor-pointer transition-colors ${
                    isSelected ? 'bg-zinc-900/20' : ''
                  }`}
                >
                  <td className="py-3 font-bold text-zinc-300 select-all">
                    {job.id}
                  </td>
                  <td className="py-3 font-semibold text-white">
                    {job.data?.originalJobName || job.name}
                  </td>
                  <td className="py-3">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-500">
                      {job.data?.originalQueue || job.queueName}
                    </span>
                  </td>
                  <td className="py-3 text-zinc-400">
                    {job.attemptsMade} / {job.maxAttempts}
                  </td>
                  <td className="py-3 text-rose-450 truncate max-w-xs">
                    {job.failedReason || 'Max attempts reached'}
                  </td>
                  <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onReplay(job.id)}
                      disabled={isReplaying}
                      className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 text-[9px] font-bold transition-all disabled:opacity-50 inline-flex items-center space-x-1"
                    >
                      {isReplaying ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Replaying...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          <span>Replay</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}

            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-650 font-bold">
                  No dead-lettered states pending replay inside Redis pools.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Right Drawer Panel */}
      {selectedJob && (
        <>
          {/* Backdrop Overlay */}
          <div 
            onClick={closeDrawer}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity"
          ></div>

          {/* Lateral Drawer Box */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-112 md:w-128 bg-zinc-950 border-l border-zinc-900 shadow-2xl z-50 p-5 flex flex-col justify-between font-mono text-[10px] text-zinc-300 transition-all duration-300 ease-in-out">
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
                  <span className="text-[11px] font-bold text-white uppercase">Dead-Letter Job Inspector</span>
                </div>
                <button 
                  onClick={closeDrawer}
                  className="p-1 rounded hover:bg-zinc-900 text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Core Parameters Metadata */}
              <div className="bg-zinc-900/20 border border-zinc-900 p-3 rounded space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Job ID:</span>
                  <span className="text-white font-bold select-all">{selectedJob.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Action:</span>
                  <span className="text-white font-semibold">{selectedJob.data?.originalJobName || selectedJob.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Original Queue:</span>
                  <span className="text-zinc-300 font-bold">{selectedJob.data?.originalQueue || selectedJob.queueName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Failed attempts:</span>
                  <span className="text-rose-400 font-bold">{selectedJob.attemptsMade} / {selectedJob.maxAttempts} limits</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Fatal failure:</span>
                  <span className="text-zinc-400 leading-normal text-right truncate max-w-xs" title={selectedJob.failedReason}>
                    {selectedJob.failedReason || 'Max retry limit reached'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-zinc-900/60 pt-2 mt-1">
                  <span className="text-zinc-500">Failed at:</span>
                  <span className="text-zinc-400">{new Date(selectedJob.data?.failedAt || selectedJob.timestamp).toLocaleString()}</span>
                </div>
              </div>

              {/* Original Input Payload Panel */}
              <div className="space-y-1.5">
                <div className="flex items-center space-x-1 text-zinc-500 font-bold uppercase text-[9px]">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Original Payload Input Parameters</span>
                </div>
                <pre className="bg-black/40 border border-zinc-900 p-3 rounded text-[9px] text-zinc-400 overflow-x-auto select-all leading-normal whitespace-pre max-h-40 overflow-y-auto">
                  {JSON.stringify(selectedJob.data?.originalData || selectedJob.data || {}, null, 2)}
                </pre>
              </div>

              {/* Error Stack Trace Box */}
              <div className="space-y-1.5">
                <div className="flex items-center space-x-1 text-rose-500 font-bold uppercase text-[9px]">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Trace Exception Stack Logs</span>
                </div>
                <pre className="bg-rose-950/5 border border-rose-900/10 p-3 rounded text-[9px] text-rose-350 overflow-x-auto leading-relaxed max-h-52 overflow-y-auto whitespace-pre-wrap select-all">
                  {selectedJob.data?.errorStack || selectedJob.failedReason || 'No trace callstack captured in Redis memory.'}
                </pre>
              </div>
            </div>

            {/* Drawer Dispatch Control */}
            <div className="border-t border-zinc-900 pt-4 flex items-center justify-between mt-4">
              <span className="text-[9px] text-zinc-500 font-bold uppercase flex items-center space-x-1">
                <Terminal className="w-3 h-3 text-zinc-650" />
                <span>Redis status: dead-lettered</span>
              </span>

              <button
                onClick={async () => {
                  await onReplay(selectedJob.id);
                  closeDrawer();
                }}
                disabled={activeReplayLoading}
                className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 font-bold text-[10px] transition-all disabled:opacity-50 flex items-center space-x-1.5 shadow"
              >
                {activeReplayLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Replaying...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Replay Dispatch</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DeadLetterTable;
