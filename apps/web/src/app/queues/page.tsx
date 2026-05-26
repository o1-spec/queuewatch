'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import { QueueMetrics } from '@queuewatch/shared';
import { QueueCard } from '../../components/QueueCard';

import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function QueuesExplorer() {
  const { authFetch } = useAuth();
  const [queues, setQueues] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<QueueMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  const loadQueues = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/queues`);
      if (res.ok) {
        const data = await res.json();
        setQueues(data);
        
        // Setup initial metrics format from REST
        const initialMetrics = data.map((q: any) => ({
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
        setMetrics(initialMetrics);
      }
    } catch (e) {
      console.error('Failed to query queues:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueues();
  }, []);

  useSocket({
    'queue.metrics.updated': (socketMetrics: QueueMetrics[]) => {
      setMetrics(socketMetrics);
      setQueues((prev) =>
        prev.map((q) => {
          const match = socketMetrics.find((m) => m.queueName === q.name);
          if (match) {
            return {
              ...q,
              waiting: match.waitingCount,
              active: match.activeCount,
              completed: match.completedCount,
              failed: match.failedCount,
              delayed: match.delayedCount,
              paused: match.paused,
            };
          }
          return q;
        })
      );
    },
  });

  const togglePause = async (name: string, isCurrentlyPaused: boolean) => {
    setToggleLoading(name);
    const action = isCurrentlyPaused ? 'resume' : 'pause';
    try {
      const res = await authFetch(`${API_URL}/api/queues/${name}/${action}`, {
        method: 'POST',
      });
      if (res.ok) {
        setQueues((prev) =>
          prev.map((q) => (q.name === name ? { ...q, paused: !isCurrentlyPaused } : q))
        );
      }
    } catch (e) {
      console.error(`Failed to ${action} queue:`, e);
    } finally {
      setToggleLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Active Queues Registry</h2>
        <p className="text-xs text-slate-400 mt-1 font-medium">Audit waiting tasks, Completed sizes, and toggle pause/resume configurations</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-6 rounded-2xl h-64 flex flex-col justify-between border border-slate-900/60 animate-pulse">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div>
                    <div className="h-4 w-32 bg-slate-800 rounded"></div>
                  </div>
                  <div className="h-8 w-24 bg-slate-800 rounded-lg"></div>
                </div>
                <div className="grid grid-cols-5 gap-3 mt-6">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className="bg-slate-950/40 p-2 rounded-xl border border-slate-900/80 h-14 flex flex-col justify-between">
                      <div className="h-2 w-8 bg-slate-800 rounded mx-auto"></div>
                      <div className="h-3 w-6 bg-slate-800 rounded mx-auto"></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-900/60 pt-4 flex items-center justify-between mt-4">
                <div className="h-3 w-20 bg-slate-800 rounded"></div>
                <div className="h-3 w-28 bg-slate-800 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {queues.map((queue) => {
            const queueMetrics = metrics.find(m => m.queueName === queue.name);
            return (
              <QueueCard
                key={queue.name}
                queue={queue}
                metrics={queueMetrics}
                onTogglePause={togglePause}
                toggleLoading={toggleLoading}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
