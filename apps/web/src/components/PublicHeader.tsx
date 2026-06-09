'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { ArrowRight } from 'lucide-react';

export default function PublicHeader() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="border-b border-zinc-900/80 bg-zinc-950/70 backdrop-blur-md fixed top-0 left-0 right-0 z-50 px-4 md:px-8 lg:px-12 h-14 flex items-center justify-between">
      <div className="flex items-center space-x-2.5">
        <Link href="/" className="w-5.5 h-5.5 rounded bg-zinc-100 flex items-center justify-center font-bold text-xs text-black shadow-md font-mono shrink-0">
          Q
        </Link>
        <span className="font-mono font-extrabold text-[12px] tracking-wider text-white">QUEUEWATCH</span>
      </div>

      <nav className="hidden md:flex items-center space-x-6 text-xs font-mono font-semibold text-zinc-400">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
        <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
        <Link href="/blog" className="hover:text-white transition-colors font-semibold">Blog</Link>
      </nav>

      <div className="flex items-center space-x-3 font-mono">
        <Link href={isAuthenticated() ? "/dashboard" : "/register"} className="px-4 py-2 rounded border border-zinc-850 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold text-xs transition-all flex items-center space-x-1">
          <span>{isAuthenticated() ? "Console" : "Get Started"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </header>
  );
}
