'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Send, RefreshCw, Terminal, CheckCircle2, ShieldAlert, Cpu, GitCommit } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CopilotResponse } from '@queuewatch/shared';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ReliabilityCopilot() {
  const { authFetch } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [response, setResponse] = useState<CopilotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Confirmed action feedback
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

  useEffect(() => {
    loadSuggestions();
  }, []);

  const handleQuerySubmit = async (promptText: string) => {
    if (!promptText) return;
    setLoading(true);
    setResponse(null);
    setConfirmedAction(null);

    try {
      const res = await authFetch(`${API_URL}/api/copilot/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });

      if (res.ok) {
        setResponse(await res.json());
      }
    } catch (e) {
      console.error('Failed to query copilot:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleActionConfirm = (action: string) => {
    setConfirmedAction(action);
    setTimeout(() => setConfirmedAction(null), 4000);
  };

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Reliability Copilot & SRE Assistant</span>
        </h2>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          Ask questions, correlate queue signals, audit release timelines, and query historical knowledge base entries.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Sugesstions and Recent Context */}
        <div className="space-y-4">
          
          {/* Suggestions */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3 shadow">
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
                  className="w-full text-left p-2.5 rounded bg-zinc-900/40 border border-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-800 transition-colors text-[9px] leading-relaxed"
                >
                  &rarr; {s}
                </button>
              ))}
            </div>
          </div>

          {/* SRE Assistant Info */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-3">
            <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              <span>SRE Operational Guard</span>
            </h3>
            <p className="text-zinc-500 font-sans text-xs leading-normal">
              Reliability Copilot relies strictly on active system telemetry, logs, and deployment timelines. It does not perform autonomous write actions.
            </p>
            <div className="bg-black/40 border border-zinc-900 p-3 rounded text-[9px] text-zinc-400 leading-normal">
              💡 <b>Rule:</b> No automatic replay, queue pauses, or issue dispatches occur without explicit engineer confirmation.
            </div>
          </div>

        </div>

        {/* Center/Right: Chat console & structured response */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Query Bar */}
          <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg flex items-center gap-3">
            <div className="flex-1 flex items-center space-x-2.5 bg-zinc-900/30 border border-zinc-900 rounded px-3 py-2">
              <Terminal className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                type="text"
                placeholder="Ask QueueWatch e.g. Why is email_notifications queue failing?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuerySubmit(query)}
                className="w-full bg-transparent text-white focus:outline-none placeholder-zinc-700 text-xs"
              />
            </div>
            <button
              onClick={() => handleQuerySubmit(query)}
              disabled={loading || !query}
              className="px-4 py-2.5 rounded bg-indigo-900 hover:bg-indigo-950 text-white font-bold border border-indigo-850 flex items-center space-x-1.5 shadow transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>QUERY</span>
            </button>
          </div>

          {/* Copilot Answer Display */}
          {loading && (
            <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-lg text-center animate-pulse text-zinc-500">
              Gathering evidence and correlating signals...
            </div>
          )}

          {response && (
            <div className="space-y-4">
              
              {/* Answer Box */}
              <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4 shadow-xl relative overflow-hidden">
                {/* Confidence Bar */}
                <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                  <span className="text-[11px] font-bold text-white uppercase flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Copilot Diagnosis</span>
                  </span>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-500 uppercase text-[9px]">Confidence:</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      response.confidenceScore >= 75 ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400' :
                      response.confidenceScore >= 50 ? 'bg-amber-950/20 border-amber-900 text-amber-400' :
                      'bg-rose-950/20 border-rose-900 text-rose-450'
                    }`}>
                      {response.confidenceScore}%
                    </span>
                  </div>
                </div>

                <div className="text-zinc-200 font-sans text-xs leading-relaxed whitespace-pre-wrap">
                  {response.answer}
                </div>
              </div>

              {/* Evidence & References */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Evidence Source list */}
                <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg space-y-3">
                  <span className="text-zinc-500 uppercase text-[9px] font-bold tracking-wider block">Grounded Telemetry Evidence</span>
                  <ul className="space-y-1.5">
                    {response.evidence.map((ev, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-zinc-400 font-sans text-[11px] leading-normal">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>{ev}</span>
                      </li>
                    ))}
                    {response.evidence.length === 0 && (
                      <span className="text-zinc-650 italic">No direct logs or metrics referenced.</span>
                    )}
                  </ul>
                </div>

                {/* Recommendations */}
                <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg space-y-3">
                  <span className="text-zinc-500 uppercase text-[9px] font-bold tracking-wider block">Recommended Actions (Requires Confirmation)</span>
                  <div className="space-y-2">
                    {response.recommendedActions.map((act, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleActionConfirm(act)}
                        className="w-full text-left p-2.5 rounded bg-zinc-900 border border-zinc-850 text-indigo-400 font-bold hover:text-white hover:border-zinc-700 transition-colors uppercase text-[8.5px] flex items-center justify-between"
                      >
                        <span>{act}</span>
                        <span className="text-[7.5px] text-zinc-500">RUN &rarr;</span>
                      </button>
                    ))}
                    {response.recommendedActions.length === 0 && (
                      <span className="text-zinc-650 italic">No immediate recovery actions recommended.</span>
                    )}
                  </div>
                </div>

              </div>

              {confirmedAction && (
                <div className="bg-amber-950/20 border border-amber-900/60 p-4 rounded-lg font-sans text-xs text-amber-400 leading-normal">
                  ⚠️ <b>Action Authorization:</b> Execute <i>&quot;{confirmedAction}&quot;</i> inside your terminal or deployment pipeline manually. QueueWatch does not run destructive operations autonomously.
                </div>
              )}

              {/* Related metadata */}
              <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg flex flex-wrap gap-4 text-zinc-500">
                <div className="flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-zinc-650" />
                  <span>Related Incidents:</span>
                  {response.relatedIncidents.map((id) => (
                    <Link key={id} href="/incidents" className="text-indigo-400 hover:underline font-bold font-mono">{id}</Link>
                  ))}
                  {response.relatedIncidents.length === 0 && <span>&mdash;</span>}
                </div>
                <div className="flex items-center space-x-1.5">
                  <GitCommit className="w-3.5 h-3.5 text-zinc-650" />
                  <span>Related Deployments:</span>
                  {response.relatedDeployments.map((v) => (
                    <span key={v} className="text-indigo-400 font-bold font-mono">{v}</span>
                  ))}
                  {response.relatedDeployments.length === 0 && <span>&mdash;</span>}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
