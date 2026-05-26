import React from 'react';
import { WorkerHealth } from '@queuewatch/shared';

interface WorkerCardProps {
  worker: WorkerHealth;
}

export function WorkerCard({ worker }: WorkerCardProps) {
  // Map active statuses to crisp, professional gray-scale/neutral indicators
  const statusColor = worker.status === 'healthy' 
    ? 'bg-emerald-500' 
    : worker.status === 'overloaded' 
    ? 'bg-amber-500 animate-pulse' 
    : 'bg-rose-500 animate-ping';

  return (
    <div className="bg-zinc-950 border border-zinc-900 p-3.5 rounded-lg hover:border-zinc-800 transition-colors font-mono text-[10px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className={`w-1.5 h-1.5 rounded-full ${statusColor} shrink-0`}></span>
          <span className="font-bold text-white text-[11px]">{worker.queueName.replace('_queue', '')}_worker</span>
        </div>
        <span className="text-zinc-500 text-[9px] font-bold uppercase">{worker.status}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-3 text-zinc-400">
        <div className="flex flex-col">
          <span>cpu</span>
          <div className="flex items-center space-x-2 mt-1">
            <div className="flex-1 bg-zinc-900 h-1.5 rounded overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${worker.cpuUsage > 80 ? 'bg-rose-500' : 'bg-zinc-700'}`} 
                style={{ width: `${worker.cpuUsage}%` }}
              ></div>
            </div>
            <span className="text-white text-[9px] font-bold w-6 text-right">{worker.cpuUsage}%</span>
          </div>
        </div>

        <div className="flex flex-col">
          <span>memory</span>
          <div className="flex items-center space-x-2 mt-1">
            <div className="flex-1 bg-zinc-900 h-1.5 rounded overflow-hidden">
              <div 
                className="h-full bg-zinc-700 transition-all duration-500" 
                style={{ width: `${worker.memoryUsage}%` }}
              ></div>
            </div>
            <span className="text-white text-[9px] font-bold w-6 text-right">{worker.memoryUsage}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkerCard;
