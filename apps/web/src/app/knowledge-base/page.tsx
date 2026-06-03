'use client';

import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, BookOpen, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { KnowledgeEntry } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function KnowledgeBase() {
  const { authFetch } = useAuth();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadEntries = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/copilot/knowledge-base`);
      if (res.ok) {
        setEntries(await res.json());
      }
    } catch (e) {
      console.error('Failed to load knowledge base:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const filteredEntries = entries.filter((entry) => {
    const query = searchQuery.toLowerCase();
    return (
      entry.title.toLowerCase().includes(query) ||
      entry.pattern.toLowerCase().includes(query) ||
      entry.rootCause.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>SRE Operational Knowledge Base</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Audit historical incident learnings, patterns, resolved triggers, and prevention recommendations.
          </p>
        </div>

        <button
          onClick={loadEntries}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>REFRESH BASE</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg flex items-center space-x-2.5">
        <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <input
          type="text"
          placeholder="Search failure patterns, root causes, resolution command lines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-white focus:outline-none placeholder-zinc-700 text-xs"
        />
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg h-32"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <div key={entry.id} className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-3.5 shadow">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-white text-xs font-bold uppercase">{entry.title}</h3>
                  <span className="text-zinc-500 text-[8.5px] font-sans">
                    Pattern Match: <code className="text-rose-400/90">{entry.pattern}</code>
                  </span>
                </div>
                <span className="text-zinc-650 flex items-center space-x-1 text-[9px] font-sans">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 font-sans text-xs">
                <div className="space-y-1">
                  <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Historical Root Cause</span>
                  <p className="text-zinc-350">{entry.rootCause}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Resolution Action Taken</span>
                  <p className="text-zinc-300 font-mono text-[10px] bg-black/40 border border-zinc-900 p-2 rounded">{entry.resolution}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-zinc-550 font-mono text-[9px] uppercase font-bold block">Prevention Recommendation</span>
                  <p className="text-indigo-400">{entry.preventionRecommendation}</p>
                </div>
              </div>

              <div className="text-zinc-600 text-[8.5px] border-t border-zinc-900/60 pt-2.5 flex items-center space-x-1">
                <AlertCircle className="w-3 h-3 text-zinc-650" />
                <span>Linked Incident Reference ID:</span>
                <span className="font-mono text-zinc-450 font-bold">{entry.incidentId}</span>
              </div>
            </div>
          ))}

          {filteredEntries.length === 0 && (
            <div className="bg-zinc-950 border border-zinc-900 p-12 rounded-lg text-center text-zinc-600 font-bold">
              No matching knowledge base records found.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
