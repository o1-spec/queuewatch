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
    <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 flex flex-col h-[380px]">
      <div className="border-b border-zinc-900 pb-2.5 mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white text-xs font-mono tracking-tight">Stdout Terminal Streams</h3>
          <p className="text-[10px] text-zinc-500 font-mono">Realtime worker executions feed</p>
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px] select-text">
        {events.map((evt) => {
          let badgeClass = 'text-zinc-400 bg-zinc-900 border-zinc-800';
          if (evt.status === 'Completed') {
            badgeClass = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
          } else if (evt.status === 'Active') {
            badgeClass = 'text-blue-400 bg-blue-950/20 border-blue-900/30';
          } else if (evt.status === 'Failed' || evt.status === 'DLQ') {
            badgeClass = 'text-rose-400 bg-rose-950/20 border-rose-900/30';
          } else if (evt.status === 'Retrying') {
            badgeClass = 'text-amber-400 bg-amber-950/20 border-amber-900/30';
          }

          return (
            <div key={evt.id} className="border-b border-zinc-900/30 pb-2 flex items-start space-x-2">
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border shrink-0 uppercase tracking-tighter ${badgeClass}`}>
                {evt.status}
              </span>
              <div className="flex-grow min-w-0">
                <p className="text-zinc-300 break-all leading-normal whitespace-pre-wrap">{evt.message}</p>
                <div className="text-[9px] text-zinc-600 mt-1 flex items-center space-x-1.5">
                  <span>{evt.timestamp}</span>
                  <span>&bull;</span>
                  <span className="text-zinc-500 font-bold">{evt.queue}</span>
                </div>
              </div>
            </div>
          );
        })}

        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-600 space-y-1">
            <p className="text-[10px] animate-pulse">listening for stdout telemetry...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityFeed;
