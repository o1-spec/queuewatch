'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import { Skull, ShieldCheck } from 'lucide-react';
import { DeadLetterTable, DLQJob } from '../../components/DeadLetterTable';

import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DeadLetterExplorer() {
  const { authFetch } = useAuth();
  const [dlqJobs, setDlqJobs] = useState<DLQJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [replayLoading, setReplayLoading] = useState<string | null>(null);

  const loadDLQ = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/dead-letter`);
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map((j: any) => ({
          id: j.id,
          name: j.jobName || j.name || 'Job',
          queueName: j.queueName,
          status: j.replayStatus || 'pending',
          attemptsMade: j.attemptsMade,
          maxAttempts: j.maxAttempts,
          failedReason: j.failedReason || 'Max attempts reached',
          timestamp: j.timestamp,
          data: {
            originalQueue: j.queueName,
            originalJobName: j.jobName || j.name || 'Job',
            originalData: j.payload || {},
            failedAt: j.timestamp,
            errorStack: Array.isArray(j.stackTrace) ? j.stackTrace.join('\n') : (j.stackTrace || j.failedReason || ''),
          }
        }));
        setDlqJobs(mapped);
      }
    } catch (e) {
      console.error('Failed to load Dead-Letter Queue:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDLQ();
  }, []);

  // Socket IO realtime subscription
  useSocket({
    'job.deadlettered': () => loadDLQ(),
    'job.completed': () => loadDLQ(),
  });

  const handleReplay = async (jobId: string) => {
    setReplayLoading(jobId);
    try {
      const res = await authFetch(`${API_URL}/api/dead-letter/${jobId}/replay`, {
        method: 'POST',
      });
      if (res.ok) {
        // Remove from list after replay
        setDlqJobs((prev) => prev.filter((j) => j.id !== jobId));
      }
    } catch (e) {
      console.error('Failed to replay DLQ job:', e);
    } finally {
      setReplayLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-sm font-bold text-white tracking-tight flex items-center space-x-2 font-mono uppercase">
          <Skull className="w-4 h-4 text-rose-500 shrink-0 animate-pulse" />
          <span>Dead-Letter Queue Registry</span>
        </h2>
        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
          Manage failed transactions that exceeded BullMQ retry thresholds. Replay back into active loops.
        </p>
      </div>

      {loading ? (
        <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg animate-pulse space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div className="space-y-2">
              <div className="h-3 w-48 bg-zinc-900 rounded"></div>
              <div className="h-2 w-72 bg-zinc-900 rounded"></div>
            </div>
            <div className="h-5 w-20 bg-zinc-900 rounded"></div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between border-b border-zinc-900/60 pb-3 last:border-0">
                <div className="h-3 w-64 bg-zinc-900 rounded"></div>
                <div className="h-5 w-16 bg-zinc-900 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main Table component */}
          <DeadLetterTable
            jobs={dlqJobs}
            onReplay={handleReplay}
            replayLoading={replayLoading}
          />

          {dlqJobs.length === 0 && (
            <div className="bg-zinc-950 border border-zinc-900 p-10 rounded-lg text-center space-y-2 font-mono text-[10px]">
              <div className="inline-flex p-2.5 rounded bg-zinc-900 text-emerald-400 border border-zinc-900">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-white font-bold uppercase tracking-tight">Dead-Letter Index is Empty</h3>
              <p className="text-zinc-500 max-w-sm mx-auto">
                No jobs are stuck in dead-letter pools. All failures were successfully recovered or completed.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
