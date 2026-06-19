'use client';

import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, BookOpen, Clock, AlertCircle, TrendingUp, History, ShieldAlert, Cpu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { KnowledgeEntry, RecurringIncident } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function KnowledgeExplorer() {
  const { authFetch } = useAuth();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [trends, setTrends] = useState<any>(null);
  const [recurringPatterns, setRecurringPatterns] = useState<RecurringIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [entriesRes, trendsRes, recurringRes] = await Promise.all([
        authFetch(`${API_URL}/api/copilot/knowledge-base`),
        authFetch(`${API_URL}/api/copilot/reliability-trends`),
        authFetch(`${API_URL}/api/copilot/recurring-incidents`),
      ]);

      if (entriesRes.ok) setEntries(await entriesRes.json());
      if (trendsRes.ok) setTrends(await trendsRes.json());
      if (recurringRes.ok) setRecurringPatterns(await recurringRes.json());
    } catch (e) {
      console.error('Failed to load knowledge metrics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredEntries = entries.filter((entry) => {
    const query = searchQuery.toLowerCase();
    return (
      entry.title.toLowerCase().includes(query) ||
      entry.pattern.toLowerCase().includes(query) ||
      entry.rootCause.toLowerCase().includes(query) ||
      entry.resolution.toLowerCase().includes(query) ||
      (entry.preventionRecommendation && entry.preventionRecommendation.toLowerCase().includes(query))
    );
  });

  const categories = trends?.categories || {
    deploymentRegressions: 0,
    databaseIssues: 0,
    workerSaturation: 0,
    dlqGrowth: 0,
    other: 0,
  };
  const totalIncidents = trends?.totalIncidents || 0;

  const getPercentage = (count: number) => {
    if (totalIncidents === 0) return 0;
    return Math.round((count / totalIncidents) * 100);
  };

  return (
    <div className="space-y-6 font-mono text-[10px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>SRE Knowledge Explorer & Memory Space</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5 font-sans">
            Explore reliability trends, recurring root cause patterns, and searchable resolutions derived from resolved incident telemetry.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>REFRESH BASE</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 h-48"></div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 h-48"></div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 h-64 lg:col-span-2"></div>
        </div>
      ) : (
        <>
          {/* Top Grid: Trends Distribution & Recurring Failure Patterns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Failure category distribution trends */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-4 shadow-lg backdrop-blur-md bg-zinc-950/20">
              <h3 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>Failure Category Distribution Trends (Last {totalIncidents} Incidents)</span>
              </h3>
              
              <div className="space-y-3">
                {/* Deployment Regressions */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-zinc-400 uppercase">
                    <span>Deployment Regressions</span>
                    <span>{categories.deploymentRegressions} ({getPercentage(categories.deploymentRegressions)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900/40 rounded-full overflow-hidden border border-zinc-900">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                      style={{ width: `${getPercentage(categories.deploymentRegressions)}%` }}
                    />
                  </div>
                </div>
                
                {/* Database Issues */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-zinc-400 uppercase">
                    <span>Database Issues</span>
                    <span>{categories.databaseIssues} ({getPercentage(categories.databaseIssues)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900/40 rounded-full overflow-hidden border border-zinc-900">
                    <div 
                      className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                      style={{ width: `${getPercentage(categories.databaseIssues)}%` }}
                    />
                  </div>
                </div>

                {/* Worker Saturation */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-zinc-400 uppercase">
                    <span>Worker Saturation</span>
                    <span>{categories.workerSaturation} ({getPercentage(categories.workerSaturation)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900/40 rounded-full overflow-hidden border border-zinc-900">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                      style={{ width: `${getPercentage(categories.workerSaturation)}%` }}
                    />
                  </div>
                </div>

                {/* DLQ Growth */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-zinc-400 uppercase">
                    <span>DLQ Growth</span>
                    <span>{categories.dlqGrowth} ({getPercentage(categories.dlqGrowth)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900/40 rounded-full overflow-hidden border border-zinc-900">
                    <div 
                      className="h-full bg-yellow-500 rounded-full transition-all duration-500" 
                      style={{ width: `${getPercentage(categories.dlqGrowth)}%` }}
                    />
                  </div>
                </div>

                {/* Other */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-zinc-400 uppercase">
                    <span>Other</span>
                    <span>{categories.other} ({getPercentage(categories.other)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900/40 rounded-full overflow-hidden border border-zinc-900">
                    <div 
                      className="h-full bg-zinc-500 rounded-full transition-all duration-500" 
                      style={{ width: `${getPercentage(categories.other)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Recurring failure patterns */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-4 shadow-lg backdrop-blur-md bg-zinc-950/20">
              <h3 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Detected Recurring Failure Patterns</span>
              </h3>
              
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                {recurringPatterns.length > 0 ? (
                  recurringPatterns.map((pattern) => (
                    <div key={pattern.id} className="p-3 border border-zinc-900 bg-black/30 rounded-lg space-y-2">
                      <div className="flex justify-between items-center border-b border-zinc-900/50 pb-1.5">
                        <span className="font-bold text-zinc-350 text-[10px] uppercase font-mono">{pattern.pattern}</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-950/40 border border-rose-900 text-rose-455 uppercase">
                          Frequency: {pattern.frequency}x
                        </span>
                      </div>
                      <div className="space-y-1 text-xs font-sans text-zinc-400 leading-normal">
                        <p><strong className="text-[9px] font-mono text-zinc-550 uppercase">Common Root Cause:</strong> {pattern.rootCause}</p>
                        <p><strong className="text-[9px] font-mono text-zinc-550 uppercase">Preventions:</strong> {pattern.recommendedPrevention}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-650 text-[10px] font-sans italic text-center py-6">No recurring pattern aggregates observed yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg flex items-center space-x-2.5">
            <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <input
              type="text"
              placeholder="Search patterns, root causes, resolution action strings, prevention recommendations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-white focus:outline-none placeholder-zinc-700 text-xs font-sans"
            />
          </div>

          {/* Expandable list of resolved learnings */}
          <div className="space-y-3">
            {filteredEntries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              return (
                <div key={entry.id} className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-4 shadow hover:border-zinc-800 transition-all">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <button 
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="text-left font-bold text-white text-xs uppercase hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                      >
                        <span>{entry.title}</span>
                      </button>
                      <p className="text-zinc-500 text-[8.5px] font-sans mt-1">
                        Pattern Match: <code className="text-rose-400/90 font-mono">{entry.pattern}</code>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-zinc-650 flex items-center space-x-1 text-[9px] font-sans">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                      </span>
                      {entry.resolutionTimeMin !== undefined && (
                        <span className="text-zinc-500 text-[9px] font-mono">
                          Resolved in: <strong className="text-zinc-350">{entry.resolutionTimeMin} min</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 font-sans text-xs">
                    <div className="space-y-1">
                      <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Historical Root Cause</span>
                      <p className="text-zinc-350">{entry.rootCause}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-555 font-mono text-[9px] uppercase font-bold block">Resolution Action Taken</span>
                      <p className="text-zinc-300 font-mono text-[10px] bg-black/40 border border-zinc-900 p-2.5 rounded break-all select-all">{entry.resolution}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Prevention Recommendation</span>
                      <p className="text-indigo-400">{entry.preventionRecommendation}</p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-zinc-900 pt-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        <div className="space-y-3 font-sans text-xs">
                          {entry.reliabilityImpact && (
                            <div className="space-y-1">
                              <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Reliability & SLA Impact</span>
                              <p className="text-zinc-350">{entry.reliabilityImpact}</p>
                            </div>
                          )}
                          
                          {entry.blastRadius && entry.blastRadius.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Impacted Downstream Services</span>
                              <div className="flex flex-wrap gap-1.5">
                                {entry.blastRadius.map((svc) => (
                                  <span key={svc} className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-950/20 border border-rose-900/60 text-rose-350 font-mono uppercase">
                                    {svc}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {entry.hypotheses && entry.hypotheses.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Hypotheses Explored</span>
                              <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-1">
                                {entry.hypotheses.map((hyp, i) => (
                                  <li key={i}>{hyp}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {entry.evidence && (
                          <div className="space-y-1.5">
                            <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Audited Telemetry Evidence</span>
                            <pre className="bg-rose-950/5 border border-rose-900/10 p-3 rounded text-[9px] text-rose-350 font-mono overflow-x-auto max-h-48 leading-relaxed select-all">
                              {entry.evidence}
                            </pre>
                          </div>
                        )}

                      </div>
                    </div>
                  )}

                  <div className="text-zinc-650 text-[8.5px] border-t border-zinc-900/60 pt-2.5 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3 text-zinc-650" />
                      <span>Linked Incident ID Reference:</span>
                      <span className="font-mono text-zinc-450 font-bold">{entry.incidentId}</span>
                    </div>
                    <button 
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="text-indigo-400 hover:text-white transition-colors uppercase font-mono text-[8px] font-bold"
                    >
                      {isExpanded ? 'Collapse Details' : 'Expand Details'}
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredEntries.length === 0 && (
              <div className="bg-zinc-950 border border-zinc-900 p-12 rounded-lg text-center text-zinc-600 font-bold">
                No matching knowledge base records found.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
