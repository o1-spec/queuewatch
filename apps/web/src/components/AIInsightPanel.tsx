import React from 'react';
import { Sparkles, Terminal, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

export interface AIAnalysisReport {
  timestamp: number;
  rootCause: string;
  severity: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  likelyImpact: string;
  recommendedFix: string;
  scalingRecommendation: string;
}

interface AIInsightPanelProps {
  report?: AIAnalysisReport | null;
  loading?: boolean;
}

export function AIInsightPanel({ report, loading = false }: AIInsightPanelProps) {
  // Render loading skeleton state
  if (loading) {
    return (
      <div className="glass-card p-6 rounded-2xl relative border border-slate-900 overflow-hidden min-h-[350px] flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-900/60 pb-4 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sparkles className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h3 className="font-bold text-white text-md">AI Observability Insights</h3>
              <p className="text-xs text-slate-400">Gemini LLM reliability analytics and code patches</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-slate-800 text-slate-500 animate-pulse">
            ANALYZING...
          </span>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center py-10 space-y-4">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-xs text-slate-400 animate-pulse">Compiling Redis queue counters & telemetry snapshots...</p>
        </div>
      </div>
    );
  }

  // If no report was passed down, use a healthy default report structure
  const activeReport = report || {
    timestamp: Date.now(),
    rootCause: 'All background threads operating within normal parameters.',
    severity: 'HEALTHY' as const,
    likelyImpact: 'Queue workloads processing within expected SLA latency thresholds. Heartbeats stable.',
    recommendedFix: '// All systems healthy. No code patches required.',
    scalingRecommendation: 'Current replica sets and concurrency bounds are balanced.',
  };

  const isCritical = activeReport.severity === 'CRITICAL';
  const isWarning = activeReport.severity === 'WARNING';
  const isHealthy = activeReport.severity === 'HEALTHY';

  return (
    <div className={`glass-card p-6 rounded-2xl relative border overflow-hidden ${
      isCritical ? 'border-rose-950/40 glow-rose/5' : isWarning ? 'border-amber-950/40' : 'border-slate-900'
    }`}>
      {/* Visual neon header */}
      <div className="flex items-center justify-between border-b border-slate-900/60 pb-4 mb-4">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-lg ${isHealthy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
            <Sparkles className={`w-5 h-5 ${isHealthy ? '' : 'animate-pulse'}`} />
          </div>
          <div>
            <h3 className="font-bold text-white text-md">AI Observability Insights</h3>
            <p className="text-xs text-slate-400">Gemini LLM reliability analytics and code patches</p>
          </div>
        </div>
        
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
          isCritical ? 'text-rose-400 bg-rose-950/20 border-rose-500/20 animate-pulse' :
          isWarning ? 'text-amber-400 bg-amber-950/20 border-amber-500/20' :
          'text-emerald-400 bg-emerald-950/20 border-emerald-500/20'
        }`}>
          {activeReport.severity}
        </span>
      </div>

      <div className="space-y-4">
        {/* Cause */}
        <div className="p-4 bg-slate-950/60 border border-slate-900/80 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isCritical ? (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              ) : isWarning ? (
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
              <h4 className="text-xs font-bold text-white font-mono">{activeReport.rootCause}</h4>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {new Date(activeReport.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed font-sans">{activeReport.likelyImpact}</p>
          
          {/* Remediation Plan */}
          <div className="bg-indigo-950/10 border border-indigo-500/10 p-3 rounded-lg text-[11px] text-indigo-200">
            <strong className="text-indigo-400 font-bold block mb-1">AI Remediation Plan:</strong>
            {activeReport.scalingRecommendation}
          </div>

          {/* Copyable fix */}
          {activeReport.recommendedFix && (
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-bold font-mono">
                <Terminal className="w-3.5 h-3.5" />
                <span>PROPOSED CODE LEVEL REPAIR</span>
              </div>
              <pre className="bg-black/40 border border-slate-900 p-3 rounded-lg text-[10px] font-mono text-cyan-400 overflow-x-auto select-all leading-normal whitespace-pre">
                {activeReport.recommendedFix}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIInsightPanel;
