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
      <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-lg flex flex-col justify-center items-center py-12 space-y-3">
        <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" />
        <p className="text-[10px] text-zinc-500 font-mono animate-pulse">Loading chronological AI incident events...</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-2">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-zinc-500" />
          <div>
            <h3 className="font-bold text-white text-xs font-mono">Incident History Log</h3>
            <p className="text-[10px] text-zinc-500 font-mono">Past system anomalies resolved by SRE</p>
          </div>
        </div>
        <button
          onClick={fetchTimeline}
          className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
          title="Refresh Timeline"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {timeline.length === 0 ? (
        <div className="text-center py-10 text-zinc-500 font-mono text-[10px] space-y-2">
          <div className="inline-flex p-2.5 rounded bg-zinc-900/60 text-emerald-400 border border-zinc-900">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="font-bold text-zinc-400">Zero active exceptions logged</p>
          <p className="text-[9px] text-zinc-600 max-w-xs mx-auto">
            Background workers operating normal parameters. Outage injection sandbox triggers report updates here.
          </p>
        </div>
      ) : (
        <div className="relative pl-4 border-l border-zinc-900 space-y-3.5 ml-1">
          {timeline.map((report, idx) => {
            const isExpanded = expandedId === idx;
            const isCritical = report.severity === 'CRITICAL';
            const isWarning = report.severity === 'WARNING';
            const timestampLabel = new Date(report.timestamp).toLocaleString();

            let severityBadge = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
            if (isCritical) {
              severityBadge = 'text-rose-400 bg-rose-950/20 border-rose-900/30';
            } else if (isWarning) {
              severityBadge = 'text-amber-400 bg-amber-950/20 border-amber-900/30';
            }

            return (
              <div key={idx} className="relative">
                <span className={`absolute -left-[23px] top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-zinc-950 border ${
                  isCritical ? 'border-rose-500' : isWarning ? 'border-amber-500' : 'border-emerald-500'
                }`}></span>

                <div className={`p-3.5 bg-zinc-950 border rounded transition-all ${
                  isExpanded ? 'border-zinc-700 bg-zinc-900/10' : 'border-zinc-900 hover:border-zinc-800'
                }`}>
                  <div className="flex items-center justify-between gap-3 text-[10px] font-mono">
                    <div className="flex items-center space-x-2 min-w-0">
                      <button 
                        onClick={() => toggleExpand(idx)}
                        className="text-zinc-500 hover:text-white transition-colors shrink-0"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase shrink-0 ${severityBadge}`}>
                        {report.severity}
                      </span>
                      <h4 className="font-bold text-white truncate min-w-0">{report.rootCause}</h4>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="text-zinc-500 text-[9px]">{timestampLabel}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3.5 border-t border-zinc-900 pt-3.5 space-y-3 font-mono text-[10px]">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Likely System Impact</span>
                        <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">{report.likelyImpact}</p>
                      </div>

                      <div className="bg-zinc-900/40 border border-zinc-900 p-2.5 rounded text-zinc-300">
                        <strong className="text-zinc-500 block mb-1">AI Remediation Fix Recommendation</strong>
                        {report.scalingRecommendation}
                      </div>

                      {report.recommendedFix && (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5 text-zinc-500 font-bold font-mono text-[9px]">
                            <Terminal className="w-3 h-3 text-zinc-600" />
                            <span>PROPOSED CODE CORRECTION</span>
                          </div>
                          <pre className="bg-black/40 border border-zinc-900 p-3 rounded text-[9.5px] font-mono text-zinc-400 overflow-x-auto select-all leading-normal whitespace-pre">
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
