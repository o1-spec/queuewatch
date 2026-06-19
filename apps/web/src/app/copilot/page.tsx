'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles, Send, RefreshCw, Terminal, CheckCircle2, ShieldAlert, Cpu, GitCommit,
  AlertTriangle, GitMerge, Percent, FileText, Play, Activity, Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CopilotResponse, EvidenceItem, ActionRecommendation, CopilotLogEntry } from '@queuewatch/shared';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ReliabilityCopilot() {
  const { authFetch } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [response, setResponse] = useState<CopilotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [logsList, setLogsList] = useState<CopilotLogEntry[]>([]);
  const [highlightedEvidenceIds, setHighlightedEvidenceIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'graph' | 'evidence' | 'hypotheses' | 'recovery'>('timeline');

  // Recommended Action Confirmation states
  const [selectedAction, setSelectedAction] = useState<ActionRecommendation | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [confirmedAction, setConfirmedAction] = useState<string | null>(null);

  const loadSuggestions = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/copilot/suggestions`);
      if (res.ok) {
        setSuggestions(await res.json());
      }
    } catch (e) {
      console.error('Failed to load suggestions:', e);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/copilot/logs`);
      if (res.ok) {
        setLogsList(await res.json());
      }
    } catch (e) {
      console.error('Failed to load copilot logs:', e);
    }
  };

  useEffect(() => {
    loadSuggestions();
    loadLogs();
  }, []);

  const handleQuerySubmit = async (promptText: string) => {
    if (!promptText) return;
    setLoading(true);
    setResponse(null);
    setSelectedAction(null);
    setExecutionLogs([]);
    setConfirmedAction(null);
    setHighlightedEvidenceIds([]);
    setActiveTab('timeline');

    try {
      const res = await authFetch(`${API_URL}/api/copilot/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });

      if (res.ok) {
        const data = await res.json();
        setResponse(data);
        loadLogs(); // Refresh history logs
      }
    } catch (e) {
      console.error('Failed to query copilot:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async (action: ActionRecommendation) => {
    setExecuting(true);
    setExecutionLogs([
      `[SRE-GATEWAY] Initializing confirmation protocol for action: ${action.type.toUpperCase()}`,
      `[SRE-GATEWAY] Target context: ${action.queueName || action.incidentId || 'GLOBAL'}`,
      `[SRE-GATEWAY] Verification status: ENGINEER_CONFIRMED_IN_LOOP`,
      `[SRE-GATEWAY] Connecting to QueueWatch control API...`
    ]);

    try {
      let success = true;
      let outputMsg = '';

      if (action.type === 'pause_queue' && action.queueName) {
        const res = await authFetch(`${API_URL}/api/queues/${action.queueName}/pause`, { method: 'POST' });
        if (res.ok) {
          outputMsg = `Queue "${action.queueName}" paused successfully.`;
        } else {
          success = false;
          outputMsg = `Failed to pause queue: HTTP status ${res.status}`;
        }
      } else if (action.type === 'ack_incident' && action.incidentId) {
        const res = await authFetch(`${API_URL}/api/incidents/${action.incidentId}/acknowledge`, { method: 'PATCH' });
        if (res.ok) {
          outputMsg = `Incident #${action.incidentId} acknowledged successfully.`;
        } else {
          success = false;
          outputMsg = `Failed to acknowledge incident: HTTP status ${res.status}`;
        }
      } else {
        // Simulated execution for actions like reducing concurrency or git diff audit
        await new Promise(resolve => setTimeout(resolve, 1500));
        outputMsg = `Simulated execution completed: "${action.description}"`;
      }

      if (success) {
        setExecutionLogs(prev => [
          ...prev,
          `[SRE-GATEWAY] Dispatching command payload: ${action.command || 'N/A'}`,
          `[SRE-GATEWAY] SUCCESS: ${outputMsg}`,
          `[SRE-GATEWAY] Status: RECOVERY_MONITORING_ACTIVE`
        ]);
        setConfirmedAction(action.description);
      } else {
        setExecutionLogs(prev => [
          ...prev,
          `[SRE-GATEWAY] ERROR: ${outputMsg}`,
          `[SRE-GATEWAY] Status: TERMINATED_WITH_ERRORS`
        ]);
      }
    } catch (err: any) {
      setExecutionLogs(prev => [
        ...prev,
        `[SRE-GATEWAY] CRITICAL: ${err.message}`,
        `[SRE-GATEWAY] Status: TERMINATED_EXCEPTION`
      ]);
    } finally {
      setExecuting(false);
    }
  };

  const getEvidenceIcon = (type: string) => {
    switch (type) {
      case 'incident': return <AlertTriangle className="w-3.5 h-3.5 text-rose-450 shrink-0" />;
      case 'log': return <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'deployment': return <GitCommit className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case 'score': return <Percent className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'graph': return <GitMerge className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      default: return <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />;
    }
  };

  const getEvidenceBadgeStyle = (type: string) => {
    switch (type) {
      case 'incident': return 'bg-rose-950/20 border-rose-900/40 text-rose-400';
      case 'log': return 'bg-amber-950/20 border-amber-900/40 text-amber-400';
      case 'deployment': return 'bg-indigo-950/20 border-indigo-900/40 text-indigo-400';
      case 'score': return 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400';
      case 'graph': return 'bg-purple-950/20 border-purple-900/40 text-purple-400';
      default: return 'bg-zinc-900 border-zinc-800 text-zinc-400';
    }
  };

  const getRank = (ev: EvidenceItem) => ev.rank || (ev.type === 'incident' || ev.type === 'log' ? 'primary' : ev.type === 'deployment' ? 'secondary' : 'context');

  const getConfidenceColorClass = (confidence: number) => {
    if (confidence >= 80) return 'from-emerald-500 to-teal-500';
    if (confidence >= 50) return 'from-amber-500 to-orange-500';
    return 'from-rose-500 to-red-500';
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'deployment': return <GitCommit className="w-3.5 h-3.5 text-indigo-400" />;
      case 'metric': return <Activity className="w-3.5 h-3.5 text-amber-400" />;
      case 'log': return <Terminal className="w-3.5 h-3.5 text-amber-400" />;
      case 'incident': return <AlertTriangle className="w-3.5 h-3.5 text-rose-450" />;
      case 'impact': return <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />;
      case 'runbook': return <FileText className="w-3.5 h-3.5 text-indigo-400" />;
      case 'recovery': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'blast_radius': return <GitMerge className="w-3.5 h-3.5 text-purple-400" />;
      case 'action': return <Play className="w-3.5 h-3.5 text-emerald-400" />;
      default: return <FileText className="w-3.5 h-3.5 text-zinc-500" />;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'deployment': return 'border-indigo-500/30 text-indigo-400 bg-indigo-950/20';
      case 'metric': return 'border-amber-500/30 text-amber-400 bg-amber-950/20';
      case 'log': return 'border-amber-500/30 text-amber-400 bg-amber-950/20';
      case 'incident': return 'border-rose-500/30 text-rose-450 bg-rose-950/20';
      case 'impact': return 'border-purple-500/30 text-purple-400 bg-purple-950/20';
      case 'runbook': return 'border-indigo-500/30 text-indigo-400 bg-indigo-950/20';
      case 'recovery': return 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20';
      case 'blast_radius': return 'border-purple-500/30 text-purple-400 bg-purple-950/20';
      case 'action': return 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20';
      default: return 'border-zinc-800 text-zinc-400 bg-zinc-900/40';
    }
  };

  return (
    <div className="space-y-6 font-mono text-[10px]">

      {/* Header */}
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Reliability Copilot & SRE Assistant</span>
        </h2>
        <p className="text-[10px] text-zinc-500 mt-0.5 font-sans">
          Ask questions, analyze calculated SRE metrics, parse deployment diffs, and query dynamic incident blast radius cascades.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Side: Suggestions and Recent Context */}
        <div className="space-y-4">

          {/* Suggestions */}
          <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-5 rounded-lg space-y-3 shadow">
            <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2">
              Suggested Queries
            </h3>
            <div className="space-y-2 pt-1">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(s);
                    handleQuerySubmit(s);
                  }}
                  className="w-full text-left p-2.5 rounded bg-zinc-900/40 border border-zinc-900/80 text-zinc-400 hover:text-white hover:border-zinc-800 transition-all text-[9px] leading-relaxed"
                >
                  &rarr; {s}
                </button>
              ))}
            </div>
          </div>

          {/* SRE Assistant Info */}
          <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-5 rounded-lg space-y-3">
            <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              <span>SRE Operational Guard</span>
            </h3>
            <p className="text-zinc-500 font-sans text-xs leading-normal">
              Reliability Copilot relies strictly on active system telemetry, logs, and deployment timelines. It does not perform autonomous write actions.
            </p>
            <div className="bg-black/40 border border-zinc-900 p-3 rounded text-[9px] text-zinc-400 leading-normal font-sans">
              💡 <b>Confirmation Rule:</b> All destructive operations (such as pausing queues or replaying DLQ jobs) require explicit human engineer confirmation.
            </div>
          </div>

        </div>

        {/* Center/Right: Chat console & structured response */}
        <div className="lg:col-span-2 space-y-5">

          {/* Query Bar */}
          <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-4 rounded-lg flex items-center gap-3">
            <div className="flex-1 flex items-center space-x-2.5 bg-zinc-900/30 border border-zinc-900 rounded px-3 py-2">
              <Terminal className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                type="text"
                placeholder="Ask QueueWatch e.g. Why is payment_queue failing?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuerySubmit(query)}
                className="w-full bg-transparent text-white focus:outline-none placeholder-zinc-700 text-xs"
              />
            </div>
            <button
              onClick={() => handleQuerySubmit(query)}
              disabled={loading || !query}
              className="px-4 py-2.5 rounded bg-gradient-to-r from-indigo-900 to-indigo-850 hover:from-indigo-950 hover:to-indigo-900 text-white font-bold border border-indigo-850 flex items-center space-x-1.5 shadow transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>QUERY</span>
            </button>
          </div>

          {/* Copilot Answer Display */}
          {loading && (
            <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-8 rounded-lg text-center animate-pulse text-zinc-500">
              Gathering evidence and correlating signals...
            </div>
          )}

          {response && (
            <div className="space-y-4">

              {/* Answer Box */}
              <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-5 rounded-lg space-y-4 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                  <span className="text-[11px] font-bold text-white uppercase flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Copilot Diagnosis</span>
                  </span>

                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-500 uppercase text-[9px]">Confidence:</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${response.confidence === 'high' ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400' :
                      response.confidence === 'medium' ? 'bg-amber-950/20 border-amber-900 text-amber-400' :
                        'bg-rose-950/20 border-rose-900 text-rose-400'
                      }`}>
                      {response.confidence.toUpperCase()} ({response.confidenceScore}%)
                    </span>
                  </div>
                </div>

                <div className="text-zinc-200 font-sans text-xs leading-relaxed whitespace-pre-wrap">
                  {response.answer}
                </div>
              </div>

              {/* Tab Selector Bar */}
              <div className="flex border-b border-zinc-900 pb-1 mb-4 space-x-1 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`px-3 py-2 font-bold uppercase tracking-wider transition-all border-b-2 text-[9px] flex items-center space-x-1.5 shrink-0 ${activeTab === 'timeline' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Timeline</span>
                </button>
                <button
                  onClick={() => setActiveTab('graph')}
                  className={`px-3 py-2 font-bold uppercase tracking-wider transition-all border-b-2 text-[9px] flex items-center space-x-1.5 shrink-0 ${activeTab === 'graph' ? 'border-purple-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Causal Graph</span>
                </button>
                <button
                  onClick={() => setActiveTab('evidence')}
                  className={`px-3 py-2 font-bold uppercase tracking-wider transition-all border-b-2 text-[9px] flex items-center space-x-1.5 shrink-0 ${activeTab === 'evidence' ? 'border-emerald-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Evidence</span>
                </button>
                <button
                  onClick={() => setActiveTab('hypotheses')}
                  className={`px-3 py-2 font-bold uppercase tracking-wider transition-all border-b-2 text-[9px] flex items-center space-x-1.5 shrink-0 ${activeTab === 'hypotheses' ? 'border-amber-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Hypotheses</span>
                </button>
                <button
                  onClick={() => setActiveTab('recovery')}
                  className={`px-3 py-2 font-bold uppercase tracking-wider transition-all border-b-2 text-[9px] flex items-center space-x-1.5 shrink-0 ${activeTab === 'recovery' ? 'border-rose-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Recovery</span>
                </button>
              </div>

              {/* Tab Panel Content */}
              <div className="space-y-4">

                {/* 1. Timeline View Panel */}
                {activeTab === 'timeline' && (
                  <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-5 rounded-lg space-y-4">
                    <span className="text-zinc-500 uppercase text-[9px] font-bold tracking-wider flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>Chronological Investigation Timeline</span>
                    </span>
                    {response.investigationGraph && response.investigationGraph.nodes && response.investigationGraph.nodes.length > 0 ? (
                      <div className="relative pl-6 border-l border-zinc-800/40 space-y-6 py-2 ml-2">
                        <div className="absolute left-[-1px] top-1.5 bottom-1.5 w-[1px] bg-gradient-to-b from-indigo-500/50 via-zinc-800 to-emerald-500/30" />
                        {[...(response.investigationGraph.nodes || [])]
                          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
                          .map((node, idx) => (
                            <div key={node.id} className="relative group">
                              <div className={`absolute -left-[30px] top-1 w-5 h-5 rounded-full border flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${getNodeColor(node.type)}`}>
                                {getNodeIcon(node.type)}
                              </div>
                              <div className="bg-zinc-900/30 border border-zinc-900/80 rounded-lg p-3 space-y-1 hover:border-zinc-800 hover:bg-zinc-900/40 transition-all duration-300">
                                <div className="flex justify-between items-center text-[8px] text-zinc-550">
                                  <span className="font-bold uppercase tracking-wider">{node.type}</span>
                                  {node.timestamp && (
                                    <span>{new Date(node.timestamp).toUTCString()}</span>
                                  )}
                                </div>
                                <p className="text-[11px] font-bold text-white font-sans leading-tight mt-0.5">
                                  {node.label}
                                </p>
                                {node.metadata && Object.keys(node.metadata).length > 0 && (
                                  <div className="bg-black/30 p-2 rounded text-[8px] text-zinc-400 border border-zinc-900/50 mt-1 font-sans">
                                    {Object.entries(node.metadata).map(([key, val]) => (
                                      <div key={key}>
                                        <span className="text-zinc-650 uppercase font-mono mr-1">{key}:</span>
                                        <span>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <span className="text-zinc-650 italic block pt-2">No timeline nodes registered.</span>
                    )}
                  </div>
                )}

                {/* 2. Causal Graph Panel */}
                {activeTab === 'graph' && (
                  <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-5 rounded-lg space-y-6">
                    <span className="text-zinc-500 uppercase text-[9px] font-bold tracking-wider flex items-center space-x-1.5">
                      <GitMerge className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>Advanced System Causality Graph</span>
                    </span>
                    {response.investigationGraph && response.investigationGraph.nodes && response.investigationGraph.nodes.length > 0 ? (
                      <div className="relative pl-6 border-l border-zinc-800/40 space-y-6 py-2 ml-2">
                        <div className="absolute left-[-1px] top-1.5 bottom-1.5 w-[1px] bg-gradient-to-b from-purple-500/50 via-indigo-500/45 to-emerald-500/35" />
                        {response.investigationGraph.nodes.map((node, idx) => {
                          const isLast = idx === response.investigationGraph.nodes.length - 1;
                          const nextNode = response.investigationGraph.nodes[idx + 1];
                          const edge = nextNode
                            ? response.investigationGraph.edges?.find(e => e.from === node.id && e.to === nextNode.id)
                            : null;

                          return (
                            <div key={node.id} className="relative group">
                              <div className={`absolute -left-[30px] top-1 w-5 h-5 rounded-full border flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${getNodeColor(node.type)}`}>
                                {getNodeIcon(node.type)}
                              </div>
                              <div className="bg-zinc-900/30 border border-zinc-900/80 rounded-lg p-3 space-y-1 hover:border-zinc-800 hover:bg-zinc-900/40 transition-all duration-300">
                                <div className="flex justify-between items-center text-[8px] text-zinc-550">
                                  <span className="font-bold uppercase tracking-wider">{node.type}</span>
                                  {node.timestamp && (
                                    <span>{new Date(node.timestamp).toUTCString()}</span>
                                  )}
                                </div>
                                <p className="text-[11px] font-bold text-white font-sans leading-tight mt-0.5">
                                  {node.label}
                                </p>
                              </div>

                              {!isLast && (
                                <div className="relative my-4 ml-2 pl-4 border-l border-zinc-800/60">
                                  {edge ? (
                                    <div className="space-y-1 bg-zinc-950/50 border border-zinc-900/65 p-2.5 rounded-lg max-w-md shadow-sm">
                                      <div className="flex items-center space-x-1.5">
                                        <span className="text-[8px] font-bold uppercase text-zinc-500">Causal Edge Confidence:</span>
                                        <span className={`px-1 rounded text-[8px] font-bold border ${
                                          edge.confidence && edge.confidence >= 90 ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' : 'bg-amber-950/20 border-amber-900/40 text-amber-400'
                                        }`}>
                                          {edge.confidence}% Confidence
                                        </span>
                                      </div>
                                      {edge.rationale && (
                                        <p className="text-[9.5px] text-zinc-400 font-sans leading-relaxed">
                                          {edge.rationale}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-zinc-650 text-[8px] italic py-1">
                                      Connecting flow...
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-zinc-650 italic block pt-2">No causality nodes registered.</span>
                    )}
                  </div>
                )}

                {/* 3. Evidence View Panel */}
                {activeTab === 'evidence' && (
                  <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-5 rounded-lg space-y-4">
                    <span className="text-zinc-500 uppercase text-[9px] font-bold tracking-wider block">Grounded Telemetry Evidence</span>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                      {response.evidence.filter(ev => getRank(ev) === 'primary').length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-rose-400 font-bold text-[8px] uppercase tracking-wider block">&bull; Primary Indicators</span>
                          <ul className="space-y-1.5">
                            {response.evidence.filter(ev => getRank(ev) === 'primary').map((ev, idx) => {
                              const isHighlighted = highlightedEvidenceIds.includes(ev.id);
                              return (
                                <li
                                  key={idx}
                                  className={`flex items-start space-x-2.5 p-3 rounded-lg border font-sans text-[11px] leading-normal transition-all duration-300 ${isHighlighted
                                    ? 'border-indigo-500 bg-indigo-950/45 shadow-[0_0_12px_rgba(99,102,241,0.45)] scale-[1.01]'
                                    : getEvidenceBadgeStyle(ev.type)
                                    }`}
                                >
                                  {getEvidenceIcon(ev.type)}
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center text-[8px] text-zinc-550 mb-0.5">
                                      <span className="font-bold uppercase">[{ev.type}]</span>
                                      {ev.timestamp && <span>{new Date(ev.timestamp).toUTCString()}</span>}
                                    </div>
                                    <span className="text-zinc-200">{ev.message}</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {response.evidence.filter(ev => getRank(ev) === 'secondary').length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-indigo-400 font-bold text-[8px] uppercase tracking-wider block">&bull; Secondary Correlations</span>
                          <ul className="space-y-1.5">
                            {response.evidence.filter(ev => getRank(ev) === 'secondary').map((ev, idx) => {
                              const isHighlighted = highlightedEvidenceIds.includes(ev.id);
                              return (
                                <li
                                  key={idx}
                                  className={`flex items-start space-x-2.5 p-3 rounded-lg border font-sans text-[11px] leading-normal transition-all duration-300 ${isHighlighted
                                    ? 'border-indigo-500 bg-indigo-950/45 shadow-[0_0_12px_rgba(99,102,241,0.45)] scale-[1.01]'
                                    : getEvidenceBadgeStyle(ev.type)
                                    }`}
                                >
                                  {getEvidenceIcon(ev.type)}
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center text-[8px] text-zinc-550 mb-0.5">
                                      <span className="font-bold uppercase">[{ev.type}]</span>
                                      {ev.timestamp && <span>{new Date(ev.timestamp).toUTCString()}</span>}
                                    </div>
                                    <span className="text-zinc-200">{ev.message}</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {response.evidence.filter(ev => getRank(ev) === 'context').length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-zinc-500 font-bold text-[8px] uppercase tracking-wider block">&bull; Background Context</span>
                          <ul className="space-y-1.5">
                            {response.evidence.filter(ev => getRank(ev) === 'context').map((ev, idx) => {
                              const isHighlighted = highlightedEvidenceIds.includes(ev.id);
                              return (
                                <li
                                  key={idx}
                                  className={`flex items-start space-x-2.5 p-3 rounded-lg border font-sans text-[11px] leading-normal transition-all duration-300 ${isHighlighted
                                    ? 'border-indigo-500 bg-indigo-950/45 shadow-[0_0_12px_rgba(99,102,241,0.45)] scale-[1.01]'
                                    : getEvidenceBadgeStyle(ev.type)
                                    }`}
                                >
                                  {getEvidenceIcon(ev.type)}
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center text-[8px] text-zinc-550 mb-0.5">
                                      <span className="font-bold uppercase">[{ev.type}]</span>
                                      {ev.timestamp && <span>{new Date(ev.timestamp).toUTCString()}</span>}
                                    </div>
                                    <span className="text-zinc-200">{ev.message}</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {response.evidence.length === 0 && (
                        <span className="text-zinc-650 italic block pt-2">No direct telemetry records found.</span>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Hypotheses Panel */}
                {activeTab === 'hypotheses' && (
                  <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-5 rounded-lg space-y-4">
                    <span className="text-zinc-500 uppercase text-[9px] font-bold tracking-wider flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>SRE Hypotheses & Probable Causes</span>
                    </span>
                    <div className="space-y-3">
                      {response.hypotheses && response.hypotheses.map((hyp) => {
                        const isSelected = highlightedEvidenceIds.length > 0 &&
                          hyp.evidenceIds.every(id => highlightedEvidenceIds.includes(id)) &&
                          hyp.evidenceIds.length === highlightedEvidenceIds.length;

                        return (
                          <div
                            key={hyp.id}
                            onClick={() => {
                              if (highlightedEvidenceIds.length > 0 && highlightedEvidenceIds[0] === hyp.evidenceIds[0] && highlightedEvidenceIds.length === hyp.evidenceIds.length) {
                                setHighlightedEvidenceIds([]);
                              } else {
                                setHighlightedEvidenceIds(hyp.evidenceIds);
                              }
                            }}
                            className={`p-4 rounded-lg border transition-all duration-300 cursor-pointer bg-zinc-900/30 ${isSelected
                              ? 'border-indigo-500 bg-indigo-950/20 shadow-[0_0_15px_rgba(99,102,241,0.25)]'
                              : 'border-zinc-900/80 hover:border-zinc-800 hover:bg-zinc-900/40'
                              }`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-white text-[11px]">{hyp.title}</span>
                              <span className="text-[10px] font-bold text-zinc-400">{hyp.confidence}% Confidence</span>
                            </div>
                            <p className="text-zinc-400 font-sans text-[11px] leading-relaxed mt-2">
                              {hyp.description}
                            </p>
                            <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden mt-3 border border-zinc-900">
                              <div
                                className={`h-full bg-gradient-to-r ${getConfidenceColorClass(hyp.confidence)} transition-all duration-500`}
                                style={{ width: `${hyp.confidence}%` }}
                              />
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[8px] text-zinc-550 border-t border-zinc-900/60 pt-2">
                              <span>{hyp.evidenceIds.length} Associated Evidence Items</span>
                              <span className="text-indigo-400 font-bold hover:underline">
                                {isSelected ? 'Click to Deselect' : 'Click to Highlight Evidence'}
                              </span>
                            </div>
                            {isSelected && (
                              <div className="mt-3 bg-black/40 border border-indigo-900/40 p-2.5 rounded-lg space-y-2 animate-in fade-in duration-200">
                                <span className="text-[7.5px] uppercase font-bold text-zinc-500 block">Supporting Evidence Details:</span>
                                <ul className="space-y-1.5">
                                  {response.evidence.filter(ev => hyp.evidenceIds.includes(ev.id)).map((ev, idx) => (
                                    <li key={idx} className="flex items-start space-x-1.5 text-[10px] font-sans text-zinc-350 leading-relaxed">
                                      <span className="text-indigo-500 select-none font-mono text-[9px] mt-0.5">&bull;</span>
                                      <span>{ev.message}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {(!response.hypotheses || response.hypotheses.length === 0) && (
                        <span className="text-zinc-650 italic block pt-2">No hypotheses generated.</span>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Recovery View Panel */}
                {activeTab === 'recovery' && (
                  <div className="space-y-4">
                    <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-5 rounded-lg space-y-4">
                      <span className="text-zinc-500 uppercase text-[9px] font-bold tracking-wider block">Recommended Recovery Actions</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {response.recommendedActions.map((act, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedAction(act)}
                            className={`w-full text-left p-3.5 rounded-lg border text-indigo-400 font-bold hover:text-white hover:border-zinc-700 transition-colors uppercase text-[9px] flex items-center justify-between ${selectedAction?.description === act.description ? 'bg-zinc-900 border-zinc-750 text-white' : 'bg-zinc-900/40 border-zinc-900/80'
                              }`}
                          >
                            <span className="flex-1 pr-2">{act.description}</span>
                            <span className="text-[8px] text-zinc-500 shrink-0 font-mono">SELECT &rarr;</span>
                          </button>
                        ))}
                        {response.recommendedActions.length === 0 && (
                          <span className="text-zinc-650 italic block pt-2 lg:col-span-2">No immediate recovery actions recommended.</span>
                        )}
                      </div>
                    </div>

                    {selectedAction && (
                      <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex justify-between items-center border-b border-zinc-900 pb-2.5">
                          <span className="text-[10px] font-bold text-amber-500 uppercase flex items-center space-x-1.5 animate-pulse">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                            <span>Confirm Action: {selectedAction.type.toUpperCase()}</span>
                          </span>
                          <button
                            onClick={() => setSelectedAction(null)}
                            className="text-zinc-600 hover:text-zinc-400 uppercase text-[8px]"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="text-zinc-400 font-sans text-xs leading-normal">
                          {selectedAction.description}
                        </p>
                        
                        {(selectedAction.associatedRunbook || selectedAction.riskLevel || selectedAction.reasoning || selectedAction.expectedOutcome) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-black/40 border border-zinc-900 p-3 rounded-lg text-[9.5px] font-sans leading-relaxed">
                            {selectedAction.associatedRunbook && (
                              <div>
                                <span className="text-zinc-500 font-mono block uppercase text-[7.5px] font-bold">Associated Runbook</span>
                                <span className="text-indigo-400 font-bold">{selectedAction.associatedRunbook}</span>
                              </div>
                            )}
                            {selectedAction.riskLevel && (
                              <div>
                                <span className="text-zinc-500 font-mono block uppercase text-[7.5px] font-bold">Risk Level</span>
                                <span className={`font-bold uppercase ${
                                  selectedAction.riskLevel === 'high' ? 'text-rose-405' : selectedAction.riskLevel === 'medium' ? 'text-amber-400' : 'text-emerald-400'
                                }`}>{selectedAction.riskLevel}</span>
                              </div>
                            )}
                            {selectedAction.reasoning && (
                              <div className="md:col-span-2">
                                <span className="text-zinc-500 font-mono block uppercase text-[7.5px] font-bold">Reasoning</span>
                                <span className="text-zinc-300">{selectedAction.reasoning}</span>
                              </div>
                            )}
                            {selectedAction.expectedOutcome && (
                              <div className="md:col-span-2">
                                <span className="text-zinc-500 font-mono block uppercase text-[7.5px] font-bold">Expected Outcome</span>
                                <span className="text-zinc-300">{selectedAction.expectedOutcome}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {selectedAction.command && (
                          <div className="bg-black/80 border border-zinc-900 p-3 rounded font-mono text-[9px] text-zinc-500 relative select-all leading-normal">
                            <code>{selectedAction.command}</code>
                          </div>
                        )}
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => handleExecuteAction(selectedAction)}
                            disabled={executing}
                            className="px-5 py-2.5 rounded bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold border border-amber-500/30 flex items-center space-x-1.5 shadow transition-all disabled:opacity-50"
                          >
                            {executing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            <span>CONFIRM & EXECUTE ACTION</span>
                          </button>
                        </div>
                        {executionLogs.length > 0 && (
                          <div className="bg-black border border-zinc-900 p-4 rounded text-[9px] text-zinc-400 space-y-1 mt-2">
                            <div className="text-zinc-650 border-b border-zinc-900 pb-1.5 mb-2 font-sans text-[8px] uppercase">Execution Output logs</div>
                            {executionLogs.map((log, index) => (
                              <div key={index} className={log.includes('SUCCESS') ? 'text-emerald-450' : log.includes('ERROR') || log.includes('CRITICAL') ? 'text-rose-450' : 'text-zinc-400'}>
                                {log}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

      </div>

      {/* Audit Trail & Investigation History Logs */}
      <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-5 rounded-lg space-y-4 mt-6">
        <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center space-x-1.5">
          <Clock className="w-4 h-4 text-zinc-400" />
          <span>Audit Log & Investigation History</span>
        </h3>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
          {logsList.map((log) => (
            <div key={log.id} className="p-3 bg-zinc-900/40 border border-zinc-900 rounded space-y-2 hover:border-zinc-800 transition-colors">
              <div className="flex justify-between items-start text-zinc-500 text-[8px]">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-zinc-400">ID: {log.id}</span>
                  {log.queueName && <span className="bg-indigo-950/40 border border-indigo-900/30 text-indigo-400 px-1 py-0.5 rounded uppercase">Queue: {log.queueName}</span>}
                  {log.incidentId && <span className="bg-rose-950/40 border border-rose-900/30 text-rose-400 px-1 py-0.5 rounded uppercase">Incident: {log.incidentId}</span>}
                </div>
                <span>{new Date(log.timestamp).toLocaleString()}</span>
              </div>

              <div className="text-white font-sans text-xs">
                <span className="text-zinc-500 font-mono text-[10px] mr-1">&gt;</span>
                {log.question}
              </div>

              <div className="p-2.5 bg-black/30 rounded border border-zinc-900/80 text-[9px] text-zinc-400 leading-relaxed font-sans">
                <span className="text-[8px] font-bold font-mono uppercase text-zinc-550 block mb-1">Answer Summary</span>
                {log.answer.length > 250 ? `${log.answer.substring(0, 250)}...` : log.answer}
              </div>

              <div className="flex items-center space-x-2 text-[8px]">
                <span className="text-zinc-600">CONFIDENCE:</span>
                <span className={`font-bold ${log.confidence === 'high' ? 'text-emerald-400' :
                  log.confidence === 'medium' ? 'text-amber-400' : 'text-rose-450'
                  }`}>
                  {log.confidence.toUpperCase()}
                </span>
                <span className="text-zinc-700">|</span>
                <span className="text-zinc-650">{log.evidence.length} evidence tokens</span>
              </div>
            </div>
          ))}

          {logsList.length === 0 && (
            <span className="text-zinc-650 italic block py-4 text-center">No previous investigations registered in project audit log.</span>
          )}
        </div>
      </div>

    </div>
  );
}
