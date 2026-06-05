'use client';

import React, { useEffect } from 'react';
import { Terminal, AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled runtime application crash:', error);
  }, [error]);

  return (
    <div className="bg-zinc-950 text-zinc-200 min-h-screen flex items-center justify-center p-6 relative w-full overflow-hidden [background-image:radial-gradient(#18181b_1px,transparent_1px)] [background-size:16px_16px]">
      <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-lg w-full max-w-lg space-y-6 relative shadow-2xl font-mono text-xs animate-slide-up">
        {/* Header */}
        <div className="flex items-center space-x-3 justify-center text-center pb-3 border-b border-zinc-900">
          <div className="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs text-rose-500">
            !
          </div>
          <div>
            <h2 className="font-extrabold text-sm tracking-wider text-white">QueueWatch</h2>
            <p className="text-[9px] text-zinc-550 font-bold uppercase tracking-widest leading-none">Telemetry Engine</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-rose-950/15 border border-rose-900/30 text-rose-400 text-xs rounded space-y-2">
            <div className="flex items-center space-x-2 font-bold uppercase tracking-wider text-[10px]">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <span>Runtime Execution Crash</span>
            </div>
            <p className="text-[11px] leading-relaxed font-sans text-zinc-400">
              An unhandled exception occurred in the client application runtime thread.
            </p>
          </div>

          <div className="bg-black/40 border border-zinc-900 p-4 rounded text-zinc-500 text-[10.5px] space-y-2">
            <div className="flex items-center space-x-1.5 text-zinc-450 font-bold uppercase text-[9px] tracking-wider">
              <Terminal className="w-3.5 h-3.5 text-zinc-500" />
              <span>EXCEPTION STACKTRACE:</span>
            </div>
            <pre className="text-rose-400/85 bg-zinc-950/50 p-2.5 rounded border border-zinc-900 overflow-x-auto whitespace-pre-wrap max-h-40 leading-normal select-text">
              {error.message || 'Unknown runtime error'}
              {error.stack && `\n\nStack:\n${error.stack.split('\n').slice(0, 4).join('\n')}`}
            </pre>
            {error.digest && (
              <div className="text-[9px] text-zinc-650">Digest: {error.digest}</div>
            )}
          </div>
        </div>

        <button
          onClick={() => reset()}
          className="w-full py-2.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 font-bold transition-all flex items-center justify-center space-x-2 text-xs"
        >
          <RefreshCw className="w-4 h-4 text-zinc-400" />
          <span>Hot Restart Thread</span>
        </button>
      </div>
    </div>
  );
}
