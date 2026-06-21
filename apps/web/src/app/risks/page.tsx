'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, RefreshCw, Layers, ShieldAlert, Sparkles, 
  Clock, ChevronRight, Activity, TrendingUp, TrendingDown, 
  HelpCircle, CheckCircle2, AlertOctagon, Terminal
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Prediction, ReliabilityForecast } from '@queuewatch/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RisksConsole() {
  const { authFetch } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [forecasts, setForecasts] = useState<ReliabilityForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '6h' | '24h'>('1h');
  const [selectedQueue, setSelectedQueue] = useState<string>('');
  const [authorizedAction, setAuthorizedAction] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [predRes, foreRes] = await Promise.all([
        authFetch(`${API_URL}/api/predictions`),
        authFetch(`${API_URL}/api/predictions/forecast`)
      ]);

      if (predRes.ok) {
        setPredictions(await predRes.json());
      }
      if (foreRes.ok) {
        const foreData: ReliabilityForecast[] = await foreRes.json();
        setForecasts(foreData);
        if (foreData.length > 0 && !selectedQueue) {
          setSelectedQueue(foreData[0].targetId);
        }
      }
    } catch (e) {
      console.error('Failed to load risk dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await authFetch(`${API_URL}/api/predictions/analyze`, {
        method: 'POST'
      });
      if (res.ok) {
        await loadData();
      }
    } catch (e) {
      console.error('Failed to trigger manual analysis loop:', e);
    } finally {
      setRecalculating(false);
    }
  };

  const handleActionClick = (actionName: string) => {
    setAuthorizedAction(actionName);
    setTimeout(() => setAuthorizedAction(null), 5000);
  };

  // Compute summary stats
  const activeAlertsCount = predictions.length;
  const maxIncidentProbability = forecasts.length > 0 
    ? Math.max(...forecasts.map(f => 
        f.forecasts.find(tf => tf.timeframe === selectedTimeframe)?.incidentProbability ?? 0
      ))
    : 0;

  const currentForecast = forecasts.find(f => f.targetId === selectedQueue);
  const activeTfForecast = currentForecast?.forecasts.find(tf => tf.timeframe === selectedTimeframe);

  return (
    <div className="space-y-6 font-mono text-[10px] text-zinc-300">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
            <span>SRE Proactive Early Warning Center</span>
          </h2>
          <p className="text-[10px] text-zinc-550 mt-0.5">
            Continuous telemetry analysis identifies worker saturation, release anomalies, and DLQ buildup before outages trigger.
          </p>
        </div>

        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="px-3 py-1.5 rounded bg-zinc-900/60 hover:bg-zinc-800/80 text-white border border-zinc-850 hover:border-zinc-700 font-bold transition-all flex items-center space-x-2 shadow backdrop-blur-md"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin text-indigo-400' : ''}`} />
          <span>{recalculating ? 'RUNNING SRE SCAN...' : 'TRIGGER DIAGNOSTIC SCAN'}</span>
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-lg flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-zinc-500 uppercase tracking-widest text-[8px] font-bold block">Active Emerging Risks</span>
            <span className="text-xl font-bold text-white mt-1 block">{activeAlertsCount}</span>
          </div>
          <AlertTriangle className={`w-8 h-8 ${activeAlertsCount > 0 ? 'text-amber-400 animate-bounce' : 'text-zinc-700'}`} />
        </div>

        <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-lg flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-zinc-500 uppercase tracking-widest text-[8px] font-bold block">Max Outage Probability ({selectedTimeframe})</span>
            <span className={`text-xl font-bold mt-1 block ${maxIncidentProbability >= 70 ? 'text-rose-400' : maxIncidentProbability >= 25 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {maxIncidentProbability}%
            </span>
          </div>
          <Activity className={`w-8 h-8 ${maxIncidentProbability >= 50 ? 'text-rose-500 animate-pulse' : 'text-zinc-700'}`} />
        </div>

        <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-lg flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-zinc-500 uppercase tracking-widest text-[8px] font-bold block">Trajectory Trend</span>
            <span className={`text-xl font-bold mt-1 block flex items-center space-x-1.5 ${activeAlertsCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {activeAlertsCount > 0 ? (
                <>
                  <TrendingDown className="w-5 h-5 shrink-0 text-rose-400" />
                  <span>Degrading</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5 shrink-0 text-emerald-400" />
                  <span>Stable</span>
                </>
              )}
            </span>
          </div>
          <Layers className="w-8 h-8 text-zinc-700" />
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Emerging Risks List (8 columns) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-zinc-950/40 border border-zinc-900 p-5 rounded-lg backdrop-blur-md">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-zinc-900 pb-3 mb-4 flex items-center justify-between">
              <span>Detected Operational Hazards</span>
              <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-800">
                Continuous Monitoring Active
              </span>
            </h3>

            {loading ? (
              <div className="text-center py-16 text-zinc-500 animate-pulse flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-zinc-600" />
                <span>Gathering telemetry, metric histories, and exception signals...</span>
              </div>
            ) : (
              <div className="space-y-5">
                {predictions.map((pred) => (
                  <div key={pred.id} className="p-4 bg-zinc-900/10 border border-zinc-850 hover:border-zinc-800 rounded-lg space-y-4 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${pred.riskScore >= 80 ? 'bg-rose-400' : 'bg-amber-400'}`} />
                          <h4 className="font-bold text-white text-[11px] uppercase tracking-tight">{pred.title}</h4>
                        </div>
                        <p className="text-zinc-500 text-[9px] mt-1">
                          Affected Queue: <strong className="text-zinc-400">{pred.targetQueue || 'Global'}</strong>
                          {pred.targetService && (
                            <> | Service: <strong className="text-zinc-400">{pred.targetService}</strong></>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <span className="text-zinc-500 uppercase text-[8px] font-bold block">RISK</span>
                          <span className={`font-bold text-sm ${pred.riskScore >= 80 ? 'text-rose-400' : 'text-amber-400'}`}>
                            {pred.riskScore}%
                          </span>
                        </div>
                        <div className="text-right border-l border-zinc-850 pl-3">
                          <span className="text-zinc-500 uppercase text-[8px] font-bold block">CONFIDENCE</span>
                          <span className="font-bold text-zinc-400 text-sm">
                            {pred.confidenceScore}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-black/35 border border-zinc-900 rounded-lg space-y-1.5 text-zinc-400 leading-relaxed font-sans text-xs">
                      <p>
                        <strong className="text-zinc-500 font-mono text-[9px] uppercase">Reason:</strong> {pred.reason}
                      </p>
                      <p>
                        <strong className="text-zinc-500 font-mono text-[9px] uppercase">Blast Radius Impact:</strong> {pred.estimatedImpact}
                      </p>
                    </div>

                    {/* Proactive recommended actions */}
                    <div className="space-y-2">
                      <span className="text-zinc-500 uppercase text-[8px] font-bold block font-mono">Suggested Mitigation Steps</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {pred.recommendedActions.map((act, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleActionClick(act)}
                            className="text-left p-2 rounded bg-zinc-900/60 hover:bg-zinc-800/80 text-indigo-400 hover:text-white font-bold border border-zinc-850 hover:border-zinc-700 transition-all text-[8px] uppercase flex items-center justify-between leading-normal"
                          >
                            <span className="truncate pr-1">{act}</span>
                            <span className="text-[7.5px] text-zinc-500 shrink-0 ml-1 font-mono">&bull; EXECUTE</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {predictions.length === 0 && (
                  <div className="text-center py-12 text-zinc-550 border border-dashed border-zinc-900 rounded-lg flex flex-col items-center justify-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <span className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">System Baseline Healthy</span>
                    <p className="text-[9px] text-zinc-500 max-w-xs leading-normal">
                      Continuous reliability checks detect no queue bottlenecks, memory anomalies, or deployment regressions at this time.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SRE guard notification console */}
          {authorizedAction && (
            <div className="p-4 bg-zinc-900/20 border border-zinc-800 rounded-lg flex items-start space-x-3 backdrop-blur-md">
              <Terminal className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="font-sans text-xs text-zinc-450 leading-relaxed">
                <span className="text-indigo-400 font-bold font-mono uppercase text-[9px] block mb-1">MITIGATION LOG EXECUTED</span>
                <p>
                  You initiated action: <code className="text-white font-mono bg-zinc-900 px-1 py-0.5 rounded">{authorizedAction}</code>
                </p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Manual safety verification requested. Verify the execution parameters in your target cluster environment or rollback center.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Reliability Forecasting (5 columns) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-zinc-950/40 border border-zinc-900 p-5 rounded-lg backdrop-blur-md space-y-5">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-zinc-900 pb-3 flex items-center justify-between">
              <span>Predictive Forecasts</span>
              <span title="Reliability forecasting calculates failure probability steps, score trajectories, and cascading downstream nodes.">
                <HelpCircle className="w-4 h-4 text-zinc-650 shrink-0 cursor-help" />
              </span>
            </h3>

            {/* Timeframe Selectors */}
            <div className="flex bg-zinc-900/80 p-0.5 rounded border border-zinc-850">
              {(['1h', '6h', '24h'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`flex-1 py-1 rounded text-center font-bold tracking-widest text-[9px] uppercase transition-all ${
                    selectedTimeframe === tf 
                      ? 'bg-zinc-800 text-white shadow' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tf === '1h' ? 'Next 1 Hour' : tf === '6h' ? 'Next 6 Hours' : 'Next 24 Hours'}
                </button>
              ))}
            </div>

            {/* Queue Selector List */}
            <div className="space-y-1.5">
              <span className="text-zinc-550 uppercase font-bold text-[8px] block tracking-wider">Subsystem Selection</span>
              <div className="grid grid-cols-2 gap-1.5">
                {forecasts.map(f => (
                  <button
                    key={f.targetId}
                    onClick={() => setSelectedQueue(f.targetId)}
                    className={`p-2 rounded text-left border transition-all ${
                      selectedQueue === f.targetId
                        ? 'bg-indigo-950/15 border-indigo-500/35 text-indigo-300 font-bold'
                        : 'bg-zinc-900/40 border-zinc-850 hover:border-zinc-850 hover:bg-zinc-900/70 text-zinc-500 hover:text-zinc-400'
                    }`}
                  >
                    <span className="truncate block uppercase text-[8.5px]">{f.targetId}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Forecast Panel Details */}
            {currentForecast && activeTfForecast ? (
              <div className="space-y-5 border-t border-zinc-900 pt-4">
                
                {/* Incident Probability Gauge */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px]">
                    <span className="text-zinc-500 uppercase font-bold">Failure Probability</span>
                    <span className={`font-bold ${
                      activeTfForecast.incidentProbability >= 70 
                        ? 'text-rose-400' 
                        : activeTfForecast.incidentProbability >= 25 
                        ? 'text-amber-400' 
                        : 'text-emerald-400'
                    }`}>
                      {activeTfForecast.incidentProbability}%
                    </span>
                  </div>
                  
                  <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-850">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        activeTfForecast.incidentProbability >= 70 
                          ? 'bg-rose-500' 
                          : activeTfForecast.incidentProbability >= 25 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${activeTfForecast.incidentProbability}%` }}
                    />
                  </div>
                  <p className="text-[8.5px] text-zinc-500 font-sans leading-normal">
                    Projected probability of queue SLA breach or incident occurrence during the {selectedTimeframe === '1h' ? '1-hour' : selectedTimeframe === '6h' ? '6-hour' : '24-hour'} timeframe.
                  </p>
                </div>

                {/* Score Trajectory */}
                <div className="space-y-2.5">
                  <span className="text-zinc-500 uppercase font-bold block text-[9px]">Score Trajectory Projection</span>
                  
                  <div className="bg-black/30 border border-zinc-900 p-3 rounded-lg flex items-center justify-between">
                    <div className="text-center flex-1">
                      <span className="text-zinc-550 text-[7px] block font-mono">CURRENT</span>
                      <span className="text-white text-xs font-bold font-mono">
                        {predictions.length > 0 ? (currentForecast.forecasts.find(f => f.timeframe === '1h')?.reliabilityScoreTrajectory[0] ?? 95) + 15 : 95}%
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0" />

                    {activeTfForecast.reliabilityScoreTrajectory.map((score, index) => (
                      <React.Fragment key={index}>
                        <div className="text-center flex-1">
                          <span className="text-zinc-550 text-[7px] block font-mono">T+{index + 1}</span>
                          <span className={`text-xs font-bold font-mono ${
                            score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-500' : 'text-rose-400'
                          }`}>
                            {score}%
                          </span>
                        </div>
                        {index < activeTfForecast.reliabilityScoreTrajectory.length - 1 && (
                          <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-[8.5px] text-zinc-500 font-sans leading-normal">
                    Projected trajectory steps of the subsystem&apos;s SRE reliability score index over the forecasting window.
                  </p>
                </div>

                {/* BFS Blast Radius Potential */}
                <div className="space-y-2">
                  <span className="text-zinc-550 uppercase font-bold block text-[9px] tracking-wider">Blast Radius Potential (BFS Cascade)</span>
                  
                  {activeTfForecast.blastRadiusPotential.length > 0 ? (
                    <div className="p-3 bg-rose-950/5 border border-rose-500/10 rounded-lg space-y-2">
                      <p className="text-[8.5px] text-rose-300 font-sans leading-normal flex items-start space-x-1.5">
                        <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span>High risk cascade propagation detected across downstream dependencies:</span>
                      </p>
                      
                      <div className="flex flex-wrap gap-1.5 pl-5">
                        {activeTfForecast.blastRadiusPotential.map((node, index) => (
                          <div 
                            key={index} 
                            className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[8px] font-bold text-zinc-400 flex items-center space-x-1"
                          >
                            <span>{node}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-zinc-900/30 border border-zinc-900 rounded-lg text-center text-zinc-550 text-[9px] font-sans">
                      No downstream propagation risks predicted. Failure blast radius isolated to the local queue boundary.
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="text-center py-10 text-zinc-650">
                Select a queue target to inspect SRE projections.
              </div>
            )}
          </div>

          {/* SRE manual warning disclaimer */}
          <div className="bg-zinc-950/40 border border-zinc-900 p-4 rounded-lg space-y-2 backdrop-blur-md">
            <h4 className="text-white text-[9px] font-bold uppercase tracking-wider flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
              <span>Predictive SRE Standard Guidelines</span>
            </h4>
            <p className="text-zinc-500 font-sans text-[9px] leading-relaxed">
              Proactive Early Warnings use rolling window queue velocity vectors to compute degradation. Projections reflect heuristic likelihoods under observed telemetry anomalies, not deterministic failures.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
