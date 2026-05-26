import React from 'react';
import { WorkerHealth } from '@queuewatch/shared';

interface WorkerCardProps {
  worker: WorkerHealth;
}

export function WorkerCard({ worker }: WorkerCardProps) {
  return (
    <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl hover:border-slate-800 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${
            worker.status === 'healthy' ? 'bg-emerald-500 glow-emerald' : 
            worker.status === 'overloaded' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500 animate-ping'
          }`}></span>
          <span className="font-bold text-xs font-mono text-white">{worker.queueName} worker</span>
        </div>
        <span className="text-[10px] text-slate-500 font-semibold font-mono uppercase">{worker.status}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-3 text-[11px] text-slate-400">
        <div className="flex flex-col">
          <span>CPU Load</span>
          <div className="flex items-center space-x-2 mt-1">
            <div className="flex-1 bg-slate-900 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${worker.cpuUsage > 80 ? 'bg-rose-500' : 'bg-indigo-500'}`} 
                style={{ width: `${worker.cpuUsage}%` }}
              ></div>
            </div>
            <span className="font-mono text-white text-[10px] font-bold">{worker.cpuUsage}%</span>
          </div>
        </div>

        <div className="flex flex-col">
          <span>Memory Load</span>
          <div className="flex items-center space-x-2 mt-1">
            <div className="flex-1 bg-slate-900 h-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-500 transition-all duration-500" 
                style={{ width: `${worker.memoryUsage}%` }}
              ></div>
            </div>
            <span className="font-mono text-white text-[10px] font-bold">{worker.memoryUsage}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkerCard;
