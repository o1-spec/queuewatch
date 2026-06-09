'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { ArrowRight } from 'lucide-react';

export default function BlogCTA() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="bg-[#08080a] border border-zinc-900 rounded-xl p-8 space-y-6 text-center shadow-2xl relative overflow-hidden mt-16">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="space-y-2">
        <h4 className="text-lg font-bold text-white tracking-tight">
          Turn operational failures into actionable intelligence with QueueWatch.
        </h4>
        <p className="text-xs text-zinc-500 max-w-md mx-auto">
          Get full observability into your BullMQ background processors, auto-resolve recurring worker issues, and secure pipeline logs.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 font-mono">
        <Link 
          href={isAuthenticated() ? "/dashboard" : "/register"}
          className="px-5 py-2.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold text-xs transition-all flex items-center space-x-1.5"
        >
          <span>Get Started</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link 
          href="/docs"
          className="px-5 py-2.5 rounded border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800 text-zinc-350 hover:text-white font-bold text-xs transition-all flex items-center space-x-1.5"
        >
          <span>View Docs</span>
        </Link>
      </div>
    </div>
  );
}
