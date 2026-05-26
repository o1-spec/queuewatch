import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertCircle, Clock, Sparkles, Terminal, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { AIAnalysisReport } from './AIInsightPanel';

import { useAuth } from '../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AIIncidentTimelineProps {
  refreshTrigger?: number;
}

export function AIIncidentTimeline({ refreshTrigger = 0 }: AIIncidentTimelineProps) {
  const { authFetch } = useAuth();
  const [timeline, setTimeline] = useState<AIAnalysisReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchTimeline = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/ai/timeline?limit=30`);
      if (res.ok) {
        const data = await res.json();
        setTimeline(data);
      }
    } catch (e) {
      console.error('Failed to load AI incidents timeline:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [refreshTrigger]);

  const toggleExpand = (idx: number) => {
    setExpandedId((prev) => (prev === idx ? null : idx));
  };

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-2xl flex flex-col justify-center items-center py-16 space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-xs text-slate-400 animate-pulse">Loading chronological AI incident events...</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-2xl border border-slate-900 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-900/60 pb-4 mb-4">
        <div className="flex items-center space-x-2.5">
          <Clock className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-bold text-white text-md">AI Incident Registry Timeline</h3>
            <p className="text-xs text-slate-400">Chronological list of past system anomalies captured in Redis list memory</p>
          </div>
        </div>
        <button
          onClick={fetchTimeline}
          className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white transition-colors"
          title="Refresh Timeline"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {timeline.length === 0 ? (
        <div className="text-center py-12 text-slate-500 font-medium text-xs space-y-2">
          <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="font-bold text-white">No historical AI anomalies logged</p>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            The background workers are operating normally. Once an outage or slowdown is injected, AI incident reports will appear here chronologically.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 border-l border-slate-900 space-y-6 ml-2">
          {timeline.map((report, idx) => {
            const isExpanded = expandedId === idx;
            const isCritical = report.severity === 'CRITICAL';
            const isWarning = report.severity === 'WARNING';
            const timestampLabel = new Date(report.timestamp).toLocaleString();

            return (
              <div key={idx} className="relative">
                {/* Timeline Bullet Node */}
                <span className={`absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border bg-slate-950 ${
                  isCritical ? 'border-rose-500 text-rose-500' : 
                  isWarning ? 'border-amber-500 text-amber-500' : 'border-emerald-500 text-emerald-500'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    isCritical ? 'bg-rose-500 animate-ping' : 
                    isWarning ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                  }`}></span>
                </span>

                {/* Timeline Card */}
                <div className={`p-4 bg-slate-950/45 border rounded-xl transition-all ${
                  isExpanded ? 'border-indigo-500/25 shadow-md shadow-indigo-500/5' : 'border-slate-900/80 hover:border-slate-800'
                }`}>
                  {/* Row Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center space-x-2.5">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase shrink-0 ${
                        isCritical ? 'text-rose-400 bg-rose-950/20 border-rose-500/20' :
                        isWarning ? 'text-amber-400 bg-amber-950/20 border-amber-500/20' :
                        'text-emerald-400 bg-emerald-950/20 border-emerald-500/20'
                      }`}>
                        {report.severity}
                      </span>
                      <h4 className="font-bold text-xs text-white font-mono break-all pr-4">{report.rootCause}</h4>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center">
                      <span className="text-[10px] text-slate-500 font-mono font-medium">{timestampLabel}</span>
                      <button
                        onClick={() => toggleExpand(idx)}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Body details */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-slate-900/60 pt-4 space-y-4 font-sans">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Likely System Impact</span>
                        <p className="text-[11px] text-slate-300 leading-normal">{report.likelyImpact}</p>
                      </div>

                      <div className="bg-indigo-950/15 border border-indigo-500/10 p-3 rounded-lg text-[11px] text-indigo-200">
                        <strong className="text-indigo-400 font-bold block mb-1">AI Remediation Fix Recommendation</strong>
                        {report.scalingRecommendation}
                      </div>

                      {report.recommendedFix && (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5 text-[9.5px] text-slate-500 font-bold font-mono">
                            <Terminal className="w-3.5 h-3.5" />
                            <span>PROPOSED CODE CORRECTION</span>
                          </div>
                          <pre className="bg-black/60 border border-slate-900 p-3 rounded-lg text-[10px] font-mono text-cyan-400 overflow-x-auto select-all leading-normal whitespace-pre">
                            {report.recommendedFix}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AIIncidentTimeline;
