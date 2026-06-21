'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import {
  Bot, Shield, Terminal, Activity, Layers, Network, BookOpen, Wrench,
  Play, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, ChevronRight,
  TrendingUp, Award, Users, ChevronDown, ChevronUp, Cpu, Sparkles, Loader2,
  ThumbsUp, ThumbsDown, Zap
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type AgentRole = 'incident_commander' | 'telemetry' | 'deployment' | 'dependency' | 'knowledge' | 'recovery';

const AGENT_METADATA: Record<AgentRole, { name: string; icon: any; color: string; desc: string }> = {
  incident_commander: {
    name: 'Incident Commander',
    icon: Shield,
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/25',
    desc: 'Coordinates SRE diagnostics and computes final team consensus.'
  },
  telemetry: {
    name: 'Telemetry Agent',
    icon: Activity,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25',
    desc: 'Monitors logs, queue metrics, and worker CPU/memory states.'
  },
  deployment: {
    name: 'Deployment Agent',
    icon: Layers,
    color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/25',
    desc: 'Correlates code check-ins and recent deployments.'
  },
  dependency: {
    name: 'Dependency Agent',
    icon: Network,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
    desc: 'Analyzes topology maps and downstream blast radius.'
  },
  knowledge: {
    name: 'Knowledge Agent',
    icon: BookOpen,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    desc: 'Queries incident databases and maps SRE runbooks.'
  },
  recovery: {
    name: 'Recovery Agent',
    icon: Wrench,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
    desc: 'Formulates action recommendations and rollback paths.'
  }
};

const AGENT_STATUS_COLORS: Record<string, string> = {
  idle: 'text-zinc-500 bg-zinc-800/40 border-zinc-700/50',
  working: 'text-amber-400 bg-amber-500/10 border-amber-500/25 animate-pulse',
  completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  failed: 'text-rose-400 bg-rose-500/10 border-rose-500/25'
};

const RISK_COLORS: Record<string, string> = {
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  high: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
};

const EVIDENCE_TYPE_ICONS: Record<string, any> = {
  incident: AlertTriangle,
  log: Terminal,
  metric: Activity,
  deployment: Layers,
  graph: Network,
  score: TrendingUp
};

export default function AgentTeamPage() {
  const { token, activeProject } = useAuth();
  const router = useRouter();

  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [selectedConsoleRole, setSelectedConsoleRole] = useState<AgentRole | 'all'>('all');
  const [approving, setApproving] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');

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
        if (data.length > 0 && !activeSession) {
          setActiveSession(data[0]);
        }
      }
    } catch (_) {}
    setLoading(false);
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
    const interval = setInterval(fetchSessions, 6000);
    return () => clearInterval(interval);
  }, [fetchSessions, fetchIncidents]);

  const runTeamAgent = async () => {
    if (!selectedIncidentId) return;
    setRunning(true);
    setShowIncidentModal(false);
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

  const activeFindings = activeSession?.teamFindings || [];

  // Filter console logs based on selected agent role
  const consoleLogs: { role: AgentRole; text: string; ts: number }[] = [];
  activeFindings.forEach((finding: any) => {
    finding.findings?.forEach((fText: string) => {
      consoleLogs.push({
        role: finding.agentRole,
        text: fText,
        ts: finding.updatedAt || Date.now()
      });
    });
  });

  const filteredLogs = consoleLogs
    .filter(log => selectedConsoleRole === 'all' || log.role === selectedConsoleRole)
    .sort((a, b) => a.ts - b.ts);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans p-6">
      
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-white tracking-tight">SRE Multi-Agent Team</h1>
              <span className="text-[9px] bg-violet-500/15 text-violet-400 border border-violet-500/25 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">COLLABORATIVE</span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Specialized SRE agents working under an Incident Commander to analyze and resolve incidents.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchSessions}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => { fetchIncidents(); setShowIncidentModal(true); }}
            disabled={running}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-lg shadow-violet-500/20"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Run Team Diagnostics</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* ── Left Sidebar: Session History ─────────────────────────────────── */}
        <div className="space-y-4 xl:col-span-1">
          <div className="border border-zinc-900 rounded-xl bg-zinc-950/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-900 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Diagnostic Sessions</span>
              <span className="text-[10px] text-zinc-500 font-mono">{sessions.length} total</span>
            </div>
            <div className="p-2 space-y-1 max-h-[500px] overflow-y-auto">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setActiveSession(session)}
                  className={`w-full text-left flex flex-col p-3 rounded-lg border transition-all ${
                    activeSession?.id === session.id
                      ? 'bg-violet-500/10 border-violet-500/20'
                      : 'hover:bg-zinc-900/60 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-mono font-bold text-white truncate max-w-[140px]">{session.incidentId}</span>
                    <span className="text-[9px] text-zinc-500">{new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center justify-between w-full mt-2">
                    <span className="text-[9px] font-mono text-zinc-500">{session.id.substring(0, 10)}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold capitalize ${
                      session.status === 'awaiting_approval' ? 'bg-sky-500/15 text-sky-400' :
                      session.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>{session.status?.replace('_', ' ')}</span>
                  </div>
                </button>
              ))}
              {sessions.length === 0 && (
                <div className="text-center py-8 text-zinc-600 text-xs">No sessions recorded yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Main Workspace ───────────────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-6">
          {activeSession ? (
            <>
              {/* Session Summary Card */}
              <div className="border border-zinc-900 rounded-xl bg-zinc-950/60 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-500">SESSION: {activeSession.id}</span>
                    <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded uppercase tracking-wide ${
                      activeSession.status === 'awaiting_approval' ? 'text-sky-400 bg-sky-500/10 border-sky-500/20' :
                      activeSession.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                      'text-zinc-500 bg-zinc-800/40 border-zinc-700/50'
                    }`}>
                      {activeSession.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-white">Incident: <span className="font-mono text-violet-400">{activeSession.incidentId}</span></h2>
                </div>
                <div className="text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-2">
                  <div>Strategy: <span className="text-zinc-300 font-medium">{activeSession.plan?.strategy || '—'}</span></div>
                  <div>Target Queue: <span className="text-zinc-300 font-mono font-medium">{activeSession.plan?.targetQueue || '—'}</span></div>
                </div>
              </div>

              {/* Specialized Agents Grid */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Active SRE Diagnostic Team</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(['incident_commander', 'telemetry', 'deployment', 'dependency', 'knowledge', 'recovery'] as AgentRole[]).map(role => {
                    const meta = AGENT_METADATA[role];
                    const Icon = meta.icon;
                    const sessionFinding = activeFindings.find((f: any) => f.agentRole === role);
                    const status = sessionFinding?.status || 'idle';
                    const score = sessionFinding?.confidenceScore || 0;
                    
                    return (
                      <div key={role} className="border border-zinc-900 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/60 transition-all p-4 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${meta.color}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-white leading-tight">{meta.name}</h4>
                                <span className="text-[9px] text-zinc-500 capitalize">{role}</span>
                              </div>
                            </div>
                            <span className={`text-[8px] font-bold border px-1.5 py-0.5 rounded uppercase tracking-wide ${AGENT_STATUS_COLORS[status]}`}>
                              {status}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">{sessionFinding?.analysis || meta.desc}</p>
                        </div>
                        {status === 'completed' && score > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-zinc-500">
                              <span>Domain Confidence</span>
                              <span className="font-bold text-zinc-300">{score}%</span>
                            </div>
                            <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Agent Findings Console Feed */}
              <div className="border border-zinc-900 rounded-xl bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-900 bg-zinc-900/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs font-bold text-zinc-300">Agent Team Console Feed</span>
                  </div>
                  
                  {/* Console filter tab bar */}
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {(['all', 'incident_commander', 'telemetry', 'deployment', 'dependency', 'knowledge', 'recovery'] as const).map(role => (
                      <button
                        key={role}
                        onClick={() => setSelectedConsoleRole(role)}
                        className={`text-[9px] font-semibold px-2 py-1 rounded transition-colors whitespace-nowrap ${
                          selectedConsoleRole === role
                            ? 'bg-zinc-800 text-white'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {role === 'all' ? 'All Logs' : role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 font-mono text-[11px] leading-relaxed text-zinc-300 bg-zinc-950 h-64 overflow-y-auto space-y-1.5 scrollbar-thin">
                  {filteredLogs.map((log, idx) => {
                    const meta = AGENT_METADATA[log.role];
                    return (
                      <div key={idx} className="flex items-start gap-2 border-b border-zinc-900/35 pb-1.5 last:border-0">
                        <span className="text-zinc-600 shrink-0 select-none">[{new Date(log.ts).toISOString().substring(11, 19)}]</span>
                        <span className={`shrink-0 font-bold ${meta.color.split(' ')[0]}`}>{meta.name}:</span>
                        <span className="text-zinc-200">{log.text}</span>
                      </div>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <div className="text-center py-10 text-zinc-700">Awaiting agent execution findings...</div>
                  )}
                </div>
              </div>

              {/* Consensus Dashboard */}
              {activeSession.consensusReport && (
                <div className="border border-violet-500/20 rounded-xl bg-violet-950/5 border-t-2 border-t-violet-500/40 p-5 space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-900 pb-3">
                    <div className="flex items-center space-x-2">
                      <Award className="w-4 h-4 text-violet-400" />
                      <h3 className="text-sm font-bold text-white tracking-wide uppercase">Final SRE Consensus Report</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">Consensus Strength:</span>
                      <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wide ${
                        activeSession.consensusReport.consensusStrength === 'high'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                      }`}>
                        {activeSession.consensusReport.consensusStrength}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Narrative Summary */}
                    <div className="md:col-span-2 space-y-4">
                      <div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Agreed Root Cause</div>
                        <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          {activeSession.consensusReport.agreedRootCause}
                        </p>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Narrative Summary</div>
                        <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-950/40 border border-zinc-900 rounded-lg p-3">
                          {activeSession.consensusReport.summary}
                        </p>
                      </div>
                    </div>

                    {/* Overall Confidence Meter */}
                    <div className="flex flex-col items-center justify-center border border-zinc-900 bg-zinc-950/20 rounded-xl p-4 text-center">
                      <div className="relative w-24 h-24 flex items-center justify-center">
                        {/* Radial progress simulator */}
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="48" cy="48" r="40" stroke="#18181b" strokeWidth="6" fill="transparent" />
                          <circle cx="48" cy="48" r="40" stroke="#8b5cf6" strokeWidth="6" fill="transparent"
                            strokeDasharray={251.2}
                            strokeDashoffset={251.2 - (251.2 * activeSession.consensusReport.overallConfidenceScore) / 100}
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold text-white">{activeSession.consensusReport.overallConfidenceScore}%</span>
                          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Team Confidence</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-3 leading-relaxed">Merges domain checks across Telemetry, Deployment, Topology, and SRE history.</p>
                    </div>
                  </div>

                  {/* Combined Evidence Mappings */}
                  {activeSession.evidence?.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Merged Telemetry Evidence</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {activeSession.evidence.slice(0, 4).map((ev: any) => {
                          const Icon = EVIDENCE_TYPE_ICONS[ev.type] || Activity;
                          return (
                            <div key={ev.id} className="bg-zinc-950/50 border border-zinc-900 rounded-lg p-2.5 flex gap-2.5 items-start">
                              <div className="w-6 h-6 rounded bg-zinc-900/80 border border-zinc-800 flex items-center justify-center shrink-0 text-zinc-400 mt-0.5">
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] text-zinc-300 leading-normal truncate">{ev.message}</p>
                                <span className="text-[8px] font-mono text-zinc-500 uppercase">{ev.type} · {ev.id}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Recommended Action Plan (Recovery Agent) */}
                  {activeSession.recommendedActions?.length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-zinc-900">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Consensus Recommended Remediation Plan</div>
                      
                      <div className="space-y-3">
                        {activeSession.recommendedActions.map((action: any) => (
                          <div key={action.id} className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            action.status === 'executed' ? 'border-emerald-500/20 bg-emerald-500/5' :
                            action.status === 'approved' ? 'border-sky-500/20 bg-sky-500/5' :
                            action.status === 'rejected' ? 'border-zinc-800 bg-zinc-900/10 opacity-60' :
                            'border-zinc-900 bg-zinc-950/30'
                          }`}>
                            <div className="space-y-1.5 max-w-xl">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">{action.description}</span>
                                <span className={`text-[8px] font-bold border px-1 py-0.5 rounded uppercase ${RISK_COLORS[action.riskLevel]}`}>
                                  {action.riskLevel} risk
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed">{action.reasoning}</p>
                              <div className="text-[9px] text-zinc-500">
                                Expected: <span className="text-zinc-300">{action.expectedOutcome}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                              {action.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => approveAction(action.id, 'approved')}
                                    disabled={!!approving}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/20 text-xs font-medium transition-all"
                                  >
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => approveAction(action.id, 'rejected')}
                                    disabled={!!approving}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 text-xs font-medium transition-all"
                                  >
                                    <ThumbsDown className="w-3.5 h-3.5" />
                                    Reject
                                  </button>
                                </>
                              )}
                              {action.status !== 'pending' && (
                                <span className={`text-[9px] font-bold border px-2 py-0.5 rounded uppercase ${
                                  action.status === 'approved' ? 'text-sky-400 border-sky-500/20 bg-sky-500/5' :
                                  action.status === 'rejected' ? 'text-zinc-500 border-zinc-700 bg-zinc-800/40' :
                                  'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                                }`}>
                                  {action.status}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Go to execution link */}
                      {activeSession.recommendedActions.some((a: any) => a.status === 'approved') && (
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={() => router.push('/remediation')}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all shadow-md"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Navigate to Execution Center</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="border border-zinc-900 rounded-xl bg-zinc-950/60 flex flex-col items-center justify-center py-24 space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-violet-400" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-base font-semibold text-zinc-200">No Active SRE Diagnostic Session</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Trigger multi-agent team SRE diagnostics for an active incident to run parallel checks across telemetry, releases, topography, and recovery plans.
                </p>
              </div>
              <button
                onClick={() => { fetchIncidents(); setShowIncidentModal(true); }}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all shadow-md"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Trigger SRE Diagnostic Team</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Diagnostic Trigger Modal ─────────────────────────────────────── */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-zinc-800 rounded-xl bg-zinc-900 p-6 w-full max-w-md shadow-2xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white">Trigger Multi-Agent SRE Diagnostics</h3>
              <p className="text-xs text-zinc-500 mt-1">Select an active incident queue path to dispatch the specialized agent team.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase">Select Active Incident</label>
              <select
                value={selectedIncidentId}
                onChange={(e) => setSelectedIncidentId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
              >
                <option value="">-- Choose Incident --</option>
                {incidents.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    [{inc.severity.toUpperCase()}] {inc.affectedQueue} - {inc.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowIncidentModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-750 text-zinc-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={runTeamAgent}
                disabled={!selectedIncidentId}
                className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                Dispatch SRE Team
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
