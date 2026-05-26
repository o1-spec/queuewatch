import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext: string;
  icon: LucideIcon;
  iconColor: string; // e.g. "text-emerald-400"
  glowColor?: string; // e.g. "glow-emerald"
  pulseColor?: string; // e.g. "bg-emerald-400"
  pulseActive?: boolean;
}

export function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  iconColor,
  glowColor = '',
  pulseColor = '',
  pulseActive = false,
}: MetricCardProps) {
  return (
    <div className={`glass-card p-6 rounded-2xl relative overflow-hidden group ${glowColor}`}>
      <div className={`absolute top-0 right-0 p-4 ${iconColor}/20 group-hover:${iconColor}/40 transition-colors`}>
        <Icon className="w-8 h-8" />
      </div>
      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{title}</p>
      <p className="text-3xl font-extrabold text-white mt-2 font-mono tracking-tight">{value}</p>
      <div className="flex items-center space-x-1.5 text-[11px] font-semibold mt-2 text-slate-400">
        {pulseActive && (
          <span className={`w-1.5 h-1.5 rounded-full ${pulseColor} ${pulseColor.includes('emerald') ? 'active-pulse-emerald' : 'animate-pulse'}`}></span>
        )}
        <span className={pulseActive ? iconColor : ''}>{subtext}</span>
      </div>
    </div>
  );
}

export default MetricCard;
