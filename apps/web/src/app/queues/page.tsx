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
    'metrics.updated': (socketMetrics: QueueMetrics[]) => {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-sm font-bold text-white tracking-tight uppercase font-mono">Queue Telemetry Indices Registry</h2>
        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Audit waiting tasks, completed capacities, and toggle runtime paused thread pools.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg h-56 flex flex-col justify-between animate-pulse">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 animate-ping"></div>
                    <div className="h-3 w-32 bg-zinc-900 rounded"></div>
                  </div>
                  <div className="h-6 w-20 bg-zinc-900 rounded"></div>
                </div>
                <div className="grid grid-cols-5 gap-1.5 mt-5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className="bg-zinc-900/10 p-2 rounded border border-zinc-900 h-10 flex flex-col justify-between">
                      <div className="h-1 w-6 bg-zinc-900 rounded mx-auto"></div>
                      <div className="h-2 w-4 bg-zinc-900 rounded mx-auto"></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-zinc-900/60 pt-3 flex items-center justify-between mt-4">
                <div className="h-2.5 w-16 bg-zinc-900 rounded"></div>
                <div className="h-2.5 w-24 bg-zinc-900 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
