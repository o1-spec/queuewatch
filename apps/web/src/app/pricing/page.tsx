'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, Check, Shield, Zap, Server } from 'lucide-react';

export default function PricingPage() {
  const { isAuthenticated } = useAuth();

  const tiers = [
    {
      name: 'Starter',
      price: '$0',
      description: 'Ideal for local debugging, developers, and staging environments.',
      features: [
        'Up to 3 background queues',
        '100,500 monthly jobs ingested',
        '3 days trace & telemetry retention',
        'Local Redis broker connections',
        'Community support channels'
      ],
      cta: 'Get Started',
      href: '/register',
      highlight: false
    },
    {
      name: 'Pro',
      price: '$29',
      period: '/ month',
      description: 'Built for production microservices and engineering teams.',
      features: [
        'Unlimited queue registrations',
        '10M monthly jobs ingested',
        '30 days telemetry & log retention',
        'AI Reliability Copilot & timelines',
        'Custom alerts & escalation rules',
        'E2E transaction trace correlation',
        'Next-day email SRE support'
      ],
      cta: 'Start Pro Trial',
      href: '/register',
      highlight: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'For large distributed systems, compliance, and custom workloads.',
      features: [
        'Unlimited volume & scale',
        '1-year cold trace retention options',
        'Self-hosted Redis/API gateways',
        'Custom LLM models (On-Prem / VPC)',
        'SLA guarantees & dedicated support',
        'SSO/SAML team integrations',
        'Priority feature requests'
      ],
      cta: 'Contact Sales',
      href: '/contact',
      highlight: false
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
          <Link href="/pricing" className="text-white">Pricing</Link>
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
        </nav>

        <div className="flex items-center space-x-3 font-mono">
          <Link href={isAuthenticated() ? "/dashboard" : "/register"} className="px-4 py-2 rounded border border-zinc-850 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold text-xs transition-all flex items-center space-x-1">
            <span>{isAuthenticated() ? "Console" : "Get Started"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Pricing Hero */}
      <section className="relative px-4 md:px-8 lg:px-12 pt-20 pb-28 max-w-7xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center space-x-2 bg-zinc-900/60 border border-zinc-800/80 px-2.5 py-1 rounded text-indigo-400 text-[10px] font-mono font-bold uppercase tracking-wider shadow-inner mx-auto">
          <span>flexible pricing tiers</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Select Your Reliability Ledger
        </h1>
        <p className="text-zinc-400 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
          Monitor distributed systems, discover webhook issues, and orchestrate SRE runbooks. Scale smoothly as your distributed workloads expand.
        </p>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 max-w-6xl mx-auto text-left items-stretch">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`border rounded-xl p-6 flex flex-col justify-between relative transition-all duration-300 ${
                tier.highlight
                  ? 'border-indigo-500/80 bg-indigo-950/5 shadow-lg shadow-indigo-950/20'
                  : 'border-zinc-900 bg-zinc-950/60 hover:border-zinc-800'
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3.5 left-6 bg-indigo-500 text-white font-mono text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  RECOMMENDED
                </span>
              )}

              <div className="space-y-4">
                <h3 className="font-mono text-zinc-300 font-extrabold uppercase text-xs tracking-wider">
                  {tier.name}
                </h3>
                <div className="flex items-baseline space-x-1 font-mono text-white">
                  <span className="text-4xl font-extrabold">{tier.price}</span>
                  {tier.period && <span className="text-zinc-500 text-xs">{tier.period}</span>}
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed">{tier.description}</p>
                <div className="border-t border-zinc-900/80 pt-4 space-y-2.5">
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex items-start space-x-2 text-zinc-300 text-xs">
                      <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 mt-auto">
                <Link
                  href={tier.href}
                  className={`w-full py-2.5 rounded text-xs font-mono font-bold text-center block transition-all ${
                    tier.highlight
                      ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-950 shadow-md'
                      : 'bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            </div>
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
