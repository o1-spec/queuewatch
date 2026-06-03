'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Layers, Server, Plus, User, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Service } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ServicesCatalog() {
  const { authFetch } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [owner, setOwner] = useState('sre-team');
  const [queues, setQueues] = useState('');
  const [workers, setWorkers] = useState('');

  const loadServices = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/services`);
      if (res.ok) {
        setServices(await res.json());
      }
    } catch (e) {
      console.error('Failed to load services:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description) return;

    try {
      const res = await authFetch(`${API_URL}/api/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `svc_${name.toLowerCase().replace(/\s+/g, '_')}`,
          name,
          description,
          environment,
          owner,
          status: 'healthy',
          createdAt: Date.now(),
          queues: queues.split(',').map(q => q.trim()).filter(Boolean),
          workers: workers.split(',').map(w => w.trim()).filter(Boolean),
          deployments: [],
          incidents: [],
        }),
      });

      if (res.ok) {
        setName('');
        setDescription('');
        setQueues('');
        setWorkers('');
        loadServices();
      }
    } catch (e) {
      console.error('Failed to register service:', e);
    }
  };

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <Server className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Service Map & Registry Catalog</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Audit and map SRE microservices ownership, linked BullMQ queues, worker consumer clients, and active SLA statuses.
          </p>
        </div>

        <button
          onClick={loadServices}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>REFRESH SERVICES</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Register Service Form */}
        <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg h-fit space-y-4 shadow">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-zinc-900 pb-2">
            <Plus className="w-4 h-4 text-zinc-400" />
            <span>Register Microservice</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Service Name</label>
              <input
                type="text"
                placeholder="e.g. Checkout Service"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Description</label>
              <textarea
                placeholder="Brief summary of service operation..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none font-sans text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-900 rounded px-2 py-1.5 text-white focus:outline-none"
              >
                <option value="production">production</option>
                <option value="staging">staging</option>
                <option value="development">development</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Team Owner</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Owned Queues (comma separated)</label>
              <input
                type="text"
                placeholder="webhook_delivery, email_notifications"
                value={queues}
                onChange={(e) => setQueues(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Worker IDs (comma separated)</label>
              <input
                type="text"
                placeholder="worker_webhook_1, worker_email_1"
                value={workers}
                onChange={(e) => setWorkers(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 mt-2 rounded bg-zinc-900 hover:bg-zinc-850 text-white font-bold border border-zinc-800 transition-all flex items-center justify-center space-x-1 shadow"
            >
              <span>REGISTER SERVICE</span>
            </button>
          </form>
        </div>

        {/* Right Side: Services Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg">
            <h3 className="font-bold text-white text-xs uppercase tracking-tight border-b border-zinc-900 pb-3 mb-4">
              Registered Microservices
            </h3>

            {loading ? (
              <div className="text-center py-8 text-zinc-650 animate-pulse">loading registry...</div>
            ) : (
              <div className="space-y-4">
                {services.map((svc) => (
                  <div key={svc.id} className="p-4 bg-zinc-900/10 border border-zinc-900 rounded-lg flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                        <strong className="text-white text-[11px] uppercase font-mono">{svc.name}</strong>
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
                          ENV: {svc.environment}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-500 font-sans flex items-center space-x-1">
                          <User className="w-2.5 h-2.5" />
                          <span>{svc.owner}</span>
                        </span>
                      </div>
                      
                      <p className="text-zinc-400 text-xs font-sans mt-1 leading-relaxed">
                        {svc.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-[9px] font-mono text-zinc-550 pt-1">
                        <div>
                          QUEUES: {svc.queues.length > 0 ? (
                            svc.queues.map(q => <span key={q} className="text-indigo-400 font-bold ml-1">{q}</span>)
                          ) : <span className="text-zinc-650 italic">none</span>}
                        </div>
                        <div>
                          WORKERS: {svc.workers.length > 0 ? (
                            svc.workers.map(w => <span key={w} className="text-indigo-400 font-bold ml-1">{w}</span>)
                          ) : <span className="text-zinc-650 italic">none</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 border px-2 py-1 rounded shrink-0 uppercase text-[9px] font-bold font-mono self-start md:self-center bg-black/30 border-zinc-900">
                      {svc.status === 'healthy' ? (
                        <span className="text-emerald-450 flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>HEALTHY</span>
                        </span>
                      ) : svc.status === 'degraded' ? (
                        <span className="text-amber-500 flex items-center space-x-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>DEGRADED</span>
                        </span>
                      ) : (
                        <span className="text-rose-500 flex items-center space-x-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>CRITICAL</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {services.length === 0 && (
                  <div className="text-center py-10 text-zinc-600 font-bold">
                    No registered services logged.
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
