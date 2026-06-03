'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Plus, Cpu, HelpCircle, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Runbook } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RunbooksViewer() {
  const { authFetch } = useAuth();
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [incidentType, setIncidentType] = useState('');
  const [generating, setGenerating] = useState(false);

  const loadRunbooks = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/copilot/runbooks`);
      if (res.ok) {
        setRunbooks(await res.json());
      }
    } catch (e) {
      console.error('Failed to load runbooks:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRunbooks();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentType) return;
    setGenerating(true);

    try {
      const res = await authFetch(`${API_URL}/api/copilot/runbooks/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentType, linkedIncidents: [] }),
      });

      if (res.ok) {
        const newRunbook = await res.json();
        setRunbooks((prev) => [newRunbook, ...prev]);
        setIncidentType('');
      }
    } catch (e) {
      console.error('Failed to generate runbook:', e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Operational Runbooks & Incident Runbooks</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Access generated recovery guides, check list commands, and SRE resolution steps for active incident types.
          </p>
        </div>

        <button
          onClick={loadRunbooks}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>REFRESH INDEX</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Generate Runbook Form */}
        <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg h-fit space-y-4 shadow">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-zinc-900 pb-2">
            <Plus className="w-4 h-4 text-zinc-400" />
            <span>Generate Custom Runbook</span>
          </h3>

          <form onSubmit={handleGenerate} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Outage Incident Type</label>
              <input
                type="text"
                placeholder="e.g. SMTP Rate Limit Outage"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="w-full bg-zinc-900/25 border border-zinc-900 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-zinc-800 text-xs font-sans"
              />
            </div>

            <button
              type="submit"
              disabled={generating || !incidentType}
              className="w-full py-2 mt-2 rounded bg-indigo-900 hover:bg-indigo-950 text-white font-bold border border-indigo-800 transition-all flex items-center justify-center space-x-1.5 shadow disabled:opacity-50"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{generating ? 'GENERATING RUNBOOK...' : 'GENERATE AI RUNBOOK'}</span>
            </button>
          </form>

          <div className="bg-zinc-900/10 border border-zinc-900 p-3.5 rounded text-zinc-550 leading-normal font-sans">
            🤖 Runbooks provide structured checklist recovery recommendations based on typical system bottlenecks.
          </div>
        </div>

        {/* Right Side: Runbooks Catalog */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg">
            <h3 className="font-bold text-white text-xs uppercase tracking-tight border-b border-zinc-900 pb-3 mb-4">
              Runbooks Index Catalog
            </h3>

            {loading ? (
              <div className="text-center py-8 text-zinc-650 animate-pulse">loading runbooks...</div>
            ) : (
              <div className="space-y-4">
                {runbooks.map((rb) => (
                  <div key={rb.id} className="p-4 bg-zinc-900/10 border border-zinc-900 rounded-lg space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-white text-xs font-bold uppercase">{rb.title}</h4>
                        <span className="text-zinc-500 font-sans text-[9px]">Type: {rb.incidentType}</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded text-[7px] bg-zinc-900 border border-zinc-800 text-zinc-400">
                        {rb.id}
                      </span>
                    </div>

                    {/* Step checklist */}
                    <div className="space-y-2 border-t border-zinc-900/60 pt-3">
                      {rb.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start space-x-2 text-zinc-300 font-sans text-xs">
                          <span className="font-mono text-indigo-400 font-bold shrink-0">{idx + 1}.</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {runbooks.length === 0 && (
                  <div className="text-center py-10 text-zinc-650 font-bold">
                    No recovery runbooks enqueued. Generate a runbook using the panel.
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
