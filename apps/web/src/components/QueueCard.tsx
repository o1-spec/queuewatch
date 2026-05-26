import React from 'react';
import Link from 'next/link';
import { QueueMetrics } from '@queuewatch/shared';

interface QueueCardProps {
  queue: {
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  };
  metrics?: QueueMetrics;
  onTogglePause: (name: string, isCurrentlyPaused: boolean) => Promise<void>;
  toggleLoading?: string | null;
}

export function QueueCard({
  queue,
  metrics,
  onTogglePause,
  toggleLoading,
}: QueueCardProps) {
  const isPending = toggleLoading === queue.name;

  return (
    <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-64 hover:border-slate-800 transition-all">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className={`w-2.5 h-2.5 rounded-full ${queue.paused ? 'bg-amber-500 glow-amber' : 'bg-emerald-500 active-pulse-emerald'}`}></span>
            <h3 className="text-md font-bold font-mono text-white tracking-wide">{queue.name}</h3>
          </div>
          
          <button
            onClick={() => onTogglePause(queue.name, queue.paused)}
            disabled={isPending}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              queue.paused
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'
            } disabled:opacity-50`}
          >
            {isPending ? 'Syncing...' : queue.paused ? 'Resume Worker' : 'Pause Worker'}
          </button>
        </div>

        {/* Grid stats */}
        <div className="grid grid-cols-5 gap-2.5 mt-6 text-center">
          <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-900/60">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Waiting</p>
            <p className="text-sm font-extrabold text-cyan-400 mt-0.5 font-mono">{queue.waiting}</p>
          </div>
          <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-900/60">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Active</p>
            <p className="text-sm font-extrabold text-indigo-400 mt-0.5 font-mono">{queue.active}</p>
          </div>
          <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-900/60">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Completed</p>
            <p className="text-sm font-extrabold text-emerald-400 mt-0.5 font-mono">{queue.completed}</p>
          </div>
          <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-900/60">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Failed</p>
            <p className="text-sm font-extrabold text-rose-500 mt-0.5 font-mono">{queue.failed}</p>
          </div>
          <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-900/60">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Delayed</p>
            <p className="text-sm font-extrabold text-amber-500 mt-0.5 font-mono">{queue.delayed}</p>
          </div>
        </div>
      </div>

      {/* Detail drill link */}
      <div className="border-t border-slate-900/60 pt-4 flex items-center justify-between mt-4 text-[11px] text-slate-400">
        <div className="flex flex-col">
          <span>Latency: <strong className="text-white font-mono">{metrics?.averageLatency ?? 0}ms</strong></span>
          <span>Throughput: <strong className="text-white font-mono">{metrics?.throughput ?? 0}/min</strong></span>
        </div>

        <Link
          href={`/queues/${queue.name}`}
          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center space-x-1"
        >
          <span>Drill down metrics</span>
          <span>&rarr;</span>
        </Link>
      </div>
    </div>
  );
}

export default QueueCard;
