'use client';

import React, { useState, useEffect } from 'react';

export default function LandingLoader() {
  const [fading, setFading] = useState(false);
  const [done, setDone]     = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('qw_loaded')) {
      setDone(true);
      return;
    }

    const fadeTimer = setTimeout(() => setFading(true), 2200);
    const doneTimer = setTimeout(() => {
      setDone(true);
      sessionStorage.setItem('qw_loaded', '1');
    }, 2900);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (done) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Subtle dot-grid background */}
      <div className="absolute inset-0 [background-image:radial-gradient(#1c1c1e_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      <div className="relative flex flex-col items-center gap-8">

        {/* Logo with spinning ring */}
        <div className="relative flex items-center justify-center">
          {/* Outer spinning arc */}
          <svg
            className="absolute w-20 h-20 animate-spin"
            style={{ animationDuration: '1.4s' }}
            viewBox="0 0 80 80"
            fill="none"
          >
            <circle
              cx="40" cy="40" r="36"
              stroke="url(#arcGrad)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="140 86"
            />
            <defs>
              <linearGradient id="arcGrad" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#6366f100" />
              </linearGradient>
            </defs>
          </svg>

          {/* Inner static ring */}
          <svg className="absolute w-20 h-20 opacity-10" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="36" stroke="#6366f1" strokeWidth="1.5" />
          </svg>

          {/* Q Logo box */}
          <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center shadow-2xl">
            <span className="font-extrabold text-xl text-black leading-none">Q</span>
          </div>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-white font-extrabold text-base tracking-wider">QueueWatch</span>
          <span className="text-zinc-600 font-mono text-[10px] uppercase tracking-widest font-bold">
            Telemetry Engine
          </span>
        </div>

        {/* Animated dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-500"
              style={{
                animation: 'qw-bounce 1.1s ease-in-out infinite',
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes qw-bounce {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
