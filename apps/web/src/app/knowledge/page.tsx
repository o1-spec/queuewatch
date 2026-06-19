'use client';

import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, BookOpen, Clock, AlertCircle, TrendingUp, History, ShieldAlert, Cpu, Award, Activity, FileText, CheckCircle2, Users, BarChart3, LayoutGrid } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { KnowledgeEntry, RecurringIncident } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function KnowledgeExplorer() {
  const { authFetch } = useAuth();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [trends, setTrends] = useState<any>(null);
  const [recurringPatterns, setRecurringPatterns] = useState<RecurringIncident[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'incidents' | 'patterns' | 'reports'>('incidents');

  const loadData = async () => {
    try {
      setLoading(true);
      const [entriesRes, trendsRes, recurringRes, articlesRes, reportsRes] = await Promise.all([
        authFetch(`${API_URL}/api/copilot/knowledge-base`),
        authFetch(`${API_URL}/api/copilot/reliability-trends`),
        authFetch(`${API_URL}/api/copilot/recurring-incidents`),
        authFetch(`${API_URL}/api/copilot/knowledge-articles`),
        authFetch(`${API_URL}/api/copilot/reliability-reports`),
      ]);

      if (entriesRes.ok) setEntries(await entriesRes.json());
      if (trendsRes.ok) setTrends(await trendsRes.json());
      if (recurringRes.ok) setRecurringPatterns(await recurringRes.json());
      if (articlesRes.ok) setArticles(await articlesRes.json());
      if (reportsRes.ok) setReportData(await reportsRes.json());
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
      (entry.preventionRecommendation && entry.preventionRecommendation.toLowerCase().includes(query)) ||
      (entry.lessonsLearned?.whatHappened && entry.lessonsLearned.whatHappened.toLowerCase().includes(query)) ||
      (entry.lessonsLearned?.whatFixedIt && entry.lessonsLearned.whatFixedIt.toLowerCase().includes(query))
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
            <span>SRE Reliability Knowledge Base & Intel</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5 font-sans">
            Search operational outcomes, explore recurring failure patterns, audit weekly reliability reports, and access automated articles.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>SYNC KNOWLEDGE</span>
        </button>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-zinc-900 gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('incidents')}
          className={`px-4 py-2 font-bold uppercase transition-all flex items-center gap-1.5 border-b-2 text-[10px] shrink-0 ${
            activeTab === 'incidents'
              ? 'border-indigo-500 text-white bg-indigo-950/10'
              : 'border-transparent text-zinc-550 hover:text-zinc-350'
          }`}
        >
          <History className="w-3.5 h-3.5 text-indigo-400" />
          <span>Incident Postmortems</span>
        </button>
        <button
          onClick={() => setActiveTab('patterns')}
          className={`px-4 py-2 font-bold uppercase transition-all flex items-center gap-1.5 border-b-2 text-[10px] shrink-0 ${
            activeTab === 'patterns'
              ? 'border-indigo-500 text-white bg-indigo-950/10'
              : 'border-transparent text-zinc-550 hover:text-zinc-350'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
          <span>Patterns & Articles</span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 font-bold uppercase transition-all flex items-center gap-1.5 border-b-2 text-[10px] shrink-0 ${
            activeTab === 'reports'
              ? 'border-indigo-500 text-white bg-indigo-950/10'
              : 'border-transparent text-zinc-550 hover:text-zinc-350'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-indigo-400" />
          <span>Reports & Leaderboard</span>
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
          {/* TAB 1: INCIDENTS HISTORY */}
          {activeTab === 'incidents' && (
            <div className="space-y-4">
              {/* Search Box */}
              <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg flex items-center space-x-2.5 shadow-md">
                <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Search postmortems, root causes, actions taken, lessons learned feedback..."
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
                    <div key={entry.id} className="bg-zinc-950/40 border border-zinc-900 rounded-lg p-5 space-y-4 shadow hover:border-zinc-800 transition-all backdrop-blur-md">
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
                          {(entry.recoveryTime !== undefined || entry.resolutionTimeMin !== undefined) && (
                            <span className="text-zinc-500 text-[9px] font-mono">
                              Recovery Time: <strong className="text-zinc-350">{entry.recoveryTime ?? entry.resolutionTimeMin} min</strong>
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

                      {/* Lessons Learned postmortem feedback section */}
                      {isExpanded && entry.lessonsLearned && (
                        <div className="border-t border-zinc-900/60 pt-4 bg-indigo-950/5 border border-indigo-900/10 p-4 rounded-lg space-y-2.5">
                          <span className="text-indigo-400 font-mono text-[9px] uppercase font-bold block flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Operational Learning Feedback</span>
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-normal">
                            <div>
                              <strong className="text-[9px] font-mono text-zinc-500 uppercase block">What Happened?</strong>
                              <p className="text-zinc-350 font-sans mt-1 bg-black/20 p-2 border border-zinc-900 rounded">{entry.lessonsLearned.whatHappened}</p>
                            </div>
                            <div>
                              <strong className="text-[9px] font-mono text-zinc-500 uppercase block">What Fixed It?</strong>
                              <p className="text-zinc-350 font-sans mt-1 bg-black/20 p-2 border border-zinc-900 rounded">{entry.lessonsLearned.whatFixedIt}</p>
                            </div>
                            <div>
                              <strong className="text-[9px] font-mono text-zinc-500 uppercase block">What to do differently next time?</strong>
                              <p className="text-indigo-350 font-sans mt-1 bg-black/20 p-2 border border-zinc-900 rounded">{entry.lessonsLearned.differentlyNextTime}</p>
                            </div>
                          </div>
                        </div>
                      )}

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

                              {entry.runbooksExecuted && entry.runbooksExecuted.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Runbooks Executed</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {entry.runbooksExecuted.map((title, i) => (
                                      <span key={i} className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-950/20 border border-indigo-900/60 text-indigo-350 font-mono uppercase">
                                        {title}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {entry.finalOutcome && (
                                <div className="space-y-1">
                                  <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Final Outcome</span>
                                  <p className="text-emerald-450 font-mono text-[10px] leading-relaxed">{entry.finalOutcome}</p>
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
            </div>
          )}

          {/* TAB 2: PATTERNS & ARTICLES */}
          {activeTab === 'patterns' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recurring failure patterns */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-4 shadow-lg">
                <h3 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  <span>Reliability Patterns Engine</span>
                </h3>
                
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {recurringPatterns.length > 0 ? (
                    recurringPatterns.map((pattern) => (
                      <div key={pattern.id} className="p-3.5 border border-zinc-900 bg-black/30 rounded-lg space-y-3 shadow-inner">
                        <div className="flex justify-between items-center border-b border-zinc-900/50 pb-2">
                          <span className="font-bold text-white text-[10px] uppercase font-mono">{pattern.pattern}</span>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-rose-950/40 border border-rose-900 text-rose-350 uppercase">
                              Occurrences: {pattern.occurrences ?? pattern.frequency}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-950/40 border border-emerald-900 text-emerald-350 uppercase">
                              Success: {pattern.successRate ?? 100}%
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1.5 text-xs font-sans text-zinc-400 leading-normal">
                          <p><strong className="text-[9px] font-mono text-zinc-550 uppercase">Common Root Cause:</strong> {pattern.rootCause}</p>
                          <p><strong className="text-[9px] font-mono text-zinc-550 uppercase">Recommended Resolution:</strong> {pattern.recommendedResolution ?? 'Perform node reset and examine memory tags.'}</p>
                          <p><strong className="text-[9px] font-mono text-zinc-550 uppercase">Average Recovery Time:</strong> {pattern.averageRecoveryTime ?? 12} minutes</p>
                          <p><strong className="text-[9px] font-mono text-zinc-550 uppercase">Preventions:</strong> {pattern.recommendedPrevention}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-650 text-[10px] font-sans italic text-center py-6">No recurring pattern aggregates observed yet.</p>
                  )}
                </div>
              </div>

              {/* SRE Knowledge Articles */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-4 shadow-lg">
                <h3 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>SRE Knowledge Articles</span>
                </h3>
                
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {articles.length > 0 ? (
                    articles.map((art, idx) => (
                      <div key={idx} className="p-4 border border-zinc-900 bg-zinc-950/50 rounded-lg space-y-3">
                        <span className="font-bold text-indigo-400 text-[10px] uppercase font-mono block border-b border-zinc-900/60 pb-1.5">{art.pattern}</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs leading-normal">
                          <div className="space-y-1">
                            <strong className="text-[8.5px] font-mono text-zinc-500 uppercase block">Common Symptoms</strong>
                            <ul className="list-disc list-inside space-y-0.5 text-zinc-400 font-sans pl-0.5">
                              {art.symptoms.map((s: string, i: number) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                          <div className="space-y-1">
                            <strong className="text-[8.5px] font-mono text-zinc-500 uppercase block">Likely Causes</strong>
                            <ul className="list-disc list-inside space-y-0.5 text-zinc-400 font-sans pl-0.5">
                              {art.causes.map((c: string, i: number) => <li key={i}>{c}</li>)}
                            </ul>
                          </div>
                          <div className="space-y-1">
                            <strong className="text-[8.5px] font-mono text-zinc-500 uppercase block">Successful Resolutions</strong>
                            <ul className="list-disc list-inside space-y-0.5 text-emerald-400 font-sans pl-0.5">
                              {art.resolutions.map((r: string, i: number) => <li key={i}>{r}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-650 text-[10px] font-sans italic text-center py-6">No articles compiled yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REPORTS & LEADERBOARD */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Aggregates row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Reliability Score */}
                <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg flex items-center space-x-4 shadow">
                  <div className="p-3.5 rounded bg-indigo-950/20 border border-indigo-900/60 text-indigo-400 shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Average Reliability Score</span>
                    <h4 className="text-lg font-bold text-white mt-1">
                      {reportData?.weeklySummary?.averageReliabilityScore ?? 91}%
                    </h4>
                  </div>
                </div>

                {/* MTTR */}
                <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg flex items-center space-x-4 shadow">
                  <div className="p-3.5 rounded bg-amber-950/20 border border-amber-900/60 text-amber-400 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Mean Time To Recovery (MTTR)</span>
                    <h4 className="text-lg font-bold text-white mt-1">
                      {reportData?.weeklySummary?.meanTimeToRecoveryMin ?? 12} Minutes
                    </h4>
                  </div>
                </div>

                {/* Total Incidents */}
                <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg flex items-center space-x-4 shadow">
                  <div className="p-3.5 rounded bg-rose-950/20 border border-rose-900/60 text-rose-400 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Weekly Incident Sightings</span>
                    <h4 className="text-lg font-bold text-white mt-1">
                      {totalIncidents} Outages
                    </h4>
                  </div>
                </div>
              </div>

              {/* Weekly Reports: Frequent Failures */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-4 shadow">
                <h3 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <span>Most Frequent Weekly Failures</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {reportData?.weeklySummary?.frequentFailures?.map((fail: any, i: number) => {
                    const pct = totalIncidents > 0 ? Math.round((fail.occurrences / totalIncidents) * 100) : 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-zinc-400 uppercase">
                          <span>{fail.name}</span>
                          <span>{fail.occurrences} occurrences ({pct}%)</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-900/40 rounded-full overflow-hidden border border-zinc-900">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              i === 0 ? 'bg-rose-500' : i === 1 ? 'bg-amber-500' : i === 2 ? 'bg-indigo-500' : 'bg-zinc-550'
                            }`} 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leaderboards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Stable Services Leaderboard */}
                <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-3 shadow">
                  <h4 className="text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                    <Award className="w-4 h-4 text-indigo-400" />
                    <span>Most Stable Services</span>
                  </h4>
                  <div className="space-y-2">
                    {reportData?.leaderboard?.mostStableServices?.length > 0 ? (
                      reportData.leaderboard.mostStableServices.map((svc: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-2 border border-zinc-900/50 bg-black/20 rounded">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-zinc-550 text-[10px]">#{i+1}</span>
                            <span className="text-zinc-300 uppercase font-mono">{svc.name}</span>
                          </div>
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] font-mono ${
                            svc.score >= 95 ? 'bg-emerald-950 border border-emerald-900 text-emerald-400' : 'bg-amber-950 border border-amber-900 text-amber-400'
                          }`}>
                            {svc.score}% SLA
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-zinc-650 text-[9px] italic py-2">No service SLA logs gathered yet.</p>
                    )}
                  </div>
                </div>

                {/* Fastest Recovery Teams Leaderboard */}
                <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-3 shadow">
                  <h4 className="text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>Fastest Recovery SRE Teams</span>
                  </h4>
                  <div className="space-y-2">
                    {reportData?.leaderboard?.fastestRecoveryTeams?.map((team: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-2 border border-zinc-900/50 bg-black/20 rounded">
                        <span className="text-zinc-300 font-sans">{team.name}</span>
                        <span className="text-indigo-400 font-bold font-mono text-[9px] bg-indigo-950/20 border border-indigo-900/60 px-1.5 py-0.5 rounded">
                          {team.averageRecoveryTime}m MTTR
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Most Effective Runbooks Leaderboard */}
                <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-3 shadow">
                  <h4 className="text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                    <span>Most Effective Runbooks</span>
                  </h4>
                  <div className="space-y-2">
                    {reportData?.leaderboard?.mostEffectiveRunbooks?.map((rb: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-2 border border-zinc-900/50 bg-black/20 rounded">
                        <span className="text-zinc-300 font-sans truncate max-w-[200px]">{rb.title}</span>
                        <div className="flex items-center gap-2 font-mono text-[9px]">
                          <span className="text-emerald-400 bg-emerald-950/10 px-1 py-0.5 border border-emerald-900/50 rounded">
                            {rb.completionRate}% Comp
                          </span>
                          <span className="text-zinc-500">
                            {rb.recoveryTimeMin}m
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Most Frequent Incident Sources */}
                <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-3 shadow">
                  <h4 className="text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                    <LayoutGrid className="w-4 h-4 text-indigo-400" />
                    <span>Most Frequent Incident Sources</span>
                  </h4>
                  <div className="space-y-2">
                    {reportData?.leaderboard?.frequentIncidentSources?.length > 0 ? (
                      reportData.leaderboard.frequentIncidentSources.map((src: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-2 border border-zinc-900/50 bg-black/20 rounded">
                          <span className="text-zinc-300 font-mono">{src.name}</span>
                          <span className="text-rose-450 font-bold font-mono text-[9px] bg-rose-950/20 border border-rose-900/60 px-1.5 py-0.5 rounded">
                            {src.count} Incidents
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-zinc-650 text-[9px] italic py-2">No active failures detected.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
