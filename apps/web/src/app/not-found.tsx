'use client';

import React from 'react';
import Link from 'next/link';
import { Terminal, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="bg-zinc-950 text-zinc-200 min-h-screen flex items-center justify-center p-6 relative w-full overflow-hidden [background-image:radial-gradient(#18181b_1px,transparent_1px)] [background-size:16px_16px]">
      <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-lg w-full max-w-md space-y-6 relative shadow-2xl font-mono text-xs animate-slide-up">
        {/* Header */}
        <div className="flex items-center space-x-3 justify-center text-center pb-3 border-b border-zinc-900">
          <div className="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs text-rose-500">
            !
          </div>
          <div>
            <h2 className="font-extrabold text-sm tracking-wider text-white">QueueWatch</h2>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Telemetry Engine</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-rose-950/15 border border-rose-900/30 text-rose-400 text-xs rounded space-y-2">
            <div className="flex items-center space-x-2 font-bold uppercase tracking-wider text-[10px]">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>HTTP 404: Page Not Found</span>
            </div>
            <p className="text-[11px] leading-relaxed font-sans text-zinc-455">
              The route you requested could not be resolved inside the active App Router manifest registry.
            </p>
          </div>

          <div className="bg-black/40 border border-zinc-900 p-4 rounded text-zinc-500 text-[10.5px] space-y-1.5">
            <div className="flex items-center space-x-1.5 text-zinc-400 font-bold">
              <Terminal className="w-3.5 h-3.5" />
              <span>CONSOLE DIAGNOSTICS:</span>
            </div>
            <div>STATUS: <span className="text-zinc-300">404</span></div>
            <div>ERR_CODE: <span className="text-zinc-300">ROUTE_NOT_FOUND</span></div>
            <div>RESOLVER: <span className="text-zinc-300">client_gateway</span></div>
          </div>
        </div>

        <Link
          href="/"
          className="w-full py-2.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 font-bold transition-all flex items-center justify-center space-x-2 text-xs"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
          <span>Return to Gateway</span>
        </Link>
      </div>
    </div>
  );
}
