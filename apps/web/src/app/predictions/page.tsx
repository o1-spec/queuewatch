'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Layers, ShieldAlert, Sparkles, AlertTriangle, Play, HelpCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Prediction } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function PredictionsConsole() {
  const { authFetch } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorizedAction, setAuthorizedAction] = useState<string | null>(null);

  const loadPredictions = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/predictions`);
      if (res.ok) {
        setPredictions(await res.json());
      }
    } catch (e) {
      console.error('Failed to load predictions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPredictions();
  }, []);

  const handleActionClick = (actionName: string) => {
    setAuthorizedAction(actionName);
    setTimeout(() => setAuthorizedAction(null), 4000);
  };

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
            <span>Predictive Reliability Engine Warnings</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Deterministic SRE heuristics evaluate backlog velocities, exception signals, and resources to warn of future incidents.
          </p>
        </div>

        <button
          onClick={loadPredictions}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>RECALCULATE PREDICTIONS</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Active Predictions List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg">
            <h3 className="font-bold text-white text-xs uppercase tracking-tight border-b border-zinc-900 pb-3 mb-4">
              Active Saturation & Health Warnings
            </h3>

            {loading ? (
              <div className="text-center py-8 text-zinc-650 animate-pulse">evaluating heuristics...</div>
            ) : (
              <div className="space-y-5">
                {predictions.map((pred) => (
                  <div key={pred.id} className="p-4 bg-zinc-900/10 border border-zinc-900 rounded-lg space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-white text-[11px] uppercase tracking-tight">{pred.title}</h4>
                        <p className="text-zinc-550 text-[9px] mt-0.5">
                          Target Subsystem: <strong className="text-zinc-350">{pred.targetQueue || pred.targetService || 'Global'}</strong>
                        </p>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <span className="text-zinc-500 uppercase text-[8px] font-bold block">RISK INDEX</span>
                          <span className={`font-bold text-sm ${pred.riskScore >= 75 ? 'text-rose-400' : 'text-amber-500'}`}>
                            {pred.riskScore}%
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-zinc-500 uppercase text-[8px] font-bold block">CONFIDENCE</span>
                          <span className="font-bold text-zinc-400 text-sm">
                            {pred.confidenceScore}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-black/40 border border-zinc-900 rounded space-y-1 text-zinc-400 leading-relaxed font-sans text-xs">
                      <p><strong>Predictive Cause:</strong> {pred.reason}</p>
                      <p><strong>Estimated Impact:</strong> {pred.estimatedImpact}</p>
                    </div>

                    {/* Suggested Prevention Steps */}
                    <div className="space-y-2">
                      <span className="text-zinc-500 uppercase text-[8px] font-bold block font-mono">Suggested Prevention Recommendations</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {pred.recommendedActions.map((act, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleActionClick(act)}
                            className="text-left p-2.5 rounded bg-zinc-900 hover:bg-zinc-850 text-indigo-400 font-bold border border-zinc-850 hover:text-white transition-all text-[8.5px] uppercase flex items-center justify-between"
                          >
                            <span>{act}</span>
                            <span className="text-[7.5px] text-zinc-500 shrink-0 ml-1">&bull; EXECUTE</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {predictions.length === 0 && (
                  <div className="text-center py-10 text-zinc-650">
                    No predictive warning flags active. All subsystems are processing load within SLAs.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Manual Confirmation Safety Notice */}
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3">
            <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              <span>SRE Operational Guard</span>
            </h3>
            <p className="text-zinc-500 font-sans text-xs leading-normal">
              Predictive reliability warnings calculate queue velocity derivatives and thread locks to foresee incidents.
            </p>
            <div className="bg-black/40 border border-zinc-900 p-3 rounded text-[9px] text-zinc-400 leading-normal">
              💡 <b>Safety Guideline:</b> Actions recommended by the engine must be evaluated and triggered manually by engineers. No autonomous recovery is supported.
            </div>
          </div>

          {/* Action trigger feedback */}
          {authorizedAction && (
            <div className="bg-amber-950/20 border border-amber-900/60 p-4 rounded-lg font-sans text-xs text-amber-400 leading-normal">
              ⚠️ <b>Manual Action Warning:</b> Execute <i>&quot;{authorizedAction}&quot;</i> inside your terminal or deployment pipeline manually. QueueWatch does not run destructive operations autonomously.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
