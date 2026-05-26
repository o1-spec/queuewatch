import React from 'react';

export interface LiveEvent {
  id: string;
  queue: string;
  status: string;
  message: string;
  timestamp: string;
}

interface ActivityFeedProps {
  events: LiveEvent[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <div className="glass-card p-6 rounded-2xl flex flex-col h-[400px]">
      <div className="border-b border-slate-900/60 pb-3 mb-4">
        <h3 className="font-bold text-white text-md">Realtime Activity Feed</h3>
        <p className="text-xs text-slate-400">Rolling event stream from BullMQ Redis streams</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {events.map((evt) => (
          <div key={evt.id} className="text-xs border-b border-slate-900/40 pb-2.5 flex items-start space-x-2.5">
            <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-bold border shrink-0 ${
              evt.status === 'Completed' ? 'text-emerald-400 bg-emerald-950/20 border-emerald-500/10' :
              evt.status === 'Active' ? 'text-indigo-400 bg-indigo-950/20 border-indigo-500/10' :
              evt.status === 'Failed' || evt.status === 'DLQ' ? 'text-rose-400 bg-rose-950/20 border-rose-500/10' :
              evt.status === 'Retrying' ? 'text-amber-400 bg-amber-950/20 border-amber-500/10' :
              'text-cyan-400 bg-cyan-950/20 border-cyan-500/10'
            }`}>
              {evt.status}
            </span>
            <div className="flex-1">
              <p className="text-[11px] text-slate-300 font-mono break-all leading-tight">{evt.message}</p>
              <span className="text-[10px] text-slate-500 mt-1 inline-block">
                {evt.timestamp} &bull; <strong className="text-slate-400">{evt.queue}</strong>
              </span>
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
            <p className="text-xs animate-pulse">Waiting for background tasks to start...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityFeed;
