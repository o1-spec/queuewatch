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
  if (loading) {
    return (
      <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg overflow-hidden min-h-[300px] flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-zinc-500 animate-spin" />
            <div>
              <h3 className="font-bold text-white text-xs font-mono">AI Telemetry Diagnostics</h3>
              <p className="text-[10px] text-zinc-500 font-mono">Compiling active queue analysis</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[8px] font-mono border border-zinc-800 text-zinc-500 animate-pulse uppercase">
            analyzing
          </span>
        </div>

        <div className="flex-grow flex flex-col justify-center items-center py-8 space-y-3">
          <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" />
          <p className="text-[10px] text-zinc-500 font-mono">Compiling Redis queue counters & telemetry snapshots...</p>
        </div>
      </div>
    );
  }

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

  let severityBadge = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
  if (isCritical) {
    severityBadge = 'text-rose-400 bg-rose-950/20 border-rose-900/30 animate-pulse';
  } else if (isWarning) {
    severityBadge = 'text-amber-400 bg-amber-950/20 border-amber-900/30';
  }

  return (
    <div className={`bg-zinc-950 border rounded-lg p-5 transition-all ${
      isCritical ? 'border-rose-950' : isWarning ? 'border-amber-950' : 'border-zinc-900'
    }`}>
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-zinc-500" />
          <div>
            <h3 className="font-bold text-white text-xs font-mono">AI Telemetry Diagnostics</h3>
            <p className="text-[10px] text-zinc-500 font-mono">Automated root-cause exception analysis</p>
          </div>
        </div>
        
        <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold border uppercase tracking-wider ${severityBadge}`}>
          {activeReport.severity}
        </span>
      </div>

      <div className="space-y-3 font-mono text-[10px]">
        <div className="p-3.5 bg-zinc-900/20 border border-zinc-900 rounded space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <div className="flex items-center space-x-2">
              {isCritical || isWarning ? (
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
              <h4 className="font-bold text-white font-mono break-all">{activeReport.rootCause}</h4>
            </div>
            <span className="text-zinc-600 text-[9px]">
              {new Date(activeReport.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <p className="text-zinc-400 font-sans text-[11px] leading-relaxed">{activeReport.likelyImpact}</p>
          
          <div className="bg-zinc-900/40 border border-zinc-900 p-2.5 rounded text-zinc-300 font-mono leading-normal">
            <strong className="text-zinc-500 block mb-1">REMEDIATION RECOMMENDATION:</strong>
            {activeReport.scalingRecommendation}
          </div>

          {activeReport.recommendedFix && (
            <div className="space-y-1 mt-2">
              <div className="flex items-center space-x-1.5 text-zinc-500 font-bold font-mono">
                <Terminal className="w-3 h-3 text-zinc-600" />
                <span>CODE-LEVEL REPAIR BLUEPRINT</span>
              </div>
              <pre className="bg-black/40 border border-zinc-900 p-3 rounded text-[9.5px] font-mono text-zinc-400 overflow-x-auto select-all leading-normal whitespace-pre">
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
