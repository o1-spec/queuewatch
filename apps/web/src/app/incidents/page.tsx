'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import { 
  AlertTriangle, Clock, RefreshCw, ChevronDown, ChevronUp, Sparkles, 
  Terminal, Activity, CheckCircle2, History, ShieldAlert, FileText, 
  Play, User, MessageSquare, ExternalLink, GitCommit, Check 
} from 'lucide-react';
import { Incident } from '@queuewatch/shared';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function IncidentsRegistry() {
  const { authFetch } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // V3 states & resources
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
  const [timelines, setTimelines] = useState<Record<string, any[]>>({});
  const [investigations, setInvestigations] = useState<Record<string, any>>({});
  const [incidentLogs, setIncidentLogs] = useState<Record<string, any[]>>({});
  const [incidentDlq, setIncidentDlq] = useState<Record<string, any[]>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [deployments, setDeployments] = useState<Record<string, any[]>>({});
  const [replayLoading, setReplayLoading] = useState<string | null>(null);

  // V4 states & resources
  const [copilotResponses, setCopilotResponses] = useState<Record<string, any>>({});
  const [copilotLoading, setCopilotLoading] = useState<Record<string, boolean>>({});
  const [copilotChatQuery, setCopilotChatQuery] = useState<Record<string, string>>({});
  const [showActionConfirmation, setShowActionConfirmation] = useState<{ action: () => void; message: string } | null>(null);

  // Workflows
  const [showResolveModal, setShowResolveModal] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});

  const loadCopilotResponse = async (incidentId: string, customPrompt?: string) => {
    setCopilotLoading(prev => ({ ...prev, [incidentId]: true }));
    try {
      const res = await authFetch(`${API_URL}/api/copilot/incident/${incidentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: customPrompt || 'Analyze this incident and recommend recovery steps.' }),
      });
      if (res.ok) {
        const data = await res.json();
        setCopilotResponses(prev => ({ ...prev, [incidentId]: data }));
      }
    } catch (e) {
      console.error('Failed to load copilot response:', e);
    } finally {
      setCopilotLoading(prev => ({ ...prev, [incidentId]: false }));
    }
  };

  const loadIncidents = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/incidents`);
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
      }
    } catch (e) {
      console.error('Failed to load incidents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  useSocket({
    'incident.created': (newIncident: Incident) => {
      setIncidents((prev) => [newIncident, ...prev.filter(i => i.id !== newIncident.id)]);
    },
    'incident.updated': (updatedIncident: Incident) => {
      setIncidents((prev) => prev.map(i => i.id === updatedIncident.id ? updatedIncident : i));
    },
    'incident.acknowledged': (updated: Incident) => {
      setIncidents((prev) => prev.map(i => i.id === updated.id ? updated : i));
    },
    'incident.assigned': (updated: Incident) => {
      setIncidents((prev) => prev.map(i => i.id === updated.id ? updated : i));
    },
    'incident.escalated': (updated: Incident) => {
      setIncidents((prev) => prev.map(i => i.id === updated.id ? updated : i));
    },
    'incident.resolved': (updated: Incident) => {
      setIncidents((prev) => prev.map(i => i.id === updated.id ? updated : i));
    },
    'incident.comment.created': (comment: any) => {
      setComments((prev) => ({
        ...prev,
        [comment.incidentId]: [...(prev[comment.incidentId] || []), comment],
      }));
    },
  });

  const loadTimeline = async (id: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/incidents/${id}/timeline`);
      if (res.ok) {
        const data = await res.json();
        setTimelines(prev => ({ ...prev, [id]: data }));
      }
    } catch (e) {
      console.error('Failed to load timeline:', e);
    }
  };

  const loadInvestigation = async (id: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/incidents/${id}/investigation`);
      if (res.ok) {
        const data = await res.json();
        setInvestigations(prev => ({ ...prev, [id]: data }));
      } else {
        setInvestigations(prev => ({ ...prev, [id]: null }));
      }
    } catch (e) {
      console.error('Failed to load investigation:', e);
    }
  };

  const loadIncidentLogs = async (id: string, queueName: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/logs?queueName=${queueName}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setIncidentLogs(prev => ({ ...prev, [id]: data }));
      }
    } catch (e) {
      console.error('Failed to load incident logs:', e);
    }
  };

  const loadIncidentDlq = async (id: string, queueName: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/dead-letter`);
      if (res.ok) {
        const data = await res.json();
        const filtered = data.filter((j: any) => j.queueName === queueName);
        setIncidentDlq(prev => ({ ...prev, [id]: filtered }));
      }
    } catch (e) {
      console.error('Failed to load incident dlq:', e);
    }
  };

  const loadComments = async (id: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/incidents/${id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(prev => ({ ...prev, [id]: data }));
      }
    } catch (e) {
      console.error('Failed to load comments:', e);
    }
  };

  const loadDeployments = async (id: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/deployments`);
      if (res.ok) {
        const data = await res.json();
        setDeployments(prev => ({ ...prev, [id]: data }));
      }
    } catch (e) {
      console.error('Failed to load deployments:', e);
    }
  };

  const handleTabChange = (incidentId: string, queueName: string, tab: string) => {
    setActiveTabs(prev => ({ ...prev, [incidentId]: tab }));
    if (tab === 'timeline') loadTimeline(incidentId);
    if (tab === 'investigation') loadInvestigation(incidentId);
    if (tab === 'logs') loadIncidentLogs(incidentId, queueName);
    if (tab === 'dlq') loadIncidentDlq(incidentId, queueName);
    if (tab === 'comments') loadComments(incidentId);
    if (tab === 'deployments') loadDeployments(incidentId);
    if (tab === 'copilot') loadCopilotResponse(incidentId);
  };

  const runInvestigation = async (id: string, queueName: string) => {
    setAnalyzingId(id);
    try {
      const res = await authFetch(`${API_URL}/api/incidents/${id}/investigate`, {
        method: 'POST',
      });
      if (res.ok) {
        const report = await res.json();
        setInvestigations(prev => ({ ...prev, [id]: report }));
        handleTabChange(id, queueName, 'investigation');
      }
    } catch (e) {
      console.error('Failed to run AI investigation:', e);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleReplayDlq = async (incidentId: string, queueName: string, jobId: string) => {
    setReplayLoading(jobId);
    try {
      const res = await authFetch(`${API_URL}/api/dead-letter/${jobId}/replay`, {
        method: 'POST',
      });
      if (res.ok) {
        loadIncidentDlq(incidentId, queueName);
      }
    } catch (e) {
      console.error('Failed to replay DLQ job:', e);
    } finally {
      setReplayLoading(null);
    }
  };

  const handleResolveDlq = async (incidentId: string, queueName: string, jobId: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/dead-letter/${jobId}/resolve`, {
        method: 'POST',
      });
      if (res.ok) {
        loadIncidentDlq(incidentId, queueName);
      }
    } catch (e) {
      console.error('Failed to resolve DLQ job:', e);
    }
  };

  // V3 incident workflow actions
  const handleAcknowledge = async (id: string) => {
    try {
      await authFetch(`${API_URL}/api/incidents/${id}/acknowledge`, { method: 'PATCH' });
    } catch (e) {
      console.error('Failed to acknowledge incident:', e);
    }
  };

  const handleAssign = async (id: string, userId: string, userName: string) => {
    try {
      await authFetch(`${API_URL}/api/incidents/${id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName }),
      });
    } catch (e) {
      console.error('Failed to assign incident:', e);
    }
  };

  const handleEscalate = async (id: string) => {
    try {
      await authFetch(`${API_URL}/api/incidents/${id}/escalate`, { method: 'PATCH' });
    } catch (e) {
      console.error('Failed to escalate incident:', e);
    }
  };

  const handleResolveSubmit = async () => {
    if (!showResolveModal || !resolutionText) return;
    try {
      await authFetch(`${API_URL}/api/incidents/${showResolveModal}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: resolutionText }),
      });
      setShowResolveModal(null);
      setResolutionText('');
    } catch (e) {
      console.error('Failed to resolve incident:', e);
    }
  };

  const handleAddComment = async (id: string) => {
    const text = newCommentText[id];
    if (!text) return;
    try {
      const res = await authFetch(`${API_URL}/api/incidents/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        setNewCommentText(prev => ({ ...prev, [id]: '' }));
        loadComments(id);
      }
    } catch (e) {
      console.error('Failed to add comment:', e);
    }
  };

  const handleDeleteComment = async (incidentId: string, commentId: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/incidents/${incidentId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadComments(incidentId);
      }
    } catch (e) {
      console.error('Failed to delete comment:', e);
    }
  };

  const handleCreateGitHubIssue = async (id: string) => {
    try {
      await authFetch(`${API_URL}/api/incidents/${id}/create-github-issue`, { method: 'POST' });
      loadIncidents();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateJiraTicket = async (id: string) => {
    try {
      await authFetch(`${API_URL}/api/incidents/${id}/create-jira-ticket`, { method: 'POST' });
      loadIncidents();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Page Header */}
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>Incident Response & Coordination Room</span>
        </h2>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          Real-time detected queue anomalies, engineer coordination logs, deployment correlation, and SLA escalations.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg h-28"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => {
            const isExpanded = expandedId === inc.id;
            const isAnalyzing = analyzingId === inc.id;
            const currentTab = activeTabs[inc.id] || 'overview';

            return (
              <div 
                key={inc.id}
                className={`bg-zinc-950 border rounded-lg p-4 transition-all ${
                  isExpanded 
                    ? 'border-zinc-700 bg-zinc-900/10' 
                    : inc.status === 'resolved' 
                      ? 'border-zinc-900 opacity-60 hover:opacity-90' 
                      : 'border-zinc-900 hover:border-zinc-800'
                }`}
              >
                {/* Header block */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start space-x-2.5 min-w-0">
                    <button
                      onClick={() => {
                        const nextExpanded = !isExpanded;
                        setExpandedId(nextExpanded ? inc.id : null);
                        if (nextExpanded) {
                          handleTabChange(inc.id, inc.affectedQueue, 'overview');
                        }
                      }}
                      className="mt-0.5 text-zinc-500 hover:text-white transition-colors shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-bold text-zinc-400 select-all">{inc.id}</span>
                        
                        {/* Status Badge */}
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase ${
                          inc.status === 'resolved' ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400' :
                          inc.status === 'acknowledged' ? 'bg-indigo-950/20 border-indigo-900 text-indigo-400' :
                          inc.status === 'investigating' ? 'bg-amber-950/20 border-amber-900 text-amber-400' :
                          'bg-rose-950/20 border-rose-900 text-rose-450'
                        }`}>
                          {inc.status}
                        </span>

                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase">
                          {inc.severity}
                        </span>
                        
                        <span className="text-zinc-500 text-[9px] font-sans">
                          Queue: <strong className="text-zinc-300 font-mono">{inc.affectedQueue}</strong>
                        </span>

                        {inc.responseOwner && (
                          <span className="text-zinc-500 text-[9px] font-sans flex items-center space-x-1">
                            <User className="w-3 h-3 text-zinc-500" />
                            <span>Owner: <strong className="text-zinc-300">{inc.responseOwner}</strong></span>
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-white text-[11px] mt-1.5">{inc.title}</h3>
                      <p className="text-[10px] text-zinc-400 font-sans mt-1 leading-relaxed">
                        {inc.summary}
                      </p>
                    </div>
                  </div>

                  {/* Workflow buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                    {inc.status === 'open' && (
                      <button
                        onClick={() => handleAcknowledge(inc.id)}
                        className="px-2 py-1 rounded bg-indigo-900 hover:bg-indigo-950 border border-indigo-850 text-white font-bold transition-all flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ACKNOWLEDGE</span>
                      </button>
                    )}

                    {inc.status !== 'resolved' && (
                      <>
                        {/* Assign to Dev */}
                        <button
                          onClick={() => handleAssign(inc.id, 'admin', 'Admin Owner')}
                          className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold transition-all flex items-center space-x-1"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>CLAIM</span>
                        </button>

                        <button
                          onClick={() => handleEscalate(inc.id)}
                          disabled={!!inc.escalatedAt}
                          className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-500 font-bold transition-all disabled:opacity-50 flex items-center space-x-1"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>ESCALATE</span>
                        </button>

                        <button
                          onClick={() => setShowResolveModal(inc.id)}
                          className="px-2 py-1 rounded bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-900 text-emerald-400 font-bold transition-all flex items-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>RESOLVE</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => runInvestigation(inc.id, inc.affectedQueue)}
                      disabled={isAnalyzing || inc.status === 'resolved'}
                      className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white font-bold transition-all disabled:opacity-50 flex items-center space-x-1"
                    >
                      {isAnalyzing ? (
                        <RefreshCw className="w-3 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                      <span>AI DIAGNOSTICS</span>
                    </button>
                  </div>
                </div>

                {/* Details / Tabs Panel */}
                {isExpanded && (
                  <div className="mt-4 border-t border-zinc-900 pt-4 space-y-4">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-zinc-900 text-[9px] font-bold flex-wrap">
                      <button
                        onClick={() => handleTabChange(inc.id, inc.affectedQueue, 'overview')}
                        className={`px-3 py-1.5 border-t-2 -mb-px transition-all uppercase flex items-center space-x-1 ${
                          currentTab === 'overview' ? 'border-indigo-500 text-white bg-zinc-900/40' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Overview</span>
                      </button>
                      
                      <button
                        onClick={() => handleTabChange(inc.id, inc.affectedQueue, 'timeline')}
                        className={`px-3 py-1.5 border-t-2 -mb-px transition-all uppercase flex items-center space-x-1 ${
                          currentTab === 'timeline' ? 'border-indigo-500 text-white bg-zinc-900/40' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>SRE Timeline</span>
                      </button>

                      <button
                        onClick={() => handleTabChange(inc.id, inc.affectedQueue, 'investigation')}
                        className={`px-3 py-1.5 border-t-2 -mb-px transition-all uppercase flex items-center space-x-1 ${
                          currentTab === 'investigation' ? 'border-indigo-500 text-white bg-zinc-900/40' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Investigation</span>
                      </button>

                      <button
                        onClick={() => handleTabChange(inc.id, inc.affectedQueue, 'comments')}
                        className={`px-3 py-1.5 border-t-2 -mb-px transition-all uppercase flex items-center space-x-1 ${
                          currentTab === 'comments' ? 'border-indigo-500 text-white bg-zinc-900/40' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Notes ({comments[inc.id]?.length || 0})</span>
                      </button>

                      <button
                        onClick={() => handleTabChange(inc.id, inc.affectedQueue, 'deployments')}
                        className={`px-3 py-1.5 border-t-2 -mb-px transition-all uppercase flex items-center space-x-1 ${
                          currentTab === 'deployments' ? 'border-indigo-500 text-white bg-zinc-900/40' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <GitCommit className="w-3.5 h-3.5" />
                        <span>Deployments</span>
                      </button>

                      <button
                        onClick={() => handleTabChange(inc.id, inc.affectedQueue, 'logs')}
                        className={`px-3 py-1.5 border-t-2 -mb-px transition-all uppercase flex items-center space-x-1 ${
                          currentTab === 'logs' ? 'border-indigo-500 text-white bg-zinc-900/40' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Queue Logs</span>
                      </button>

                      <button
                        onClick={() => handleTabChange(inc.id, inc.affectedQueue, 'dlq')}
                        className={`px-3 py-1.5 border-t-2 -mb-px transition-all uppercase flex items-center space-x-1 ${
                          currentTab === 'dlq' ? 'border-indigo-500 text-white bg-zinc-900/40' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>DLQ Jobs</span>
                      </button>

                      <button
                        onClick={() => handleTabChange(inc.id, inc.affectedQueue, 'copilot')}
                        className={`px-3 py-1.5 border-t-2 -mb-px transition-all uppercase flex items-center space-x-1 ${
                          currentTab === 'copilot' ? 'border-indigo-500 text-white bg-zinc-900/40' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                        <span>Reliability Copilot</span>
                      </button>
                    </div>

                    {/* Tab Contents */}
                    <div className="pt-2">
                      {/* Overview Tab */}
                      {currentTab === 'overview' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Left Side: Root Cause & Diagnostics */}
                            <div className="space-y-3">
                              <div className="p-3.5 bg-black/40 border border-zinc-900 rounded space-y-2">
                                <h4 className="text-[9.5px] font-bold text-white uppercase border-b border-zinc-900 pb-1.5 flex items-center space-x-1">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>AI operational insight</span>
                                </h4>
                                <div className="space-y-2 font-sans text-zinc-350 text-xs">
                                  <p><strong>Suspected Cause:</strong> {inc.suspectedRootCause}</p>
                                  <p><strong>Impact:</strong> {inc.impact}</p>
                                </div>
                              </div>

                              {inc.recommendation && (
                                <div className="p-3.5 bg-indigo-950/10 border border-indigo-900/30 rounded space-y-1.5">
                                  <h4 className="text-[9.5px] font-bold text-white uppercase flex items-center space-x-1 font-mono">
                                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>Remediation Recommendation</span>
                                  </h4>
                                  <p className="font-sans text-zinc-350 text-xs leading-normal">
                                    {inc.recommendation}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Right Side: Evidence Logs */}
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase">TELEMETRY EVIDENCE</span>
                                <pre className="bg-rose-950/5 border border-rose-900/10 p-3.5 rounded text-[9.5px] text-rose-350 font-mono overflow-x-auto leading-relaxed select-all">
                                  {inc.evidence}
                                </pre>
                              </div>

                              {inc.relatedErrors && inc.relatedErrors.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase">RELATED EXCEPTIONS</span>
                                  <div className="bg-black/20 border border-zinc-900 rounded p-3 space-y-1.5 font-mono text-[9px] max-h-36 overflow-y-auto">
                                    {inc.relatedErrors.map((err, idx) => (
                                      <div key={idx} className="text-rose-400/80 border-b border-zinc-900/40 pb-1 last:border-b-0">
                                        &rarr; {err}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Ticket Integrations */}
                          <div className="border-t border-zinc-900 pt-3 flex flex-wrap items-center gap-3">
                            <span className="text-[9px] text-zinc-500 uppercase font-bold">External Trackers:</span>
                            
                            {inc.githubIssueUrl ? (
                              <a href={inc.githubIssueUrl} target="_blank" rel="noreferrer" className="flex items-center space-x-1 text-sky-400 font-bold hover:underline">
                                <span>GitHub Issue</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <button onClick={() => handleCreateGitHubIssue(inc.id)} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white font-bold">
                                Create GitHub Issue
                              </button>
                            )}

                            {inc.jiraTicketUrl ? (
                              <a href={inc.jiraTicketUrl} target="_blank" rel="noreferrer" className="flex items-center space-x-1 text-sky-400 font-bold hover:underline">
                                <span>Jira Ticket</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <button onClick={() => handleCreateJiraTicket(inc.id)} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white font-bold">
                                Create Jira Ticket
                              </button>
                            )}
                          </div>

                          {/* Postmortem Summary */}
                          {inc.status === 'resolved' && inc.resolutionSummary && (
                            <div className="border-t border-zinc-900 pt-4 space-y-2">
                              <span className="text-[9px] font-bold text-zinc-500 uppercase block">POST-INCIDENT POSTMORTEM SUMMARY</span>
                              <div className="bg-zinc-900/10 border border-zinc-900 p-4 rounded text-zinc-350 leading-relaxed font-sans whitespace-pre-wrap text-xs">
                                {inc.resolutionSummary}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Timeline Tab */}
                      {currentTab === 'timeline' && (
                        <div className="space-y-4 max-w-2xl">
                          <div className="border-l-2 border-zinc-800 ml-3.5 space-y-5 py-2">
                            {(timelines[inc.id] || []).map((t, idx) => (
                              <div key={idx} className="relative pl-6">
                                <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                </div>
                                <div className="space-y-1 bg-zinc-900/20 border border-zinc-900/60 p-3 rounded-lg">
                                  <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-white uppercase text-[10px]">{t.title}</h4>
                                    <span className="text-zinc-500 font-sans">{new Date(t.timestamp).toLocaleTimeString()}</span>
                                  </div>
                                  <p className="text-zinc-450 font-sans text-xs">{t.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Investigation Tab */}
                      {currentTab === 'investigation' && (
                        <div className="space-y-4">
                          {investigations[inc.id] === undefined ? (
                            <div className="text-zinc-500 animate-pulse py-6">Connecting diagnostic reports...</div>
                          ) : investigations[inc.id] === null ? (
                            <div className="bg-zinc-950 border border-zinc-900 p-8 rounded text-center space-y-3">
                              <Sparkles className="w-6 h-6 text-indigo-400 mx-auto" />
                              <h3 className="text-white font-bold uppercase">No Investigation Report Captured</h3>
                              <p className="text-zinc-500 text-xs font-sans max-w-md mx-auto">
                                The Incident Investigation Agent has not run on this incident. Trigger diagnostic steps now to trace failing jobs, evaluate metrics, and audit root causes.
                              </p>
                              <button
                                onClick={() => runInvestigation(inc.id, inc.affectedQueue)}
                                disabled={isAnalyzing}
                                className="px-3 py-1.5 rounded bg-indigo-900/40 hover:bg-indigo-950 border border-indigo-900 text-indigo-200 text-[10px] font-bold transition-all shadow"
                              >
                                {isAnalyzing ? 'RUNNING AGENT...' : 'EXECUTE INVESTIGATION'}
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-4 font-mono">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg space-y-2">
                                  <span className="text-zinc-500 uppercase text-[9px] font-bold block">CONFIDENCE SCORE</span>
                                  <div className="flex items-baseline space-x-1.5">
                                    <span className="text-2xl font-bold text-white">{investigations[inc.id].confidenceScore}%</span>
                                  </div>
                                </div>
                                <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg space-y-2 md:col-span-2">
                                  <span className="text-zinc-500 uppercase text-[9px] font-bold block">ROOT CAUSE DETERMINATION</span>
                                  <p className="text-zinc-300 font-sans text-xs">{investigations[inc.id].rootCause}</p>
                                </div>
                              </div>

                              <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg space-y-2.5">
                                <span className="text-zinc-500 uppercase text-[9px] font-bold block">TIMELINE DIAGNOSTIC SUMMARY</span>
                                <p className="text-zinc-400 font-sans text-xs leading-relaxed">{investigations[inc.id].timelineSummary}</p>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg space-y-3">
                                  <span className="text-zinc-500 uppercase text-[9px] font-bold block">EVIDENCE AUDITED</span>
                                  <ul className="space-y-1.5 font-sans text-zinc-450 text-xs">
                                    {investigations[inc.id].evidence?.map((ev: string, idx: number) => (
                                      <li key={idx} className="flex items-start space-x-2">
                                        <span className="text-rose-500 font-bold font-mono text-[10px] shrink-0 mt-0.5">&bull;</span>
                                        <span>{ev}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg space-y-3">
                                  <span className="text-zinc-500 uppercase text-[9px] font-bold block">RECOMMENDED REMEDIATION ACTIONS</span>
                                  <ul className="space-y-1.5 font-sans text-zinc-450 text-xs">
                                    {investigations[inc.id].recommendedActions?.map((act: string, idx: number) => (
                                      <li key={idx} className="flex items-start space-x-2">
                                        <span className="text-indigo-400 font-bold font-mono text-[10px] shrink-0 mt-0.5">&rarr;</span>
                                        <span>{act}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Comments Notebook Tab */}
                      {currentTab === 'comments' && (
                        <div className="space-y-4">
                          <div className="bg-black/20 border border-zinc-900 rounded p-4 max-h-64 overflow-y-auto space-y-3">
                            {(comments[inc.id] || []).map((c, idx) => (
                              <div key={c.id || idx} className="flex items-start justify-between border-b border-zinc-900/50 pb-2 last:border-0 gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-white text-[9px] uppercase">{c.userName}</span>
                                    <span className="text-zinc-550 font-sans text-[8px]">{new Date(c.createdAt).toLocaleTimeString()}</span>
                                  </div>
                                  <p className="text-zinc-300 font-sans text-xs">{c.message}</p>
                                </div>
                                <button
                                  onClick={() => handleDeleteComment(inc.id, c.id)}
                                  className="text-zinc-600 hover:text-rose-400 text-[8px]"
                                >
                                  DELETE
                                </button>
                              </div>
                            ))}

                            {(!comments[inc.id] || comments[inc.id].length === 0) && (
                              <p className="text-zinc-650 py-4 text-center">No coordination notes or investigation logs added yet.</p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Write a diagnostic note or updates..."
                              value={newCommentText[inc.id] || ''}
                              onChange={(e) => setNewCommentText(prev => ({ ...prev, [inc.id]: e.target.value }))}
                              className="flex-1 bg-black/40 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-zinc-800 text-xs font-sans"
                            />
                            <button
                              onClick={() => handleAddComment(inc.id)}
                              className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-bold border border-zinc-800"
                            >
                              POST NOTE
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Related Deployments Tab */}
                      {currentTab === 'deployments' && (
                        <div className="space-y-3">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase block">Recent Release Releases (Correlated within 30 mins)</span>
                          <div className="space-y-2">
                            {(deployments[inc.id] || []).map((dep) => {
                              const delay = inc.firstDetectedAt - dep.deployedAt;
                              const isRelated = delay >= 0 && delay <= 30 * 60 * 1000;
                              return (
                                <div key={dep.id} className={`p-3 border rounded flex items-center justify-between gap-4 ${
                                  isRelated ? 'border-rose-900 bg-rose-950/5' : 'border-zinc-900 bg-zinc-900/5'
                                }`}>
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <strong className="text-white uppercase">{dep.service}</strong>
                                      <span className="text-indigo-400 font-bold">{dep.version}</span>
                                    </div>
                                    <p className="text-zinc-550 font-sans text-xs mt-0.5">
                                      Commit SHA: <code className="font-mono text-zinc-400">{dep.commitSha}</code> &bull; Deployed by {dep.deployedBy} at {new Date(dep.deployedAt).toLocaleTimeString()}
                                    </p>
                                  </div>
                                  
                                  {isRelated ? (
                                    <span className="px-2 py-0.5 bg-rose-950/30 border border-rose-900 text-rose-450 font-bold text-[8.5px] rounded uppercase shrink-0">
                                      ⚠️ Suspected Cause
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600 font-bold text-[8.5px] uppercase shrink-0">Unrelated</span>
                                  )}
                                </div>
                              );
                            })}

                            {(!deployments[inc.id] || deployments[inc.id].length === 0) && (
                              <p className="text-zinc-650 py-4 text-center">No deployment events registered in release log.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Queue Logs Tab */}
                      {currentTab === 'logs' && (
                        <div className="bg-black/40 border border-zinc-900 rounded p-4 max-h-72 overflow-y-auto space-y-2">
                          {(incidentLogs[inc.id] || []).map((l, idx) => (
                            <div key={idx} className="flex items-start gap-2 border-b border-zinc-900/40 pb-1 last:border-b-0">
                              <span className="text-zinc-650 shrink-0">{new Date(l.timestamp).toLocaleTimeString()}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[7px] font-bold ${
                                l.level === 'error' ? 'bg-rose-950/40 text-rose-400 border border-rose-900/50' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                              }`}>{l.level.toUpperCase()}</span>
                              <span className="text-zinc-350 font-sans text-xs flex-1 break-all">{l.message}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* DLQ Jobs Tab */}
                      {currentTab === 'dlq' && (
                        <div className="border border-zinc-900 rounded overflow-hidden">
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="bg-zinc-900/30 border-b border-zinc-900 text-zinc-500 font-bold uppercase text-[8px]">
                                <th className="p-3">Job ID</th>
                                <th className="p-3">Action Name</th>
                                <th className="p-3">Attempts</th>
                                <th className="p-3">Failure Reason</th>
                                <th className="p-3 text-right">Recovery</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(incidentDlq[inc.id] || []).map((job) => (
                                <tr key={job.id} className="border-b border-zinc-900/40 last:border-0 hover:bg-zinc-900/5">
                                  <td className="p-3 text-zinc-400 select-all font-bold">{job.id}</td>
                                  <td className="p-3 text-white font-semibold">{job.jobName}</td>
                                  <td className="p-3 text-zinc-455">{job.attemptsMade} / {job.maxAttempts}</td>
                                  <td className="p-3 text-rose-450 truncate max-w-xs">{job.failedReason}</td>
                                  <td className="p-3 text-right space-x-2">
                                    <button
                                      onClick={() => handleReplayDlq(inc.id, inc.affectedQueue, job.id)}
                                      disabled={replayLoading === job.id}
                                      className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-zinc-800 text-[9px] font-bold"
                                    >
                                      Replay
                                    </button>
                                    <button
                                      onClick={() => handleResolveDlq(inc.id, inc.affectedQueue, job.id)}
                                      className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-850 text-zinc-500 hover:text-white border border-zinc-800 text-[9px] font-bold"
                                    >
                                      Resolve
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Reliability Copilot Tab */}
                      {currentTab === 'copilot' && (
                        <div className="space-y-4 font-mono">
                          {copilotLoading[inc.id] ? (
                            <div className="text-zinc-500 animate-pulse py-6">Consulting Reliability Copilot...</div>
                          ) : !copilotResponses[inc.id] ? (
                            <div className="bg-zinc-950 border border-zinc-900 p-8 rounded text-center space-y-3">
                              <Sparkles className="w-6 h-6 text-indigo-400 mx-auto animate-pulse" />
                              <h3 className="text-white font-bold uppercase">Reliability Copilot Offline</h3>
                              <p className="text-zinc-550 text-xs font-sans max-w-md mx-auto">
                                Failed to retrieve copilot diagnostics.
                              </p>
                              <button
                                onClick={() => loadCopilotResponse(inc.id)}
                                className="px-3 py-1.5 rounded bg-indigo-900/40 hover:bg-indigo-950 border border-indigo-900 text-indigo-200 text-[10px] font-bold"
                              >
                                RETRY COPILOT CONSULT
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {/* Confidence Score Panel */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg space-y-2">
                                  <span className="text-zinc-555 uppercase text-[9px] font-bold block">CONFIDENCE SCORE</span>
                                  <div className="flex items-baseline space-x-1.5">
                                    <span className={`text-2xl font-bold ${copilotResponses[inc.id].confidenceScore <= 40 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                      {copilotResponses[inc.id].confidenceScore}%
                                    </span>
                                    <span className="text-zinc-500 text-[9px] uppercase">
                                      {copilotResponses[inc.id].confidenceScore <= 40 ? 'Low Confidence' : 'High Confidence'}
                                    </span>
                                  </div>
                                  
                                  {copilotResponses[inc.id].confidenceScore <= 40 && (
                                    <div className="mt-2 text-rose-450 border border-rose-950 bg-rose-950/15 p-2 rounded text-[9px] font-bold leading-normal">
                                      <div>CONFIDENCE: LOW</div>
                                      <div>REASON: No related logs or deployment events found.</div>
                                    </div>
                                  )}
                                </div>

                                <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg space-y-2 md:col-span-2">
                                  <span className="text-zinc-555 uppercase text-[9px] font-bold block">COPILOT ANALYSIS</span>
                                  <p className="text-zinc-300 font-sans text-xs whitespace-pre-wrap leading-relaxed">
                                    {copilotResponses[inc.id].answer}
                                  </p>
                                </div>
                              </div>

                              {/* Grounded Evidence Checklist */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg space-y-3">
                                  <span className="text-zinc-555 uppercase text-[9px] font-bold block">GROUNDED TELEMETRY EVIDENCE</span>
                                  {copilotResponses[inc.id].evidence && copilotResponses[inc.id].evidence.length > 0 ? (
                                    <ul className="space-y-1.5 font-mono text-zinc-350 text-xs">
                                      {copilotResponses[inc.id].evidence.map((ev: string, idx: number) => (
                                        <li key={idx} className="flex items-start space-x-2 bg-black/20 p-2 border border-zinc-900 rounded">
                                          <span className="text-indigo-400 font-bold shrink-0 mt-0.5">&bull;</span>
                                          <span>{ev}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-zinc-550 text-xs font-sans">No primary telemetry evidence was linked to this claim.</p>
                                  )}
                                </div>

                                {/* Suggested Recovery Actions */}
                                <div className="bg-zinc-900/20 border border-zinc-900 p-4 rounded-lg space-y-3">
                                  <span className="text-zinc-555 uppercase text-[9px] font-bold block">RECOMMENDED RECOVERY ACTIONS</span>
                                  {copilotResponses[inc.id].recommendedActions && copilotResponses[inc.id].recommendedActions.length > 0 ? (
                                    <div className="space-y-3">
                                      <ul className="space-y-1.5 font-sans text-zinc-350 text-xs">
                                        {copilotResponses[inc.id].recommendedActions.map((act: string, idx: number) => (
                                          <li key={idx} className="flex items-start space-x-2">
                                            <span className="text-amber-500 font-bold font-mono text-[10px] shrink-0 mt-0.5">&rarr;</span>
                                            <span>{act}</span>
                                          </li>
                                        ))}
                                      </ul>

                                      <div className="border-t border-zinc-900 pt-3 flex flex-wrap gap-2">
                                        {/* Recovery triggers - Claim, Replay DLQ, Pause Queue */}
                                        <button
                                          onClick={() => {
                                            setShowActionConfirmation({
                                              message: "This action will claim ownership and assign you to investigate this incident.",
                                              action: () => handleAssign(inc.id, 'admin', 'Admin Owner')
                                            });
                                          }}
                                          className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[9.5px] font-bold"
                                        >
                                          CLAIM INCIDENT
                                        </button>

                                        <button
                                          onClick={() => {
                                            setShowActionConfirmation({
                                              message: "This action will replay all dead-letter queue jobs for this incident queue.",
                                              action: () => {
                                                // Replay all jobs by looping or using incident DLQ if any
                                                const dlqJobs = incidentDlq[inc.id] || [];
                                                if (dlqJobs.length === 0) {
                                                  alert("No DLQ jobs loaded yet in tab. Try loading DLQ Jobs tab first.");
                                                  return;
                                                }
                                                dlqJobs.forEach((job: any) => {
                                                  handleReplayDlq(inc.id, inc.affectedQueue, job.id);
                                                });
                                              }
                                            });
                                          }}
                                          className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-emerald-450 border border-zinc-800 text-[9.5px] font-bold"
                                        >
                                          REPLAY ALL DLQ JOBS
                                        </button>

                                        <button
                                          onClick={() => {
                                            setShowActionConfirmation({
                                              message: `This action will pause all background consumers processing queue '${inc.affectedQueue}'.`,
                                              action: async () => {
                                                try {
                                                  await authFetch(`${API_URL}/api/queues/${inc.affectedQueue}/pause`, { method: 'POST' });
                                                  alert(`Queue ${inc.affectedQueue} paused.`);
                                                } catch (e) {
                                                  console.error(e);
                                                }
                                              }
                                            });
                                          }}
                                          className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-rose-450 border border-zinc-800 text-[9.5px] font-bold"
                                        >
                                          PAUSE QUEUE CONSUMERS
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-zinc-550 text-xs font-sans">No recovery actions recommended.</p>
                                  )}
                                </div>
                              </div>

                              {/* Copilot Chat Input */}
                              <div className="border-t border-zinc-900 pt-4 space-y-3">
                                <span className="text-zinc-555 uppercase text-[9px] font-bold block">ASK COPILOT FOLLOW-UP QUESTION</span>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="e.g., Why did this occur after the webhook release?"
                                    value={copilotChatQuery[inc.id] || ''}
                                    onChange={(e) => setCopilotChatQuery(prev => ({ ...prev, [inc.id]: e.target.value }))}
                                    className="flex-1 bg-black/40 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-zinc-800 text-xs font-sans"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && copilotChatQuery[inc.id]) {
                                        loadCopilotResponse(inc.id, copilotChatQuery[inc.id]);
                                        setCopilotChatQuery(prev => ({ ...prev, [inc.id]: '' }));
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      if (copilotChatQuery[inc.id]) {
                                        loadCopilotResponse(inc.id, copilotChatQuery[inc.id]);
                                        setCopilotChatQuery(prev => ({ ...prev, [inc.id]: '' }));
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-bold border border-zinc-800"
                                  >
                                    ASK
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-4 text-[9px] text-zinc-500 font-bold border-t border-zinc-900/40 pt-2.5">
                      <span>DETECTED AT: <span className="text-zinc-400 font-sans">{new Date(inc.firstDetectedAt).toLocaleString()}</span></span>
                      <span>&bull;</span>
                      <span>LAST RECALCULATED: <span className="text-zinc-400 font-sans">{new Date(inc.lastUpdatedAt).toLocaleString()}</span></span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {incidents.length === 0 && (
            <div className="bg-zinc-950 border border-zinc-900 p-12 rounded-lg text-center space-y-2.5">
              <div className="inline-flex p-3 rounded bg-zinc-900 text-emerald-400 border border-zinc-900">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-white font-bold text-xs uppercase tracking-tight">No anomalies detected</h3>
              <p className="text-[10px] text-zinc-500 max-w-sm mx-auto leading-relaxed font-sans">
                All consumer background workers are reporting positive heartbeats and processing workloads inside active SLAs.
              </p>
            </div>
          )}
        </div>
      )}

      {/* RESOLUTION DIALOG MODAL */}
      {showResolveModal && (
        <>
          <div onClick={() => setShowResolveModal(null)} className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 transition-opacity"></div>
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-950 border border-zinc-900 p-5 rounded-lg shadow-2xl z-50 font-mono text-[10px] text-zinc-350 space-y-4">
            <div className="border-b border-zinc-900 pb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold text-white uppercase">Acknowledge Incident Resolution</span>
              <button onClick={() => setShowResolveModal(null)} className="text-zinc-500 hover:text-white">&times;</button>
            </div>
            
            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Resolution Summary Description</label>
              <textarea
                placeholder="Explain what repair actions were taken to restore service stability..."
                rows={4}
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                className="w-full bg-black/40 border border-zinc-900 rounded p-2 text-white focus:outline-none focus:border-zinc-800 text-xs font-sans"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowResolveModal(null)}
                className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 font-bold"
              >
                CANCEL
              </button>
              <button
                onClick={handleResolveSubmit}
                className="px-3 py-1.5 rounded bg-emerald-900 hover:bg-emerald-950 text-white border border-emerald-800 font-bold"
              >
                CONFIRM RESOLUTION
              </button>
            </div>
          </div>
        </>
      )}
      {/* SAFE RECOVERY ACTION CONFIRMATION MODAL */}
      {showActionConfirmation && (
        <>
          <div onClick={() => setShowActionConfirmation(null)} className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 transition-opacity"></div>
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-950 border border-rose-900 p-6 rounded-lg shadow-2xl z-50 font-mono text-[10px] text-zinc-350 space-y-4">
            <div className="border-b border-rose-950 pb-3 flex items-center space-x-2 text-rose-400">
              <ShieldAlert className="w-5 h-5 shrink-0 animate-bounce" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Manual Action Warning</span>
            </div>
            
            <div className="p-3 bg-rose-950/10 border border-rose-900/30 rounded text-rose-350 text-xs font-sans leading-relaxed">
              <strong>This action requires manual engineer execution.</strong>
            </div>

            <p className="text-[10px] text-zinc-450 font-sans leading-relaxed">
              {showActionConfirmation.message}
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowActionConfirmation(null)}
                className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 text-zinc-400 font-bold"
              >
                ABORT
              </button>
              <button
                onClick={() => {
                  showActionConfirmation.action();
                  setShowActionConfirmation(null);
                }}
                className="px-3 py-1.5 rounded bg-rose-900 hover:bg-rose-950 text-white border border-rose-800 font-bold"
              >
                EXECUTE MANUALLY
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
