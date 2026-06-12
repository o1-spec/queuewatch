'use client';

import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  RefreshCw, 
  Layers, 
  Server, 
  Plus, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Network, 
  Activity, 
  Terminal, 
  ArrowUpRight, 
  Workflow, 
  Info,
  Database,
  Eye,
  Settings,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Service, QueueMetrics, WorkerHealth } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ConnectedServices() {
  const { authFetch, activeProjectId } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [queuesMetrics, setQueuesMetrics] = useState<QueueMetrics[]>([]);
  const [workers, setWorkers] = useState<WorkerHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [owner, setOwner] = useState('sre-team');
  const [queues, setQueues] = useState('');
  const [workersList, setWorkersList] = useState('');

  const loadData = async () => {
    try {
      const [svcRes, qRes, wRes] = await Promise.all([
        authFetch(`${API_URL}/api/services`),
        authFetch(`${API_URL}/api/queues`),
        authFetch(`${API_URL}/api/workers`)
      ]);
      
      if (svcRes.ok) {
        setServices(await svcRes.ok ? await svcRes.json() : []);
      }
      if (qRes.ok) {
        setQueuesMetrics(await qRes.json());
      }
      if (wRes.ok) {
        setWorkers(await wRes.json());
      }
    } catch (e) {
      console.error('Failed to load services data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Live update polling loop every 5 seconds
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [activeProjectId]);

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
          workers: workersList.split(',').map(w => w.trim()).filter(Boolean),
          deployments: [],
          incidents: [],
        }),
      });

      if (res.ok) {
        setName('');
        setDescription('');
        setQueues('');
        setWorkersList('');
        loadData();
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
            <Workflow className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Connected Services Architecture Map</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Visualize microservices mapping to redis queue metrics and underlying consumer daemon client workers.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-end sm:self-center">
          {/* Tab Selector */}
          <div className="flex items-center bg-zinc-900/60 border border-zinc-850 p-0.5 rounded-md">
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                activeTab === 'map' 
                  ? 'bg-zinc-850 text-white shadow-sm' 
                  : 'text-zinc-550 hover:text-zinc-350'
              }`}
            >
              Visual Map
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                activeTab === 'list' 
                  ? 'bg-zinc-850 text-white shadow-sm' 
                  : 'text-zinc-550 hover:text-zinc-350'
              }`}
            >
              Registry Catalog
            </button>
          </div>

          <button
            onClick={loadData}
            className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>FORCE REFRESH</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Form: Register Service */}
        <div className="lg:col-span-1 bg-zinc-950 border border-zinc-900 p-5 rounded-lg h-fit space-y-4 shadow">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-zinc-900 pb-2">
            <Plus className="w-4 h-4 text-zinc-400" />
            <span>Register Microservice</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Service Name</label>
              <input
                type="text"
                placeholder="e.g. payment-service"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-zinc-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Description</label>
              <textarea
                placeholder="Brief summary of service operation..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-zinc-800 font-sans text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-900 rounded px-2 py-1.5 text-white focus:outline-none focus:border-zinc-850"
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
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-zinc-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Owned Queues (comma separated)</label>
              <input
                type="text"
                placeholder="payment_queue, email_queue"
                value={queues}
                onChange={(e) => setQueues(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-zinc-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Worker IDs (comma separated)</label>
              <input
                type="text"
                placeholder="worker-1, worker-2"
                value={workersList}
                onChange={(e) => setWorkersList(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-zinc-800"
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

        {/* Right Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {loading ? (
            <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-12 text-center text-zinc-600 animate-pulse font-bold">
              Resolving live system topology mappings...
            </div>
          ) : services.length === 0 ? (
            <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-12 text-center text-zinc-550 space-y-4">
              <Activity className="w-10 h-10 text-zinc-750 mx-auto animate-pulse" />
              <h3 className="text-white text-xs uppercase font-bold tracking-wider">No Services Discovered</h3>
              <p className="max-w-md mx-auto leading-relaxed text-zinc-500 text-[10px]">
                To map services, configure the QueueWatch SDK in your microservices or simulate synthetic events from the Simulation Sandbox panel.
              </p>
            </div>
          ) : activeTab === 'map' ? (
            /* Visual Map Tab */
            <div className="space-y-6">
              {services.map((svc) => (
                <div key={svc.id} className="bg-zinc-950 border border-zinc-900 rounded-lg p-6 relative overflow-hidden shadow-xl">
                  {/* Subtle Background Accent Gradient */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

                  {/* Header info for the microservice */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900/80 pb-4 mb-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2.5">
                        <Server className="w-4 h-4 text-indigo-400 shrink-0" />
                        <strong className="text-white text-xs uppercase font-bold font-mono tracking-wide">{svc.name}</strong>
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-zinc-900/60 border border-zinc-850 text-zinc-400 font-mono">
                          ENV: {svc.environment}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-zinc-900/60 border border-zinc-850 text-zinc-550 font-sans flex items-center space-x-1">
                          <User className="w-2.5 h-2.5 text-zinc-650" />
                          <span>{svc.owner}</span>
                        </span>
                      </div>
                      <p className="text-zinc-400 text-[11px] font-sans leading-relaxed">
                        {svc.description}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 self-start sm:self-center">
                      <div className="px-2.5 py-1 rounded bg-black/45 border border-zinc-850 text-[9px] font-bold font-mono uppercase">
                        {svc.status === 'healthy' ? (
                          <span className="text-emerald-400 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span>Healthy</span>
                          </span>
                        ) : svc.status === 'degraded' ? (
                          <span className="text-amber-500 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                            <span>Degraded</span>
                          </span>
                        ) : (
                          <span className="text-rose-500 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                            <span>Critical</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SRE Directory-Tree Layout Diagram */}
                  <div className="p-5 bg-black/30 border border-zinc-900/60 rounded-lg overflow-x-auto space-y-1">
                    <span className="text-zinc-600 uppercase text-[8px] font-bold block mb-4 font-mono tracking-widest border-b border-zinc-900 pb-1.5">
                      SRE TOPOLOGY RESOLVED TREE
                    </span>

                    {/* ROOT LEVEL: Microservice Node */}
                    <div className="flex items-center space-x-2 text-white font-mono text-[11px] font-bold mb-2">
                      <div className="w-2.5 h-2.5 rounded-sm bg-indigo-500 shrink-0 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                      <span className="text-indigo-300 font-mono tracking-wider">{svc.name}</span>
                    </div>

                    {/* QUEUES & WORKERS BRANCHES */}
                    <div className="relative pl-6 border-l border-zinc-850 space-y-4">
                      
                      {/* Queues List */}
                      {svc.queues.length === 0 ? (
                        <div className="text-zinc-650 italic text-[9px] pl-6 relative">
                          <div className="absolute top-2 left-0 w-4 border-t border-zinc-850" />
                          No queues discovered yet.
                        </div>
                      ) : (
                        svc.queues.map((qName, qIdx) => {
                          const metrics = queuesMetrics.find(m => m.queueName === qName);
                          const isLast = qIdx === svc.queues.length - 1 && (!svc.workers || svc.workers.length === 0);

                          return (
                            <div key={qName} className="relative pl-6">
                              {/* Horizontal branch line */}
                              <div className="absolute top-3.5 left-0 w-6 border-t border-zinc-850" />
                              
                              {/* Queue Node Box */}
                              <div className="bg-zinc-950 border border-zinc-900 hover:border-zinc-800 rounded-md p-3 max-w-xl shadow-md transition-all flex items-center justify-between gap-4">
                                <div className="flex items-center space-x-2">
                                  <Layers className="w-3.5 h-3.5 text-zinc-550 shrink-0" />
                                  <span className="font-mono text-zinc-250 font-bold uppercase text-[10px] tracking-wide">{qName}</span>
                                  {metrics?.paused && (
                                    <span className="text-[7.5px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1 py-0.2 rounded leading-none">PAUSED</span>
                                  )}
                                </div>

                                <div className="flex items-center space-x-4">
                                  {/* Metrics counters */}
                                  <div className="flex items-center space-x-3 text-[9px] font-mono text-zinc-500">
                                    <span className="flex items-center space-x-1">
                                      <span>Waiting:</span>
                                      <strong className="text-zinc-300 font-bold">{metrics ? metrics.waitingCount : 0}</strong>
                                    </span>
                                    <span className="flex items-center space-x-1">
                                      <span>Active:</span>
                                      <strong className="text-indigo-400 font-bold">{metrics ? metrics.activeCount : 0}</strong>
                                    </span>
                                    <span className="flex items-center space-x-1">
                                      <span>Failed:</span>
                                      <strong className={`${metrics && metrics.failedCount > 0 ? 'text-rose-500 font-bold' : 'text-zinc-550'}`}>{metrics ? metrics.failedCount : 0}</strong>
                                    </span>
                                  </div>

                                  {/* Active pipeline spark indicator */}
                                  {metrics && metrics.activeCount > 0 && (
                                    <span className="relative flex h-2 w-2 shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}

                      {/* Workers section header node */}
                      {svc.workers && svc.workers.length > 0 && (
                        <div className="relative pl-6 pt-1">
                          {/* Connection line */}
                          <div className="absolute top-3.5 left-0 w-6 border-t border-zinc-850" />
                          
                          {/* Header Text */}
                          <div className="flex items-center space-x-1.5 text-zinc-500 font-bold tracking-widest uppercase text-[8.5px] mb-2 font-mono">
                            <Cpu className="w-3.5 h-3.5 text-zinc-650" />
                            <span>workers:</span>
                          </div>

                          {/* Sub-branch directory tree for workers */}
                          <div className="relative pl-6 border-l border-zinc-850 space-y-2.5">
                            {svc.workers.map((wId, wIdx) => {
                              const worker = workers.find(w => w.workerId === wId);
                              const isLastWorker = wIdx === svc.workers.length - 1;

                              // Compute colors based on CPU/Memory levels
                              const cpu = worker ? worker.cpuUsage : 0;
                              const mem = worker ? worker.memoryUsage : 0;
                              const cpuColor = cpu > 80 ? 'bg-rose-500' : cpu > 50 ? 'bg-amber-500' : 'bg-emerald-500';
                              const memColor = mem > 80 ? 'bg-rose-500' : mem > 50 ? 'bg-amber-500' : 'bg-emerald-500';

                              return (
                                <div key={wId} className="relative pl-6">
                                  {/* Horizontal connector line */}
                                  <div className="absolute top-3.5 left-0 w-6 border-t border-zinc-850" />

                                  {/* Worker Info Card */}
                                  <div className="bg-zinc-950/60 border border-zinc-900 rounded-md p-3 max-w-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center space-x-2">
                                      <Terminal className="w-3 h-3 text-zinc-600 shrink-0" />
                                      <strong className="text-zinc-350 font-bold font-mono text-[9.5px] uppercase">{wId}</strong>
                                      <span className={`px-1.5 py-0.5 rounded-[3px] text-[7.5px] font-bold uppercase font-mono ${
                                        worker?.status === 'healthy' 
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                          : worker?.status === 'overloaded'
                                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                            : 'bg-zinc-900 text-zinc-600 border border-zinc-850'
                                      }`}>
                                        {worker ? worker.status : 'offline'}
                                      </span>
                                    </div>

                                    {/* Stats bars */}
                                    <div className="flex flex-wrap items-center gap-4 text-[8px] font-mono text-zinc-500">
                                      {/* CPU */}
                                      <div className="flex items-center space-x-1.5">
                                        <span>CPU:</span>
                                        <div className="w-14 bg-zinc-900 border border-zinc-850 h-2 rounded-full overflow-hidden flex">
                                          <div className={`h-full ${cpuColor}`} style={{ width: `${cpu}%` }} />
                                        </div>
                                        <span className="text-zinc-300 font-bold w-6 text-right">{cpu}%</span>
                                      </div>

                                      {/* Memory */}
                                      <div className="flex items-center space-x-1.5">
                                        <span>MEM:</span>
                                        <div className="w-14 bg-zinc-900 border border-zinc-850 h-2 rounded-full overflow-hidden flex">
                                          <div className={`h-full ${memColor}`} style={{ width: `${mem}%` }} />
                                        </div>
                                        <span className="text-zinc-300 font-bold w-6 text-right">{mem}%</span>
                                      </div>

                                      {/* Concurrency */}
                                      <div className="flex items-center space-x-1">
                                        <span>CONC:</span>
                                        <span className="text-zinc-300 font-bold">{worker ? worker.concurrency : 0}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                </div>
              ))}
            </div>
          ) : (
            /* Registry Catalog (Raw table/ledger view) */
            <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg">
              <h3 className="font-bold text-white text-xs uppercase tracking-tight border-b border-zinc-900 pb-3 mb-4">
                Registered SRE Microservices
              </h3>

              <div className="space-y-4">
                {services.map((svc) => (
                  <div key={svc.id} className="p-4 bg-zinc-900/10 border border-zinc-900 rounded-lg flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                        <strong className="text-white text-[11px] uppercase font-mono">{svc.name}</strong>
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
                          ENV: {svc.environment}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-550 font-sans flex items-center space-x-1">
                          <User className="w-2.5 h-2.5" />
                          <span>{svc.owner}</span>
                        </span>
                      </div>
                      
                      <p className="text-zinc-450 text-xs font-sans mt-1 leading-relaxed">
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
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
