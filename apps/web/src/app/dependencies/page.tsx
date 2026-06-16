'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, GitCommit, Layers, Server, ArrowRight, ShieldAlert, Sparkles, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DependencyGraph } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DependenciesOverview() {
  const { authFetch } = useAuth();
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [upstreamList, setUpstreamList] = useState<string[]>([]);
  const [downstreamList, setDownstreamList] = useState<string[]>([]);

  const loadGraph = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/dependencies/graph`);
      if (res.ok) {
        setGraph(await res.json());
      }
    } catch (e) {
      console.error('Failed to load dependency graph:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  const handleSelectService = async (serviceId: string) => {
    setSelectedService(serviceId);
    try {
      const res = await authFetch(`${API_URL}/api/dependencies/${serviceId}`);
      if (res.ok) {
        const data = await res.json();
        setUpstreamList(data.upstream || []);
        setDownstreamList(data.downstream || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const serviceNodes = graph?.nodes.filter(n => n.type === 'service') || [];
  const queueNodes = graph?.nodes.filter(n => n.type === 'queue') || [];

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <Activity className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Service Dependencies Graph & Blast Radius Inspector</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Visualize flow graphs and impact paths. Select any service node to trace downstream blast-radii cascades.
          </p>
        </div>

        <button
          onClick={loadGraph}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>REFRESH GRAPH</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns: Interactive ASCII Graph Map */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4">
          <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2.5">
            Dependency Flow Diagram
          </h3>

          {loading ? (
            <div className="text-center py-12 text-zinc-650 animate-pulse">building dependency map...</div>
          ) : (
            <div className="space-y-6">
              {/* ASCII Visual Flow Graph */}
              <div className="p-5 bg-black/40 border border-zinc-900 rounded-lg overflow-x-auto space-y-4">
                <span className="text-zinc-550 uppercase text-[8px] font-bold block mb-1">Interactive Topology Map (Click to Inspect)</span>
                
                <div className="space-y-3 font-sans text-xs">
                  {serviceNodes.map(node => {
                    const isSelected = selectedService === node.id;
                    const linkedQueues = graph?.edges.filter(e => e.from === node.id).map(e => e.to) || [];
                    
                    return (
                      <div 
                        key={node.id} 
                        onClick={() => handleSelectService(node.id)}
                        className={`p-3 rounded border cursor-pointer transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${
                          isSelected ? 'bg-indigo-950/10 border-indigo-500 text-white' : 'bg-zinc-900/20 border-zinc-900 hover:border-zinc-800 text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Server className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="font-mono text-[11px] font-bold">{node.label}</span>
                        </div>

                        {linkedQueues.length > 0 && (
                          <div className="flex items-center space-x-2 text-[9px] font-mono text-zinc-550 flex-wrap gap-y-1">
                            <span>Writes to:</span>
                            {linkedQueues.map(q => {
                              const edge = graph?.edges.find(e => e.from === node.id && e.to === q);
                              const obs = edge?.observations || 0;
                              const confidence = obs > 50 ? 'Strong' : obs > 5 ? 'Moderate' : 'Weak';
                              const confidenceColor = confidence === 'Strong' ? 'text-indigo-400 bg-indigo-950/20 border-indigo-900/40' :
                                                      confidence === 'Moderate' ? 'text-amber-400 bg-amber-950/20 border-amber-900/40' :
                                                      'text-zinc-500 bg-zinc-900/40 border-zinc-850';
                              return (
                                <div key={q} className="inline-flex items-center space-x-1.5 border border-zinc-800 rounded bg-zinc-900 px-1.5 py-0.5 select-all">
                                  <span className="text-zinc-300 uppercase font-bold">{q}</span>
                                  <span className={`px-1.5 py-0.2 rounded text-[7.5px] font-bold border uppercase ${confidenceColor}`} title={`${obs} telemetry events observed`}>
                                    {confidence} ({obs})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dependency Grid Summary */}
              <div className="border border-zinc-900 rounded overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900/30 border-b border-zinc-900 text-zinc-500 font-bold uppercase text-[8px]">
                      <th className="p-3">Source Node</th>
                      <th className="p-3 text-center">&rarr;</th>
                      <th className="p-3">Dependent Target Node</th>
                      <th className="p-3 text-right">Telemetry Observations</th>
                      <th className="p-3 text-right">Edge Strength</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graph?.edges.map((edge, idx) => {
                      const obs = edge.observations || 0;
                      const confidence = obs > 50 ? 'Strong' : obs > 5 ? 'Moderate' : 'Weak';
                      const confidenceColor = confidence === 'Strong' ? 'text-indigo-400 font-bold' :
                                              confidence === 'Moderate' ? 'text-amber-400' :
                                              'text-zinc-500';
                      return (
                        <tr key={idx} className="border-b border-zinc-900/40 last:border-0 hover:bg-zinc-900/5 text-[10px]">
                          <td className="p-3 font-bold text-zinc-400 select-all">{edge.from}</td>
                          <td className="p-3 text-center text-zinc-650">&rarr;</td>
                          <td className="p-3 text-white font-semibold select-all">{edge.to}</td>
                          <td className="p-3 text-right text-zinc-350 font-mono">{obs}</td>
                          <td className={`p-3 text-right font-bold uppercase ${confidenceColor}`}>{confidence}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Columns: Blast Radius & Chain Analysis */}
        <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4">
          <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2.5 flex items-center space-x-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Blast Radius & Cascade Analysis</span>
          </h3>

          {!selectedService ? (
            <div className="text-center py-16 text-zinc-650 font-sans text-xs">
              Select any microservice on the map to calculate downstream impact chains and failure blast-radius propagation.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="p-3 bg-indigo-950/10 border border-indigo-900/40 rounded space-y-1.5">
                <span className="text-indigo-400 font-bold uppercase text-[8.5px] block font-mono">SELECTED FOCUS NODE</span>
                <div className="flex items-center space-x-2 text-white font-bold font-mono">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span>{graph?.nodes.find(n => n.id === selectedService)?.label}</span>
                </div>
              </div>

              {/* Upstream Mappings */}
              <div className="space-y-2">
                <span className="text-zinc-500 uppercase text-[9px] font-bold block">Upstream Dependency Services</span>
                <div className="space-y-1.5">
                  {upstreamList.map((svcId) => (
                    <div key={svcId} className="flex items-center space-x-2 p-2 bg-zinc-900/40 border border-zinc-900 rounded font-mono text-[9.5px]">
                      <Server className="w-3.5 h-3.5 text-zinc-550 shrink-0" />
                      <span className="text-zinc-400">{graph?.nodes.find(n => n.id === svcId)?.label || svcId}</span>
                    </div>
                  ))}
                  {upstreamList.length === 0 && (
                    <span className="text-zinc-650 italic text-[9px]">No upstream callers mapped.</span>
                  )}
                </div>
              </div>

              {/* Downstream Mappings */}
              <div className="space-y-2">
                <span className="text-zinc-500 uppercase text-[9px] font-bold block">Downstream Impact Blast-Radius</span>
                <div className="space-y-1.5">
                  {downstreamList.map((svcId) => (
                    <div key={svcId} className="flex items-center space-x-2 p-2 bg-rose-950/5 border border-rose-900/20 rounded font-mono text-[9.5px] text-rose-350">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>{graph?.nodes.find(n => n.id === svcId)?.label || svcId}</span>
                    </div>
                  ))}
                  {downstreamList.length === 0 && (
                    <span className="text-zinc-650 italic text-[9px]">No downstream impacts mapped.</span>
                  )}
                </div>
              </div>

              {/* Cascade Explanation */}
              <div className="p-3.5 bg-black/40 border border-zinc-900 rounded space-y-1 leading-normal font-sans text-zinc-400 text-xs">
                <span className="text-zinc-550 uppercase font-bold text-[8px] font-mono block mb-1">Cascade Potential Summary</span>
                {downstreamList.length > 0 ? (
                  <p>
                    ⚠️ Failures on this service propagate downstream to <strong className="text-white">{downstreamList.length}</strong> services. Operational degradations will cause cascading queue latency.
                  </p>
                ) : (
                  <p>
                    &bull; This service operates as a terminal leaf node in the graph. Failure blast radius is isolated.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
