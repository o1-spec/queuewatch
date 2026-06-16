'use client';

import React, { useState, useEffect } from 'react';
import useSocket from '../../hooks/useSocket';
import { GitCommit, GitBranch, Calendar, User, Cpu, RefreshCw, Plus, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DeploymentEvent } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DeploymentsOverview() {
  const { authFetch } = useAuth();
  const [deployments, setDeployments] = useState<DeploymentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [service, setService] = useState('email_notifications');
  const [version, setVersion] = useState('v1.2.4');
  const [commitSha, setCommitSha] = useState('d0dad1d7f');
  const [branch, setBranch] = useState('main');
  const [environment, setEnvironment] = useState('production');
  const [deployedBy, setDeployedBy] = useState('SRE Engineer');

  const loadDeployments = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/deployments`);
      if (res.ok) {
        setDeployments(await res.json());
      }
    } catch (e) {
      console.error('Failed to load deployments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployments();
  }, []);

  useSocket({
    'deployment.created': (newDep: DeploymentEvent) => {
      setDeployments((prev) => [newDep, ...prev]);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !version || !commitSha) return;

    try {
      const res = await authFetch(`${API_URL}/api/deployments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service,
          version,
          commitSha,
          branch,
          environment,
          deployedBy,
          metadata: { trigger: 'Manual registry panel' },
        }),
      });

      if (res.ok) {
        // Reset form details slightly
        setCommitSha(Math.random().toString(16).substr(2, 7));
        const num = Number(version.split('.')[2]) + 1;
        setVersion(`v1.2.${num}`);
      }
    } catch (e) {
      console.error('Failed to register deployment:', e);
    }
  };

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <GitCommit className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Release Deployments Correlation Ledger</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Audit logs of software releases, environments, and commit SHAs to correlate incidents against system code changes.
          </p>
        </div>

        <button
          onClick={loadDeployments}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>REFRESH LOGS</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Register Deployment Form */}
        <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg h-fit space-y-4 shadow">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-zinc-900 pb-2">
            <Plus className="w-4 h-4 text-zinc-400" />
            <span>Log Release Deployment</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Service Name</label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-900 rounded px-2 py-1.5 text-white focus:outline-none"
              >
                <option value="email_notifications">email_notifications</option>
                <option value="webhook_delivery">webhook_delivery</option>
                <option value="image_processing">image_processing</option>
                <option value="ai_tasks">ai_tasks</option>
                <option value="api_gateway">api_gateway</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Version String</label>
              <input
                type="text"
                placeholder="e.g. v1.2.4"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Commit SHA Hash</label>
              <input
                type="text"
                placeholder="e.g. f3a123bc"
                value={commitSha}
                onChange={(e) => setCommitSha(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Git Branch</label>
              <input
                type="text"
                placeholder="e.g. main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-900 rounded px-2 py-1.5 text-white focus:outline-none"
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Deployed By</label>
              <input
                type="text"
                value={deployedBy}
                onChange={(e) => setDeployedBy(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none font-sans text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 mt-2 rounded bg-zinc-900 hover:bg-zinc-850 text-white font-bold border border-zinc-800 transition-all flex items-center justify-center space-x-1 shadow"
            >
              <span>REGISTER RELEASE</span>
            </button>
          </form>
        </div>

        {/* Right Side: Deployments Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg">
            <h3 className="font-bold text-white text-xs uppercase tracking-tight border-b border-zinc-900 pb-3 mb-4">
              Deployments Feed
            </h3>

            {loading ? (
              <div className="text-center py-8 text-zinc-650 animate-pulse">loading deployments...</div>
            ) : (
              <div className="space-y-4">
                {deployments.map((dep) => (
                  <div key={dep.id} className="p-3.5 bg-zinc-900/10 border border-zinc-900 rounded-lg flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <strong className="text-white text-[11px] uppercase font-mono">{dep.service}</strong>
                        <span className="px-1.5 py-0.5 rounded text-[8.5px] bg-indigo-950/20 border border-indigo-900 text-indigo-400 font-bold uppercase font-mono">
                          {dep.version}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[8.5px] bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono">
                          {dep.environment}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-500 text-[9px] font-sans">
                        <span className="flex items-center space-x-1">
                          <GitCommit className="w-3 h-3 text-zinc-650" />
                          <code className="font-mono text-zinc-400">{dep.commitSha}</code>
                        </span>
                        {dep.branch && (
                          <span className="flex items-center space-x-1">
                            <GitBranch className="w-3 h-3 text-zinc-650" />
                            <code className="font-mono text-zinc-400">{dep.branch}</code>
                          </span>
                        )}
                        <span className="flex items-center space-x-1">
                          <User className="w-3 h-3 text-zinc-650" />
                          <span>{dep.deployedBy}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-zinc-650" />
                          <span>{new Date(dep.deployedAt).toLocaleString()}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-[8.5px] border border-emerald-900/20 bg-emerald-950/5 px-2 py-0.5 rounded shrink-0 uppercase">
                      <Check className="w-3 h-3" />
                      <span>DEPLOYED</span>
                    </div>
                  </div>
                ))}

                {deployments.length === 0 && (
                  <div className="text-center py-10 text-zinc-600 font-bold">
                    No release deployment logs active. Register a deployment using the panel or API endpoint.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
