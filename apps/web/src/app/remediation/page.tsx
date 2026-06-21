'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Wrench, CheckCircle, XCircle, Clock, Zap, RotateCcw,
  ChevronDown, ChevronUp, AlertTriangle, TrendingDown,
  TrendingUp, Activity, Shield, RefreshCw, Play, Ban,
  BarChart3, Info, ExternalLink, ChevronRight
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type RemediationStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'rolled_back';

interface AgentAction {
  id: string;
  type: string;
  description: string;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
  expectedOutcome: string;
  estimatedRecoveryMin: number;
  command?: string;
  status: string;
}

interface RollbackPlan {
  description: string;
  rollbackActionType: string;
  automatic: boolean;
}

interface VerificationResult {
  checkedAt: number;
  passed: boolean;
  improved: boolean;
  failureRateBefore: number;
  failureRateAfter: number;
  latencyBefore: number;
  latencyAfter: number;
  reliabilityScoreBefore: number;
  reliabilityScoreAfter: number;
  incidentStatusBefore: string;
  incidentStatusAfter: string;
  summary: string;
}

interface RemediationRecord {
  id: string;
  sessionId?: string;
  incidentId: string;
  projectId: string;
  action: AgentAction;
  rollbackPlan: RollbackPlan;
  status: RemediationStatus;
  approvedBy?: string;
  approvedAt?: number;
  rejectedBy?: string;
  rejectedAt?: number;
  executedAt?: number;
  completedAt?: number;
  verificationResult?: VerificationResult;
  executionLog: string[];
  createdAt: number;
}

type TabKey = 'pending' | 'approved' | 'executing' | 'completed' | 'failed';

// ─── Helpers ────────────────────────────────────────────────────────────────────

const humanize = (s: string) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const fmtTime = (ts?: number) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (ts?: number) => ts ? new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const RISK_COLORS: Record<string, string> = {
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  high: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

const STATUS_COLORS: Record<RemediationStatus, string> = {
  pending_approval: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  approved: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  rejected: 'text-zinc-400 bg-zinc-800/50 border-zinc-700',
  executing: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  succeeded: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  failed: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  rolled_back: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

const ACTION_TYPE_ICONS: Record<string, string> = {
  pause_queue: '⏸',
  resume_queue: '▶',
  replay_dlq: '🔄',
  ack_incident: '✅',
  resolve_incident: '🏁',
  scale_workers: '⚖',
  restart_worker: '🔃',
  rollback_deployment: '⏪',
  investigate_deployment: '🔍',
  reduce_concurrency: '↓',
  trigger_runbook: '📋',
};

// ─── Tab filter logic ────────────────────────────────────────────────────────────

const TAB_FILTERS: Record<TabKey, RemediationStatus[]> = {
  pending: ['pending_approval'],
  approved: ['approved'],
  executing: ['executing'],
  completed: ['succeeded', 'rolled_back'],
  failed: ['failed'],
};

// ─── VerificationWidget ─────────────────────────────────────────────────────────

function VerificationWidget({ vr }: { vr: VerificationResult }) {
  const delta = (before: number, after: number, lowerIsBetter: boolean) => {
    const diff = after - before;
    if (diff === 0) return <span className="text-zinc-500">→ {after}</span>;
    const improved = lowerIsBetter ? diff < 0 : diff > 0;
    return (
      <span className={improved ? 'text-emerald-400' : 'text-rose-400'}>
        {before} → {after} {improved ? '↓' : '↑'}
      </span>
    );
  };

  return (
    <div className={`mt-4 rounded-lg border p-4 ${vr.improved ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className={`w-4 h-4 ${vr.improved ? 'text-emerald-400' : 'text-amber-400'}`} />
        <span className={`text-sm font-semibold ${vr.improved ? 'text-emerald-400' : 'text-amber-400'}`}>
          {vr.improved ? '✅ System Improved' : '⚠️ No Clear Improvement'}
        </span>
        <span className="ml-auto text-xs text-zinc-500">Verified at {fmtTime(vr.checkedAt)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1.5">
          <div className="text-zinc-500 font-medium">Failure Rate</div>
          <div className="font-mono">{delta(vr.failureRateBefore, vr.failureRateAfter, true)}%</div>
        </div>
        <div className="space-y-1.5">
          <div className="text-zinc-500 font-medium">Latency</div>
          <div className="font-mono">{delta(vr.latencyBefore, vr.latencyAfter, true)}ms</div>
        </div>
        <div className="space-y-1.5">
          <div className="text-zinc-500 font-medium">Reliability Score</div>
          <div className="font-mono">{delta(vr.reliabilityScoreBefore, vr.reliabilityScoreAfter, false)}%</div>
        </div>
        <div className="space-y-1.5">
          <div className="text-zinc-500 font-medium">Incident Status</div>
          <div className="font-mono capitalize">
            <span className="text-zinc-400">{vr.incidentStatusBefore}</span>
            <span className="text-zinc-600"> → </span>
            <span className={vr.incidentStatusAfter === 'resolved' ? 'text-emerald-400' : 'text-zinc-300'}>{vr.incidentStatusAfter}</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-400 border-t border-zinc-800 pt-3">{vr.summary}</p>
    </div>
  );
}

// ─── RemediationCard ─────────────────────────────────────────────────────────────

function RemediationCard({
  record,
  onApprove,
  onReject,
  onExecute,
  onRollback,
  loading,
}: {
  record: RemediationRecord;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExecute: (id: string) => void;
  onRollback: (id: string) => void;
  loading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const isLoading = loading === record.id;

  return (
    <div className="border border-zinc-800/60 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/70 transition-all duration-200 overflow-hidden">
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Action type icon */}
          <div className="w-9 h-9 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-lg shrink-0">
            {ACTION_TYPE_ICONS[record.action.type] || '⚡'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white">{humanize(record.action.type)}</h3>
              <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded uppercase tracking-wide ${STATUS_COLORS[record.status]}`}>
                {humanize(record.status)}
              </span>
              <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded uppercase ${RISK_COLORS[record.action.riskLevel]}`}>
                {record.action.riskLevel} risk
              </span>
              <span className="text-[10px] text-zinc-500 ml-auto">{fmtDate(record.createdAt)}</span>
            </div>

            <p className="text-xs text-zinc-400 mt-1 leading-relaxed line-clamp-2">{record.action.description}</p>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-[10px] text-zinc-500">
                📌 <span className="font-mono text-zinc-400">{record.incidentId}</span>
              </span>
              <span className="text-[10px] text-zinc-500">
                ⏱ ~{record.action.estimatedRecoveryMin}min
              </span>
              {record.approvedBy && (
                <span className="text-[10px] text-zinc-500">
                  ✓ Approved by <span className="text-emerald-400">{record.approvedBy}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {record.status === 'pending_approval' && (
            <>
              <button
                onClick={() => onApprove(record.id)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-medium transition-all disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {isLoading ? 'Approving…' : 'Approve'}
              </button>
              <button
                onClick={() => onReject(record.id)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium transition-all disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
            </>
          )}

          {record.status === 'approved' && (
            <button
              onClick={() => onExecute(record.id)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {isLoading ? 'Executing…' : 'Execute Action'}
            </button>
          )}

          {(record.status === 'succeeded' || record.status === 'failed') && (
            <button
              onClick={() => onRollback(record.id)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-medium transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isLoading ? 'Rolling back…' : 'Rollback'}
            </button>
          )}

          {record.status === 'executing' && (
            <div className="flex items-center gap-2 text-violet-400 text-xs">
              <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              Executing…
            </div>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Less' : 'Details'}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-zinc-800/60 p-4 space-y-4 bg-zinc-950/40">
          {/* Reasoning */}
          <div>
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Reasoning</div>
            <p className="text-xs text-zinc-300 leading-relaxed">{record.action.reasoning}</p>
          </div>

          {/* Expected outcome */}
          <div>
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Expected Outcome</div>
            <p className="text-xs text-zinc-300 leading-relaxed">{record.action.expectedOutcome}</p>
          </div>

          {/* Rollback Plan */}
          <div>
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Rollback Plan</div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-start gap-2">
              <RotateCcw className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-zinc-300">{record.rollbackPlan.description}</p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Action: <span className="text-orange-400 font-mono">{record.rollbackPlan.rollbackActionType}</span>
                  {record.rollbackPlan.automatic && (
                    <span className="ml-2 text-[9px] text-amber-400 border border-amber-500/20 bg-amber-500/10 px-1 py-0.5 rounded">AUTO</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Verification Result */}
          {record.verificationResult && (
            <div>
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Verification</div>
              <VerificationWidget vr={record.verificationResult} />
            </div>
          )}

          {/* Execution Log */}
          <div>
            <button
              onClick={() => setShowLog(prev => !prev)}
              className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors flex items-center gap-1"
            >
              {showLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Execution Log ({record.executionLog.length})
            </button>
            {showLog && (
              <div className="mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono space-y-1 max-h-40 overflow-y-auto">
                {record.executionLog.map((line, i) => (
                  <div key={i} className="text-[10px] text-zinc-400 leading-relaxed">{line}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
      <div className="text-xs font-semibold text-zinc-400">{label}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────────

export default function RemediationPage() {
  const { token, activeProject } = useAuth();
  const [records, setRecords] = useState<RemediationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const projectId = activeProject?.id;

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const apiHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-project-id': projectId || '',
  };

  const fetchRecords = useCallback(async () => {
    if (!projectId || !token) return;
    try {
      const res = await fetch('/api/remediation', { headers: apiHeaders });
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (e) {
      setError('Failed to load remediation records.');
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 8000);
    return () => clearInterval(interval);
  }, [fetchRecords]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/remediation/${id}/approve`, { method: 'PATCH', headers: apiHeaders });
      if (res.ok) {
        showToast('Action approved successfully.');
        await fetchRecords();
      } else {
        showToast('Failed to approve action.', 'error');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/remediation/${id}/reject`, {
        method: 'PATCH',
        headers: apiHeaders,
        body: JSON.stringify({ notes: 'Rejected via Execution Center.' }),
      });
      if (res.ok) {
        showToast('Action rejected.');
        await fetchRecords();
      } else {
        showToast('Failed to reject action.', 'error');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleExecute = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/remediation/${id}/execute`, { method: 'POST', headers: apiHeaders });
      if (res.ok) {
        showToast('Action executed! Verification running in 5s…');
        await fetchRecords();
        // Refresh again after 6s to pick up verification result
        setTimeout(fetchRecords, 6500);
      } else {
        showToast('Execution failed.', 'error');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleRollback = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/remediation/${id}/rollback`, { method: 'POST', headers: apiHeaders });
      if (res.ok) {
        showToast('Rollback executed.');
        await fetchRecords();
      } else {
        showToast('Rollback failed.', 'error');
      }
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Stats ────────────────────────────────────────────────────────────────────

  const stats = {
    total: records.length,
    pending: records.filter(r => r.status === 'pending_approval').length,
    succeeded: records.filter(r => r.status === 'succeeded').length,
    failed: records.filter(r => r.status === 'failed').length,
    rolledBack: records.filter(r => r.status === 'rolled_back').length,
    successRate: records.length > 0
      ? Math.round((records.filter(r => r.status === 'succeeded').length / Math.max(1, records.filter(r => ['succeeded', 'failed'].includes(r.status)).length)) * 100)
      : 0,
    verified: records.filter(r => r.verificationResult?.improved).length,
  };

  // ─── Tab data ─────────────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: records.filter(r => TAB_FILTERS.pending.includes(r.status)).length },
    { key: 'approved', label: 'Approved', count: records.filter(r => TAB_FILTERS.approved.includes(r.status)).length },
    { key: 'executing', label: 'Executing', count: records.filter(r => TAB_FILTERS.executing.includes(r.status)).length },
    { key: 'completed', label: 'Completed', count: records.filter(r => TAB_FILTERS.completed.includes(r.status)).length },
    { key: 'failed', label: 'Failed', count: records.filter(r => TAB_FILTERS.failed.includes(r.status)).length },
  ];

  const filteredRecords = records.filter(r => TAB_FILTERS[activeTab].includes(r.status));

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 p-6 font-sans">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl backdrop-blur-md transition-all duration-300 ${
          toast.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
            : 'bg-rose-950/90 border-rose-500/30 text-rose-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Remediation Execution Center</h1>
            <p className="text-sm text-zinc-500">Approve, execute, verify, and rollback remediation actions with full audit trail.</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={fetchRecords}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-400 hover:text-white transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 mt-3">
          <span>Intelligence</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-zinc-400">Remediation Engine</span>
        </div>
      </div>

      {/* ─── Stats Row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-8">
        <StatCard label="Total Records" value={stats.total} color="bg-zinc-900 border-zinc-800" />
        <StatCard label="Pending Approval" value={stats.pending} sub="awaiting engineer" color="bg-amber-500/5 border-amber-500/15" />
        <StatCard label="Success Rate" value={`${stats.successRate}%`} sub={`${stats.succeeded} succeeded`} color="bg-emerald-500/5 border-emerald-500/15" />
        <StatCard label="Failed" value={stats.failed} sub="may need rollback" color="bg-rose-500/5 border-rose-500/15" />
        <StatCard label="Rolled Back" value={stats.rolledBack} color="bg-orange-500/5 border-orange-500/15" />
        <StatCard label="Verified Improved" value={stats.verified} sub="post-execution" color="bg-sky-500/5 border-sky-500/15" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* ─── Main Panel ──────────────────────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-5">

          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    activeTab === tab.key ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Records List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Wrench className="w-10 h-10 text-zinc-700 mb-4" />
              <h3 className="text-base font-semibold text-zinc-500 mb-1">No {activeTab} actions</h3>
              <p className="text-xs text-zinc-600 max-w-xs">
                {activeTab === 'pending'
                  ? 'Start a Reliability Agent session to generate remediation actions for approval.'
                  : `No actions in ${activeTab} state.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map(record => (
                <RemediationCard
                  key={record.id}
                  record={record}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onExecute={handleExecute}
                  onRollback={handleRollback}
                  loading={actionLoading}
                />
              ))}
            </div>
          )}
        </div>

        {/* ─── Sidebar ─────────────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* How it works */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">How It Works</h3>
            <div className="space-y-3">
              {[
                { icon: '🤖', label: 'Agent proposes', desc: 'Reliability Agent generates actions' },
                { icon: '✅', label: 'You approve', desc: 'Review risk & reasoning, then approve' },
                { icon: '⚡', label: 'System executes', desc: 'Action runs with full audit log' },
                { icon: '🔍', label: 'Auto-verify', desc: 'Metrics compared 5s post-execution' },
                { icon: '↩', label: 'Rollback ready', desc: 'One click if outcome degrades' },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-base leading-none mt-0.5">{step.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-zinc-300">{step.label}</div>
                    <div className="text-[10px] text-zinc-500">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Registry */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Action Registry</h3>
            <div className="space-y-1.5">
              {[
                { type: 'pause_queue', risk: 'low' as const },
                { type: 'resume_queue', risk: 'low' as const },
                { type: 'replay_dlq', risk: 'medium' as const },
                { type: 'ack_incident', risk: 'low' as const },
                { type: 'resolve_incident', risk: 'low' as const },
                { type: 'scale_workers', risk: 'medium' as const },
                { type: 'restart_worker', risk: 'medium' as const },
                { type: 'rollback_deployment', risk: 'high' as const },
                { type: 'trigger_runbook', risk: 'low' as const },
              ].map(action => (
                <div key={action.type} className="flex items-center justify-between py-1.5 border-b border-zinc-800/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{ACTION_TYPE_ICONS[action.type] || '⚡'}</span>
                    <span className="text-[11px] text-zinc-400 font-mono">{action.type}</span>
                  </div>
                  <span className={`text-[9px] font-bold border px-1 py-0.5 rounded uppercase ${RISK_COLORS[action.risk]}`}>
                    {action.risk}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity feed */}
          {records.slice(0, 5).length > 0 && (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Recent Activity</h3>
              <div className="space-y-2">
                {records.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center gap-2 py-1.5 border-b border-zinc-800/40 last:border-0">
                    <span className="text-xs">{ACTION_TYPE_ICONS[r.action.type] || '⚡'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-zinc-300 truncate">{humanize(r.action.type)}</div>
                      <div className="text-[9px] text-zinc-600 font-mono truncate">{r.incidentId}</div>
                    </div>
                    <span className={`text-[9px] font-bold border px-1 py-0.5 rounded uppercase shrink-0 ${STATUS_COLORS[r.status]}`}>
                      {r.status.split('_')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
