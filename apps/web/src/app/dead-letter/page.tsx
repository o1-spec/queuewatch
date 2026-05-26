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
      const res = await authFetch(`${API_URL}/api/queues/dead_letter_queue/jobs?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setDlqJobs(data);
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
      const res = await authFetch(`${API_URL}/api/queues/jobs/${jobId}/replay`, {
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
          <Skull className="w-6 h-6 text-rose-500" />
          <span>Dead-Letter Queue Registry</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1 font-medium">
          Manage failed transactions that exceeded BullMQ retry thresholds. Replay back into active loops.
        </p>
      </div>

      {loading ? (
        <div className="glass-card p-6 rounded-2xl animate-pulse space-y-6">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <div className="space-y-2">
              <div className="h-4 w-48 bg-slate-800 rounded"></div>
              <div className="h-3 w-72 bg-slate-800 rounded"></div>
            </div>
            <div className="h-6 w-24 bg-slate-800 rounded-full"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between border-b border-slate-900/60 pb-4 last:border-0">
                <div className="flex items-center space-x-4">
                  <div className="w-4 h-4 bg-slate-800 rounded"></div>
                  <div className="h-3.5 w-16 bg-slate-800 rounded"></div>
                  <div className="h-3.5 w-24 bg-slate-800 rounded"></div>
                  <div className="h-4 w-20 bg-slate-800 rounded"></div>
                </div>
                <div className="h-3.5 w-44 bg-slate-800 rounded"></div>
                <div className="h-7 w-20 bg-slate-800 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Table component */}
          <DeadLetterTable
            jobs={dlqJobs}
            onReplay={handleReplay}
            replayLoading={replayLoading}
          />

          {dlqJobs.length === 0 && (
            <div className="glass-card p-12 rounded-2xl text-center space-y-2">
              <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-white font-bold text-sm">Dead-Letter Index is Empty</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No jobs are stuck in dead-letter pools. All failures were successfully recovered or completed.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
