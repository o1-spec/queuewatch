'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Activity, ShieldAlert, Sparkles, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GlobalHealth } from '@queuewatch/shared';
import { MetricCard } from '../../components/MetricCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function OperationalHealthCenter() {
  const { authFetch } = useAuth();
  const [health, setHealth] = useState<GlobalHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/health-center`);
      if (res.ok) {
        setHealth(await res.json());
      }
    } catch (e) {
      console.error('Failed to load global health stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <div className="space-y-6 font-mono text-[10px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>SRE Operational Health Command Center</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Global view of platform microservices status, active SLA exceptions, predictive risk assessments, and historical SLO metrics.
          </p>
        </div>

        <button
          onClick={loadHealth}
          className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 font-bold transition-all flex items-center space-x-1.5 shadow"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>REFRESH HEALTH STATUS</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-650 animate-pulse">loading platform status...</div>
      ) : health ? (
        <div className="space-y-6">
          {/* Metrics cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Overall SLO Reliability"
              value={`${health.overallReliabilityScore}%`}
              subtext="system-wide availability rating"
              icon={CheckCircle2}
              iconColor={health.overallReliabilityScore >= 80 ? 'text-emerald-400' : 'text-rose-500'}
              pulseActive={health.overallReliabilityScore < 85}
              pulseColor="bg-rose-500"
            />

            <MetricCard
              title="Global Risk Index"
              value={`${health.overallRiskScore}%`}
              subtext="active prediction risk score"
              icon={ShieldAlert}
              iconColor={health.overallRiskScore >= 60 ? 'text-rose-400' : 'text-zinc-500'}
              pulseActive={health.overallRiskScore >= 60}
              pulseColor="bg-rose-500"
            />

            <MetricCard
              title="Active System Incidents"
              value={`${health.activeIncidentsCount}`}
              subtext="anomalies currently active"
              icon={AlertTriangle}
              iconColor={health.activeIncidentsCount > 0 ? 'text-rose-500' : 'text-zinc-550'}
              pulseActive={health.activeIncidentsCount > 0}
              pulseColor="bg-rose-500"
            />

            <MetricCard
              title="Degraded Services"
              value={`${health.degradedServicesCount}`}
              subtext="services reporting warnings"
              icon={Cpu}
              iconColor={health.degradedServicesCount > 0 ? 'text-amber-500' : 'text-zinc-550'}
            />
          </div>

          {/* Subsystem status board */}
          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-lg space-y-4">
            <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-zinc-900 pb-2.5">
              Service Registry Health Summary
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-900/20 border border-zinc-900 rounded-lg flex flex-col justify-between h-24">
                <span className="text-zinc-500 uppercase text-[9px] font-bold block">HEALTHY SERVICES</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold text-emerald-450">{health.healthyServicesCount}</span>
                  <span className="text-emerald-450/40 text-[9px] uppercase font-bold">online</span>
                </div>
              </div>

              <div className="p-4 bg-zinc-900/20 border border-zinc-900 rounded-lg flex flex-col justify-between h-24">
                <span className="text-zinc-500 uppercase text-[9px] font-bold block">DEGRADED SERVICES</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold text-amber-500">{health.degradedServicesCount}</span>
                  <span className="text-amber-500/40 text-[9px] uppercase font-bold">warning</span>
                </div>
              </div>

              <div className="p-4 bg-zinc-900/20 border border-zinc-900 rounded-lg flex flex-col justify-between h-24">
                <span className="text-zinc-500 uppercase text-[9px] font-bold block">CRITICAL SERVICES</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold text-rose-500">{health.criticalServicesCount}</span>
                  <span className="text-rose-500/40 text-[9px] uppercase font-bold">error</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-zinc-600 font-bold">
          Failed to load Operational Health telemetry.
        </div>
      )}
    </div>
  );
}
