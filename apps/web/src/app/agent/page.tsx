'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import {
  Bot, Zap, Search, Brain, ListChecks, History, Play, CheckCircle,
  XCircle, Clock, AlertTriangle, ChevronRight, Loader2, Shield,
  Activity, BarChart3, BookOpen, RefreshCw, Terminal, Network,
  TrendingUp, ArrowRight, Eye, ThumbsUp, ThumbsDown, Edit3,
  ChevronDown, ChevronUp, Cpu, Layers, FileText, Sparkles, Target
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type AgentStatus = 'planning' | 'investigating' | 'reasoning' | 'awaiting_approval' | 'executing' | 'completed' | 'failed';

const STAGE_ORDER = ['planning', 'investigating', 'reasoning', 'awaiting_approval', 'executing', 'completed'];
const STAGE_LABELS: Record<string, string> = {
  planning: 'Planning',
  investigating: 'Investigating',
  reasoning: 'Reasoning',
  awaiting_approval: 'Awaiting Approval',
  executing: 'Executing',
  completed: 'Completed',
  failed: 'Failed',
};
const STAGE_ICONS: Record<string, any> = {
  planning: Target,
  investigating: Search,
  reasoning: Brain,
  awaiting_approval: Shield,
  executing: Zap,
  completed: CheckCircle,
  failed: XCircle,
};

const RISK_COLORS: Record<string, string> = {
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  high: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

const EVIDENCE_TYPE_COLORS: Record<string, string> = {
  incident: 'text-rose-400',
  log: 'text-amber-400',
  metric: 'text-indigo-400',
  deployment: 'text-purple-400',
  graph: 'text-cyan-400',
  score: 'text-emerald-400',
};

const EVIDENCE_TYPE_ICONS: Record<string, any> = {
  incident: AlertTriangle,
  log: Terminal,
  metric: Activity,
  deployment: Layers,
  graph: Network,
  score: BarChart3,
};

type Tab = 'plan' | 'evidence' | 'hypotheses' | 'actions' | 'history';

export default function AgentPage() {
  const { token, activeProject } = useAuth();
  const router = useRouter();

  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<Tab>('plan');
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [approving, setApproving] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [executing, setExecuting] = useState(false);
  const [expandedHyp, setExpandedHyp] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-project-id': activeProject?.id || '',
  };

  const fetchSessions = useCallback(async () => {
    if (!token || !activeProject) return;
    try {
      const res = await fetch(`${API}/api/agent/sessions`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !activeSession) setActiveSession(data[0]);
      }
    } catch (_) {}
  }, [token, activeProject]);

  const fetchIncidents = useCallback(async () => {
    if (!token || !activeProject) return;
    try {
      const res = await fetch(`${API}/api/incidents`, { headers });
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.filter((i: any) => i.status !== 'resolved').slice(0, 20));
      }
    } catch (_) {}
  }, [token, activeProject]);

  useEffect(() => {
    fetchSessions();
    fetchIncidents();
  }, [fetchSessions, fetchIncidents]);

  const runAgent = async () => {
    if (!selectedIncidentId) return;
    setRunning(true);
    setShowIncidentModal(false);
    setTab('plan');
    try {
      const res = await fetch(`${API}/api/agent/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ incidentId: selectedIncidentId }),
      });
      if (res.ok) {
        const session = await res.json();
        setActiveSession(session);
        setSessions(prev => [session, ...prev.filter(s => s.id !== session.id)]);
      }
    } catch (_) {}
    setRunning(false);
  };

  const refreshSession = async (sessionId: string) => {
    try {
      const res = await fetch(`${API}/api/agent/sessions/${sessionId}`, { headers });
      if (res.ok) {
        const session = await res.json();
        setActiveSession(session);
        setSessions(prev => prev.map(s => s.id === sessionId ? session : s));
      }
    } catch (_) {}
  };

  const approveAction = async (actionId: string, decision: 'approved' | 'rejected') => {
    if (!activeSession) return;
    setApproving(actionId);
    try {
      const res = await fetch(`${API}/api/agent/sessions/${activeSession.id}/actions/${actionId}/approve`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ decision, notes: approvalNotes }),
      });
      if (res.ok) {
        const session = await res.json();
        setActiveSession(session);
        setSessions(prev => prev.map(s => s.id === session.id ? session : s));
        setApprovalNotes('');
      }
    } catch (_) {}
    setApproving(null);
  };

  const executeApproved = async () => {
    if (!activeSession) return;
    setExecuting(true);
    try {
      const res = await fetch(`${API}/api/agent/sessions/${activeSession.id}/execute`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const session = await res.json();
        setActiveSession(session);
        setSessions(prev => prev.map(s => s.id === session.id ? session : s));
        setTab('history');
      }
    } catch (_) {}
    setExecuting(false);
  };

  const statusColor: Record<AgentStatus, string> = {
    planning: 'text-indigo-400',
    investigating: 'text-amber-400',
    reasoning: 'text-purple-400',
    awaiting_approval: 'text-sky-400',
    executing: 'text-orange-400',
    completed: 'text-emerald-400',
    failed: 'text-rose-400',
  };

  const stageProgress = (status: AgentStatus) => {
    const idx = STAGE_ORDER.indexOf(status);
    return idx >= 0 ? Math.round(((idx + 1) / STAGE_ORDER.length) * 100) : 0;
  };

  const hasApproved = activeSession?.recommendedActions?.some((a: any) => a.status === 'approved' || a.status === 'modified');
  const hasPending = activeSession?.recommendedActions?.some((a: any) => a.status === 'pending');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="border-b border-zinc-900 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-white">Reliability Agent</h1>
              <span className="text-[9px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Beta</span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Autonomous Detect → Investigate → Reason → Recommend → Execute</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {activeSession && (
            <button
              onClick={() => refreshSession(activeSession.id)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md border border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          )}
          <button
            onClick={() => { fetchIncidents(); setShowIncidentModal(true); }}
            disabled={running}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>{running ? 'Investigating...' : 'Run New Investigation'}</span>
          </button>
        </div>
      </div>

      <div className="flex gap-6 p-6 max-w-7xl mx-auto">
        {/* ── Left Panel: Active Session + Stage Progress ─────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Active Investigation Card */}
          {activeSession ? (
            <div className="border border-zinc-900 rounded-xl bg-zinc-950/60 overflow-hidden">
              {/* Status header */}
              <div className="px-5 py-4 border-b border-zinc-900 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {(() => {
                    const StatusIcon = STAGE_ICONS[activeSession.status] || Bot;
                    return <StatusIcon className={`w-4 h-4 ${statusColor[activeSession.status as AgentStatus] || 'text-zinc-400'}`} />;
                  })()}
                  <div>
                    <span className={`text-sm font-bold ${statusColor[activeSession.status as AgentStatus] || 'text-zinc-400'}`}>
                      {STAGE_LABELS[activeSession.status] || activeSession.status}
                    </span>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Session {activeSession.id}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-xs text-zinc-500">
                  <span>Incident: <span className="text-zinc-300 font-mono">{activeSession.incidentId}</span></span>
                  <span>Queue: <span className="text-indigo-300 font-mono">{activeSession.plan?.targetQueue || '—'}</span></span>
                </div>
              </div>

              {/* Stage pipeline */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  {STAGE_ORDER.map((stage, idx) => {
                    const Icon = STAGE_ICONS[stage] || Bot;
                    const currentIdx = STAGE_ORDER.indexOf(activeSession.status);
                    const isPast = idx < currentIdx;
                    const isActive = idx === currentIdx;
                    const isFuture = idx > currentIdx;
                    return (
                      <div key={stage} className="flex items-center">
                        <div className="flex flex-col items-center space-y-1">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                            isPast ? 'bg-emerald-500/20 border-emerald-500/40' :
                            isActive ? 'bg-indigo-500/20 border-indigo-500/50 ring-2 ring-indigo-500/30' :
                            'bg-zinc-900 border-zinc-800'
                          }`}>
                            <Icon className={`w-3.5 h-3.5 ${isPast ? 'text-emerald-400' : isActive ? 'text-indigo-400' : 'text-zinc-600'}`} />
                          </div>
                          <span className={`text-[9px] font-semibold uppercase tracking-wide ${isActive ? 'text-indigo-400' : isPast ? 'text-emerald-500' : 'text-zinc-600'}`}>
                            {STAGE_LABELS[stage]?.split(' ')[0]}
                          </span>
                        </div>
                        {idx < STAGE_ORDER.length - 1 && (
                          <div className={`w-8 h-px mx-1 ${isPast ? 'bg-emerald-500/40' : 'bg-zinc-800'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Progress bar */}
                <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
                    style={{ width: `${stageProgress(activeSession.status as AgentStatus)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-zinc-600">
                  <span>{activeSession.evidence?.length || 0} evidence items</span>
                  <span>{activeSession.hypotheses?.length || 0} hypotheses</span>
                  <span>{activeSession.recommendedActions?.length || 0} actions</span>
                </div>
              </div>

              {/* Strategy */}
              {activeSession.plan?.strategy && (
                <div className="px-5 pb-4">
                  <div className="flex items-start space-x-2 bg-zinc-900/40 border border-zinc-800/50 rounded-lg px-3 py-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-zinc-400 leading-relaxed">{activeSession.plan.strategy}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-zinc-900 rounded-xl bg-zinc-950/60 flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="text-center">
                <h3 className="text-sm font-semibold text-zinc-300">No Active Investigation</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs">Start a new agent investigation to detect, reason, and propose remediation for an incident.</p>
              </div>
              <button
                onClick={() => { fetchIncidents(); setShowIncidentModal(true); }}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Run First Investigation</span>
              </button>
            </div>
          )}

          {/* ── Tab Workspace ──────────────────────────────────────────── */}
          {activeSession && (
            <div className="border border-zinc-900 rounded-xl bg-zinc-950/60 overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-zinc-900 bg-zinc-950/40 overflow-x-auto">
                {([
                  { id: 'plan', icon: Target, label: 'Plan', count: activeSession.plan?.steps?.length },
                  { id: 'evidence', icon: Search, label: 'Evidence', count: activeSession.evidence?.length },
                  { id: 'hypotheses', icon: Brain, label: 'Hypotheses', count: activeSession.hypotheses?.length },
                  { id: 'actions', icon: ListChecks, label: 'Actions', count: activeSession.recommendedActions?.length },
                  { id: 'history', icon: History, label: 'History', count: activeSession.executionHistory?.length },
                ] as const).map(({ id, icon: Icon, label, count }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id as Tab)}
                    className={`flex items-center space-x-2 px-5 py-3.5 text-xs font-semibold transition-all whitespace-nowrap border-b-2 ${
                      tab === id
                        ? 'text-white border-indigo-500 bg-indigo-500/5'
                        : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900/30'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                    {count !== undefined && count > 0 && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tab === id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-800 text-zinc-500'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* ── PLAN TAB ──────────────────────────────────────────── */}
                {tab === 'plan' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Investigation Steps</h3>
                      {activeSession.plan?.steps?.map((step: string, i: number) => (
                        <div key={i} className="flex items-start space-x-3 py-2 border-b border-zinc-900/50 last:border-0">
                          <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-500 shrink-0 mt-0.5">
                            {i + 1}
                          </div>
                          <span className="text-xs text-zinc-300 leading-relaxed">{step}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-700 shrink-0 mt-0.5 ml-auto" />
                        </div>
                      ))}
                    </div>
                    {activeSession.plan?.targetService && (
                      <div className="flex items-center space-x-2 mt-4">
                        <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-xs text-zinc-500">Target service: <span className="text-zinc-300 font-mono">{activeSession.plan.targetService}</span></span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── EVIDENCE TAB ──────────────────────────────────────── */}
                {tab === 'evidence' && (
                  <div className="space-y-3">
                    {(['primary', 'secondary', 'context'] as const).map(rank => {
                      const items = activeSession.evidence?.filter((e: any) => e.rank === rank) || [];
                      if (items.length === 0) return null;
                      return (
                        <div key={rank}>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 flex items-center space-x-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${rank === 'primary' ? 'bg-rose-500' : rank === 'secondary' ? 'bg-amber-500' : 'bg-zinc-600'}`} />
                            <span>{rank} evidence ({items.length})</span>
                          </div>
                          <div className="space-y-2">
                            {items.map((ev: any) => {
                              const Icon = EVIDENCE_TYPE_ICONS[ev.type] || Activity;
                              return (
                                <div key={ev.id} className="flex items-start space-x-3 bg-zinc-900/30 border border-zinc-900/60 rounded-lg px-3 py-2.5">
                                  <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5 ${EVIDENCE_TYPE_COLORS[ev.type] || 'text-zinc-400'} bg-zinc-900`}>
                                    <Icon className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs text-zinc-300 leading-relaxed">{ev.message}</p>
                                    <div className="flex items-center space-x-2 mt-1.5">
                                      <span className={`text-[9px] font-bold uppercase ${EVIDENCE_TYPE_COLORS[ev.type]}`}>{ev.type}</span>
                                      {ev.timestamp && (
                                        <span className="text-[9px] text-zinc-600">{new Date(ev.timestamp).toUTCString().slice(0, 22)}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {(!activeSession.evidence || activeSession.evidence.length === 0) && (
                      <div className="text-center py-8 text-zinc-600 text-xs">No evidence collected yet.</div>
                    )}
                  </div>
                )}

                {/* ── HYPOTHESES TAB ────────────────────────────────────── */}
                {tab === 'hypotheses' && (
                  <div className="space-y-3">
                    {activeSession.hypotheses?.map((hyp: any) => (
                      <div key={hyp.id} className={`border rounded-xl overflow-hidden transition-all ${hyp.rank === 1 ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-zinc-900 bg-zinc-900/20'}`}>
                        <button
                          onClick={() => setExpandedHyp(expandedHyp === hyp.id ? null : hyp.id)}
                          className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border ${hyp.rank === 1 ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                              {hyp.rank}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-semibold text-zinc-200">{hyp.title}</span>
                                {hyp.rank === 1 && <span className="text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded font-bold">PRIMARY</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            {/* Confidence bar */}
                            <div className="flex items-center space-x-2">
                              <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${hyp.confidence >= 80 ? 'bg-emerald-500' : hyp.confidence >= 50 ? 'bg-amber-500' : 'bg-zinc-500'}`}
                                  style={{ width: `${hyp.confidence}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold ${hyp.confidence >= 80 ? 'text-emerald-400' : hyp.confidence >= 50 ? 'text-amber-400' : 'text-zinc-400'}`}>
                                {hyp.confidence}%
                              </span>
                            </div>
                            {expandedHyp === hyp.id ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                          </div>
                        </button>
                        {expandedHyp === hyp.id && (
                          <div className="px-4 pb-4 border-t border-zinc-900/60">
                            <p className="text-xs text-zinc-400 leading-relaxed mt-3">{hyp.description}</p>
                            {hyp.evidenceIds?.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {hyp.evidenceIds.slice(0, 4).map((eid: string) => (
                                  <span key={eid} className="text-[9px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-500 px-2 py-0.5 rounded">{eid.substring(0, 20)}...</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {(!activeSession.hypotheses || activeSession.hypotheses.length === 0) && (
                      <div className="text-center py-8 text-zinc-600 text-xs">No hypotheses generated yet.</div>
                    )}
                  </div>
                )}

                {/* ── ACTIONS TAB ───────────────────────────────────────── */}
                {tab === 'actions' && (
                  <div className="space-y-4">
                    {/* Execute CTA */}
                    {hasApproved && activeSession.status !== 'completed' && (
                      <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs text-emerald-300 font-semibold">Actions approved — ready to execute</span>
                        </div>
                        <button
                          onClick={executeApproved}
                          disabled={executing}
                          className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          <span>Execute Approved</span>
                        </button>
                      </div>
                    )}

                    {activeSession.recommendedActions?.map((action: any) => (
                      <div key={action.id} className={`border rounded-xl overflow-hidden ${
                        action.status === 'executed' ? 'border-emerald-500/25 bg-emerald-500/5' :
                        action.status === 'approved' ? 'border-sky-500/25 bg-sky-500/5' :
                        action.status === 'rejected' ? 'border-zinc-700 bg-zinc-900/20 opacity-60' :
                        'border-zinc-900 bg-zinc-900/20'
                      }`}>
                        <button
                          onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                          className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                        >
                          <div className="flex items-center space-x-3">
                            {/* Status icon */}
                            <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                              action.status === 'executed' ? 'text-emerald-400' :
                              action.status === 'approved' ? 'text-sky-400' :
                              action.status === 'rejected' ? 'text-zinc-500' : 'text-zinc-400'
                            }`}>
                              {action.status === 'executed' ? <CheckCircle className="w-4 h-4" /> :
                               action.status === 'approved' ? <ThumbsUp className="w-4 h-4" /> :
                               action.status === 'rejected' ? <XCircle className="w-4 h-4" /> :
                               <Clock className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-zinc-200 truncate">{action.description}</p>
                              <div className="flex items-center space-x-2 mt-0.5">
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${RISK_COLORS[action.riskLevel]}`}>
                                  {action.riskLevel} risk
                                </span>
                                <span className="text-[9px] text-zinc-500 flex items-center space-x-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>~{action.estimatedRecoveryMin}min recovery</span>
                                </span>
                                <span className="text-[9px] text-zinc-600 font-mono">{action.type}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full ${
                              action.status === 'executed' ? 'bg-emerald-500/15 text-emerald-400' :
                              action.status === 'approved' ? 'bg-sky-500/15 text-sky-400' :
                              action.status === 'rejected' ? 'bg-zinc-800 text-zinc-500' :
                              'bg-zinc-800 text-zinc-400'
                            }`}>{action.status}</span>
                            {expandedAction === action.id ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                          </div>
                        </button>

                        {expandedAction === action.id && (
                          <div className="px-4 pb-4 border-t border-zinc-900/60 space-y-3 mt-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Reasoning</p>
                                <p className="text-xs text-zinc-400 leading-relaxed">{action.reasoning}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Expected Outcome</p>
                                <p className="text-xs text-zinc-400 leading-relaxed">{action.expectedOutcome}</p>
                              </div>
                            </div>
                            {action.command && (
                              <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-[11px] text-zinc-400 flex items-start space-x-2">
                                <Terminal className="w-3.5 h-3.5 text-zinc-600 mt-0.5 shrink-0" />
                                <span className="break-all">{action.command}</span>
                              </div>
                            )}
                            {action.associatedRunbook && (
                              <div className="flex items-center space-x-2 text-xs text-zinc-500">
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Runbook: <span className="text-zinc-300">{action.associatedRunbook}</span></span>
                              </div>
                            )}

                            {/* Approval controls */}
                            {action.status === 'pending' && activeSession.status !== 'completed' && (
                              <div className="space-y-2 pt-2 border-t border-zinc-900/60">
                                <textarea
                                  value={approvalNotes}
                                  onChange={(e) => setApprovalNotes(e.target.value)}
                                  placeholder="Optional notes for this decision..."
                                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 resize-none h-16"
                                />
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => approveAction(action.id, 'approved')}
                                    disabled={!!approving}
                                    className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-sky-600/80 hover:bg-sky-600 text-white text-xs font-semibold transition-all disabled:opacity-50"
                                  >
                                    {approving === action.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => approveAction(action.id, 'rejected')}
                                    disabled={!!approving}
                                    className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all disabled:opacity-50"
                                  >
                                    <ThumbsDown className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {(!activeSession.recommendedActions || activeSession.recommendedActions.length === 0) && (
                      <div className="text-center py-8 text-zinc-600 text-xs">No actions recommended yet.</div>
                    )}
                  </div>
                )}

                {/* ── HISTORY TAB ───────────────────────────────────────── */}
                {tab === 'history' && (
                  <div className="space-y-4">
                    {/* Postmortem */}
                    {activeSession.postmortem && (
                      <div className="border border-indigo-500/20 rounded-xl bg-indigo-500/5 p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <FileText className="w-4 h-4 text-indigo-400" />
                          <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Auto-generated Postmortem</span>
                        </div>
                        <pre className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed font-sans">{activeSession.postmortem}</pre>
                      </div>
                    )}

                    {/* Execution log */}
                    {activeSession.executionHistory?.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Execution Log</h3>
                        {activeSession.executionHistory.map((entry: any, i: number) => (
                          <div key={i} className={`flex items-start space-x-3 border rounded-lg px-4 py-3 ${
                            entry.result === 'success' ? 'border-emerald-500/20 bg-emerald-500/5' :
                            entry.result === 'failed' ? 'border-rose-500/20 bg-rose-500/5' :
                            'border-zinc-900 bg-zinc-900/20'
                          }`}>
                            {entry.result === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> :
                             entry.result === 'failed' ? <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" /> :
                             <Clock className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />}
                            <div>
                              <p className="text-xs font-mono text-zinc-300">{entry.actionId}</p>
                              <p className="text-xs text-zinc-500 mt-0.5">{entry.output}</p>
                              <p className="text-[10px] text-zinc-600 mt-1">{new Date(entry.executedAt).toUTCString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Approval decisions */}
                    {activeSession.approvalDecisions?.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Approval Decisions</h3>
                        {activeSession.approvalDecisions.map((dec: any, i: number) => (
                          <div key={i} className="flex items-center justify-between border border-zinc-900 rounded-lg px-4 py-2.5 bg-zinc-900/20">
                            <div className="flex items-center space-x-2">
                              {dec.decision === 'approved' ? <ThumbsUp className="w-3.5 h-3.5 text-sky-400" /> : <ThumbsDown className="w-3.5 h-3.5 text-zinc-500" />}
                              <span className="text-xs font-mono text-zinc-400">{dec.actionId.substring(0, 20)}...</span>
                            </div>
                            <div className="text-right">
                              <span className={`text-[10px] font-bold uppercase ${dec.decision === 'approved' ? 'text-sky-400' : 'text-zinc-500'}`}>{dec.decision}</span>
                              <p className="text-[10px] text-zinc-600">{dec.decidedBy} · {new Date(dec.decidedAt).toUTCString().slice(5, 22)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!activeSession.postmortem && activeSession.executionHistory?.length === 0 && (
                      <div className="text-center py-8 text-zinc-600 text-xs">No execution history yet. Approve and execute actions to see results.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 space-y-5">
          {/* Runbook Matches */}
          {activeSession?.runbookMatches?.length > 0 && (
            <div className="border border-zinc-900 rounded-xl bg-zinc-950/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-900 flex items-center space-x-2">
                <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Matched Runbooks</span>
              </div>
              <div className="p-3 space-y-2">
                {activeSession.runbookMatches.map((rb: any) => (
                  <div key={rb.runbookId} className="border border-zinc-900 rounded-lg px-3 py-2.5 hover:border-zinc-700 transition-colors cursor-pointer" onClick={() => router.push('/runbooks')}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-zinc-300 truncate">{rb.title}</p>
                      <span className="text-[9px] font-bold text-emerald-400">{rb.matchScore}%</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed line-clamp-2">{rb.reason}</p>
                    <div className="flex items-center space-x-1 mt-1.5 text-[9px] text-indigo-400">
                      <ArrowRight className="w-3 h-3" />
                      <span>View Runbook</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past Sessions */}
          <div className="border border-zinc-900 rounded-xl bg-zinc-950/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Past Sessions</span>
              </div>
              <span className="text-[9px] text-zinc-600">{sessions.length} total</span>
            </div>
            <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
              {sessions.slice(0, 10).map((session) => {
                const StatusIcon = STAGE_ICONS[session.status] || Bot;
                return (
                  <button
                    key={session.id}
                    onClick={() => { setActiveSession(session); setTab('plan'); }}
                    className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                      activeSession?.id === session.id ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-zinc-900/60 border border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-mono text-zinc-400 truncate">{session.incidentId}</p>
                      <p className="text-[10px] text-zinc-600 font-mono">{session.id.substring(0, 12)}...</p>
                    </div>
                    <div className="flex flex-col items-end ml-2 shrink-0">
                      <div className={`flex items-center space-x-1 ${statusColor[session.status as AgentStatus] || 'text-zinc-500'}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span className="text-[9px] font-bold capitalize">{session.status?.replace('_', ' ')}</span>
                      </div>
                      <span className="text-[9px] text-zinc-600">{session.hypotheses?.length || 0}h · {session.recommendedActions?.length || 0}a</span>
                    </div>
                  </button>
                );
              })}
              {sessions.length === 0 && (
                <div className="text-center py-4 text-zinc-600 text-xs">No sessions yet.</div>
              )}
            </div>
          </div>

          {/* Stats */}
          {activeSession && (
            <div className="border border-zinc-900 rounded-xl bg-zinc-950/60 p-4 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Session Stats</h3>
              {[
                { label: 'Evidence Items', value: activeSession.evidence?.length || 0, icon: Eye },
                { label: 'Hypotheses', value: activeSession.hypotheses?.length || 0, icon: Brain },
                { label: 'Runbooks Matched', value: activeSession.runbookMatches?.length || 0, icon: BookOpen },
                { label: 'Actions', value: activeSession.recommendedActions?.length || 0, icon: ListChecks },
                { label: 'Executed', value: activeSession.executionHistory?.filter((e: any) => e.result === 'success').length || 0, icon: CheckCircle },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-3.5 h-3.5 text-zinc-600" />
                    <span className="text-xs text-zinc-500">{label}</span>
                  </div>
                  <span className="text-xs font-bold text-zinc-300">{value}</span>
                </div>
              ))}
              {activeSession.completedAt && (
                <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-3.5 h-3.5 text-zinc-600" />
                    <span className="text-xs text-zinc-500">Duration</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">
                    {Math.round((activeSession.completedAt - activeSession.startedAt) / 1000)}s
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Incident Selector Modal ──────────────────────────────────────────── */}
      {showIncidentModal && (
        <div
          onClick={() => setShowIncidentModal(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-zinc-900 rounded-xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-zinc-900 flex items-center space-x-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Run New Investigation</h2>
                <p className="text-[11px] text-zinc-500">Select an active incident for the agent to investigate</p>
              </div>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {incidents.length === 0 && (
                <div className="text-center py-6 text-zinc-600 text-xs">No active incidents found.</div>
              )}
              {incidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`w-full text-left border rounded-xl px-4 py-3 transition-all ${
                    selectedIncidentId === inc.id
                      ? 'border-indigo-500/40 bg-indigo-500/10'
                      : 'border-zinc-900 bg-zinc-900/30 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 truncate">{inc.title}</span>
                    <span className={`text-[9px] font-bold uppercase ml-2 shrink-0 ${
                      inc.severity === 'critical' ? 'text-rose-400' :
                      inc.severity === 'high' ? 'text-orange-400' : 'text-amber-400'
                    }`}>{inc.severity}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1.5">
                    <span className="text-[10px] text-zinc-500 font-mono">{inc.id}</span>
                    <span className="text-[10px] text-zinc-600">·</span>
                    <span className="text-[10px] text-indigo-400 font-mono">{inc.affectedQueue}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-zinc-900 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowIncidentModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={runAgent}
                disabled={!selectedIncidentId || running}
                className="flex items-center space-x-1.5 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Run Agent</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
