'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Clock, History } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RecurringIncident } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RecurringIncidents() {
  const { authFetch } = useAuth();
  const [patterns, setPatterns] = useState<RecurringIncident[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPatterns = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/copilot/recurring-incidents`);
      if (res.ok) {
        setPatterns(await res.json());
      }
    } catch (e) {
      console.error('Failed to load patterns:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatterns();
  }, []);

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <History className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Recurring Incident Pattern Analyzer</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Identify recurring queue bottlenecks, identical exception traces, and chronic worker malfunctions.
          </p>
        </div>

        <button
          onClick={loadPatterns}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>RUN ANALYSIS</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg h-28"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {patterns.map((p) => (
            <div key={p.id} className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                  <h3 className="text-white text-xs font-bold uppercase">{p.pattern}</h3>
                  <span className="px-1.5 py-0.5 rounded text-[8px] bg-rose-950/20 border border-rose-900 text-rose-450 font-bold">
                    {p.frequency} Occurrences
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 font-sans text-xs">
                  <div className="space-y-1">
                    <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Typical Root Cause</span>
                    <p className="text-zinc-300">{p.rootCause}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Recommended Prevention</span>
                    <p className="text-indigo-400">{p.recommendedPrevention}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                <span className="text-zinc-550 text-[9px] uppercase font-bold">Last Observed</span>
                <span className="text-zinc-450 flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-zinc-600" />
                  <span>{new Date(p.lastOccurrence).toLocaleString()}</span>
                </span>
                <div className="text-zinc-550 text-[8px] mt-1">
                  Incident IDs: {p.incidentIds.join(', ')}
                </div>
              </div>
            </div>
          ))}

          {patterns.length === 0 && (
            <div className="bg-zinc-950 border border-zinc-900 p-12 rounded-lg text-center text-zinc-600 font-bold">
              No recurring patterns detected. All logged outages were isolated, single occurrences.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
