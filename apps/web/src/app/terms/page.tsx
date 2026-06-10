'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, ShieldCheck, Scale, FileText, CheckCircle2 } from 'lucide-react';
import PublicHeader from '../../components/PublicHeader';

export default function TermsPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen relative overflow-x-hidden w-full font-sans antialiased">
      {/* Background SRE Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f11_1px,transparent_1px),linear-gradient(to_bottom,#0f0f11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Top fixed navbar */}
      {/* Top fixed navbar */}
      <PublicHeader />

      {/* Content Section */}
      <section className="relative px-4 md:px-8 lg:px-12 pt-28 pb-28 max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 bg-zinc-900/60 border border-zinc-800/85 px-2.5 py-1 rounded text-indigo-400 text-[9px] font-mono font-bold uppercase tracking-wider shadow-inner">
            <Scale className="w-3.5 h-3.5" />
            <span>Service Terms</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Terms of Service
          </h1>
          <p className="text-zinc-500 font-mono text-[10.5px]">Last Updated: June 9, 2026</p>
        </div>

        <div className="space-y-8 text-zinc-400 text-sm leading-relaxed font-sans">
          <p className="text-zinc-300">
            Welcome to QueueWatch. By accessing our monitoring dashboard, utilizing our client-side telemetry SDK, or linking background workers to our ingestion endpoint, you agree to comply with the terms detailed below.
          </p>

          <hr className="border-zinc-900" />

          {/* Section 1 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" /> 1. License & Usage Rights
            </h2>
            <p>
              We grant you a non-transferable, non-exclusive, revocable license to embed the QueueWatch telemetry SDK wrapper into your background workers. You agree not to reverse engineer the ingestion endpoint, inject malicious packet cycles, or attempt to query databases of other projects.
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
              <ShieldCheck className="w-4 h-4 text-indigo-400" /> 2. API Key Security & Accountability
            </h2>
            <p>
              When you generate a project key under the Console, you are fully responsible for preserving the confidentiality of that credential. Any telemetry streams, configuration updates, or incident resolution commands authorized with your API key are considered executed by you.
            </p>
          </div>

          {/* Section 3 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
              <FileText className="w-4 h-4 text-indigo-400" /> 3. Service Constraints & Liability Limitations
            </h2>
            <p>
              QueueWatch is an operational diagnostics and SRE monitoring platform. It is provided &quot;as is&quot; without explicit service level guarantees or warranties of any kind. QueueWatch is not liable for downstream application errors, worker lockups, background queue latency spikes, or developer failures that result in missed alert notifications.
            </p>
          </div>

          {/* Section 4 */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
              4. Termination
            </h2>
            <p>
              We reserve the right to suspend API endpoints or revoke auth tokens for accounts that violate security boundaries, execute denial-of-service tests against the ingestion server, or transmit unmasked plaintext PII payloads.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-955 py-12 px-4 md:px-8 text-center text-xs text-zinc-550 font-mono">
        <p>&copy; {new Date().getFullYear()} QueueWatch. Operational Reliability Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
