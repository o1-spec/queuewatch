import React, { useState } from 'react';
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
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 flex flex-col justify-between h-56 hover:border-zinc-800 transition-all relative">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`w-1.5 h-1.5 rounded-full ${queue.paused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
            <h3 className="text-xs font-bold font-mono text-white tracking-tight">{queue.name}</h3>
          </div>
          
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isPending}
            className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all border ${
              queue.paused
                ? 'bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border-emerald-900'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
            } disabled:opacity-50`}
          >
            {isPending ? 'syncing...' : queue.paused ? 'resume' : 'pause'}
          </button>
        </div>

        {showConfirm && (
          <>
            <div 
              onClick={() => setShowConfirm(false)}
              className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 transition-opacity animate-fade-in"
            ></div>
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-950 border border-zinc-900 p-5 rounded-lg w-[calc(100%-2rem)] max-w-xs shadow-2xl z-50 font-mono text-[10px] space-y-4 animate-slide-up text-zinc-300">
              <div className="flex items-center space-x-2 border-b border-zinc-900 pb-2.5">
                <span className={`w-1.5 h-1.5 rounded-full ${queue.paused ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'} shrink-0`}></span>
                <span className="text-[11px] font-bold text-white uppercase">
                  {queue.paused ? 'Resume Queue?' : 'Pause Queue?'}
                </span>
              </div>
              <p className="font-sans leading-relaxed text-zinc-400 text-[11px]">
                {queue.paused 
                  ? `Confirm resuming telemetry streams on "${queue.name}". Active worker nodes will instantly pop waiting Redis jobs.`
                  : `Confirm pausing telemetry streams on "${queue.name}". Active worker nodes will halt processing new jobs.`
                }
              </p>
              <div className="flex space-x-2 pt-1.5">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowConfirm(false);
                    await onTogglePause(queue.name, queue.paused);
                  }}
                  className={`flex-1 py-1.5 rounded font-bold border transition-all ${
                    queue.paused
                      ? 'bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
                      : 'bg-amber-950/20 hover:bg-amber-950/40 text-amber-400 border-amber-900/30'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </>
        )}

        {/* Dense Grid stats */}
        <div className="grid grid-cols-5 gap-1.5 mt-5">
          <div className="bg-zinc-900/20 px-2 py-1.5 rounded border border-zinc-900 text-center">
            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Waiting</p>
            <p className="text-xs font-semibold text-blue-400 mt-1 font-mono">{queue.waiting}</p>
          </div>
          <div className="bg-zinc-900/20 px-2 py-1.5 rounded border border-zinc-900 text-center">
            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Active</p>
            <p className="text-xs font-semibold text-indigo-400 mt-1 font-mono">{queue.active}</p>
          </div>
          <div className="bg-zinc-900/20 px-2 py-1.5 rounded border border-zinc-900 text-center">
            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Done</p>
            <p className="text-xs font-semibold text-emerald-400 mt-1 font-mono">{queue.completed}</p>
          </div>
          <div className="bg-zinc-900/20 px-2 py-1.5 rounded border border-zinc-900 text-center">
            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Failed</p>
            <p className="text-xs font-semibold text-rose-500 mt-1 font-mono">{queue.failed}</p>
          </div>
          <div className="bg-zinc-900/20 px-2 py-1.5 rounded border border-zinc-900 text-center">
            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Delayed</p>
            <p className="text-xs font-semibold text-amber-500 mt-1 font-mono">{queue.delayed}</p>
          </div>
        </div>
      </div>

      {/* Detail drill link */}
      <div className="border-t border-zinc-900/60 pt-3 flex items-center justify-between mt-4 text-[10px] text-zinc-400 font-mono">
        <div className="flex space-x-4">
          <span>delay: <strong className="text-white font-mono">{metrics?.averageLatency ?? 0}ms</strong></span>
          <span>rate: <strong className="text-white font-mono">{metrics?.throughput ?? 0}/min</strong></span>
        </div>

        <Link
          href={`/queues/${queue.name}`}
          className="text-[10px] font-bold text-zinc-400 hover:text-white transition-colors flex items-center space-x-1"
        >
          <span>Telemetry dashboard</span>
          <span>&rarr;</span>
        </Link>
      </div>
    </div>
  );
}

export default QueueCard;
