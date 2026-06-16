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
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      response.confidence === 'high' ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400' :
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

              {/* Evidence & Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Evidence Source list */}
                <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-4 rounded-lg space-y-3">
                  <span className="text-zinc-500 uppercase text-[9px] font-bold tracking-wider block">Grounded Telemetry Evidence</span>
                  <ul className="space-y-2">
                    {response.evidence.map((ev, idx) => (
                      <li key={idx} className={`flex items-start space-x-2 p-2 rounded border font-sans text-[11px] leading-normal ${getEvidenceBadgeStyle(ev.type)}`}>
                        {getEvidenceIcon(ev.type)}
                        <div className="flex-1">
                          <span className="font-bold uppercase text-[8px] mr-1">[{ev.type}]</span>
                          <span>{ev.message}</span>
                        </div>
                      </li>
                    ))}
                    {response.evidence.length === 0 && (
                      <span className="text-zinc-650 italic block pt-2">No direct telemetry records found.</span>
                    )}
                  </ul>
                </div>

                {/* Recommendations */}
                <div className="bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 p-4 rounded-lg space-y-3">
                  <span className="text-zinc-500 uppercase text-[9px] font-bold tracking-wider block">Recommended Recovery Actions</span>
                  <div className="space-y-2">
                    {response.recommendedActions.map((act, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedAction(act)}
                        className={`w-full text-left p-2.5 rounded border text-indigo-400 font-bold hover:text-white hover:border-zinc-700 transition-colors uppercase text-[8.5px] flex items-center justify-between ${
                          selectedAction?.description === act.description ? 'bg-zinc-900 border-zinc-750 text-white' : 'bg-zinc-900/40 border-zinc-900/80'
                        }`}
                      >
                        <span className="flex-1 pr-2">{act.description}</span>
                        <span className="text-[7.5px] text-zinc-500 shrink-0">SELECT &rarr;</span>
                      </button>
                    ))}
                    {response.recommendedActions.length === 0 && (
                      <span className="text-zinc-650 italic block pt-2">No immediate recovery actions recommended.</span>
                    )}
                  </div>
                </div>

              </div>

              {/* Action Confirmation Console */}
              {selectedAction && (
                <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
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
                <span className={`font-bold ${
                  log.confidence === 'high' ? 'text-emerald-400' :
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
