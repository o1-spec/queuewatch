'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, BookOpen, Clock, Tag } from 'lucide-react';

export default function BlogPage() {
  const { isAuthenticated } = useAuth();

  const posts = [
    {
      title: 'Demystifying Dead Letter Queues: Recovery Playbooks',
      excerpt: 'When retries fail, jobs drift into DLQ sinks. Learn how to audit parameters, validate Zod schemas, and replay jobs safely without down time.',
      readTime: '6 min read',
      tag: 'Reliability',
      date: 'June 8, 2026'
    },
    {
      title: 'BullMQ & Redis Concurrency Scaling: A Practical Guide',
      excerpt: 'Struggling with CPU spikes in background workers? Explore memory configurations, concurrency limits, and batch size variables.',
      readTime: '8 min read',
      tag: 'Scaling',
      date: 'June 2, 2026'
    },
    {
      title: 'How to Implement Trace IDs Across API and Queue Boundaries',
      excerpt: 'Tracing requests synchronous to asynchronous boundaries is tricky. Learn how to preserve trace IDs across webhook event triggers.',
      readTime: '5 min read',
      tag: 'Observability',
      date: 'May 28, 2026'
    }
  ];

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen relative overflow-x-hidden w-full font-sans antialiased">
      {/* Background SRE Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f11_1px,transparent_1px),linear-gradient(to_bottom,#0f0f11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-50 px-4 md:px-8 lg:px-12 h-14 flex items-center justify-between">
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
          <Link href="/blog" className="text-white">Blog</Link>
        </nav>

        <div className="flex items-center space-x-3 font-mono">
          <Link href={isAuthenticated() ? "/dashboard" : "/register"} className="px-4 py-2 rounded border border-zinc-850 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold text-xs transition-all flex items-center space-x-1">
            <span>{isAuthenticated() ? "Console" : "Get Started"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Blog list */}
      <section className="relative px-4 md:px-8 lg:px-12 pt-20 pb-28 max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">Reliability Ledger</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            The Reliability Blog
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-lg mx-auto">
            Practical SRE strategies, queue performance metrics, and distributed systems engineering guides.
          </p>
        </div>

        {/* List */}
        <div className="space-y-6 pt-12">
          {posts.map((post) => (
            <article
              key={post.title}
              className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-6 hover:border-zinc-800 transition-all space-y-4 cursor-pointer group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span className="flex items-center space-x-1">
                  <Tag className="w-3 h-3 text-indigo-400" />
                  <span className="text-zinc-400 font-semibold">{post.tag}</span>
                </span>
                <span className="flex items-center space-x-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{post.readTime}</span>
                  <span>•</span>
                  <span>{post.date}</span>
                </span>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors leading-snug">
                  {post.title}
                </h2>
                <p className="text-zinc-400 text-xs leading-relaxed font-sans">{post.excerpt}</p>
              </div>

              <div className="inline-flex items-center space-x-1.5 text-xs font-mono font-bold text-zinc-300 group-hover:text-white pt-2.5">
                <span>Read Article</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-955 py-12 px-4 md:px-8 text-center text-xs text-zinc-500 font-mono">
        <p>&copy; {new Date().getFullYear()} QueueWatch. Operational Reliability Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
