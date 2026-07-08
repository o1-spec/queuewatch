'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import { WorkerHealth } from '@queuewatch/shared';
import { WorkerCard } from '../../components/WorkerCard';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function WorkersExplorer() {
  const { authFetch } = useAuth();
  const [workers, setWorkers] = useState<WorkerHealth[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWorkers = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/workers`);
      if (res.ok) {
        const data = await res.json();
        setWorkers(data);
      }
    } catch (e) {
      console.error('Failed to query active workers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
  }, []);

  useSocket({
    'worker.health.updated': (socketWorkers: WorkerHealth[]) => {
      setWorkers(socketWorkers);
    },
  });

  const healthyCount = workers.filter(w => w.status === 'healthy').length;
  const healthPercent = workers.length > 0 ? Math.round((healthyCount / workers.length) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-900 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight uppercase font-mono">Worker Node Telemetry Registry</h2>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Monitor CPU load, memory utilization, and queue client mappings across active background threads.</p>
          </div>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-semibold font-mono">
            {healthPercent}% Operational
          </span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg h-36 flex flex-col justify-between animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-24 bg-zinc-900 rounded"></div>
                <div className="h-3 w-12 bg-zinc-900 rounded"></div>
              </div>
              <div className="space-y-2 mt-4">
                <div className="h-2 w-full bg-zinc-900 rounded"></div>
                <div className="h-2 w-5/6 bg-zinc-900 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : workers.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-12 text-center max-w-lg mx-auto mt-8">
          <p className="text-zinc-400 text-xs font-sans">No active workers detected.</p>
          <p className="text-zinc-550 text-[10px] font-mono mt-2 uppercase">Waiting for SDK worker heartbeat heartbeats...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((worker) => (
            <WorkerCard key={worker.workerId} worker={worker} />
          ))}
        </div>
      )}
    </div>
  );
}
