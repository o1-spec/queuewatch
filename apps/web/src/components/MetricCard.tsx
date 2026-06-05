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
  // Map standard Tailwind colors to muted zinc equivalents for professional infrastructure design
  const dotColor = pulseColor.includes('emerald') 
    ? 'bg-emerald-500' 
    : pulseColor.includes('rose') 
    ? 'bg-rose-500 animate-pulse' 
    : pulseColor.includes('indigo') 
    ? 'bg-blue-500' 
    : 'bg-zinc-500';

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 relative overflow-hidden group transition-all hover:border-zinc-800">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400 font-medium font-sans">{title}</p>
        <Icon className={`w-4 h-4 text-zinc-500 group-hover:${iconColor} transition-colors`} />
      </div>
      <p className="text-3xl font-bold text-white mt-3 font-sans tracking-tight leading-none">{value}</p>
      <div className="flex items-center space-x-1.5 text-xs mt-3 text-zinc-400 font-sans">
        {pulseActive && (
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`}></span>
        )}
        <span className="truncate">{subtext}</span>
      </div>
    </div>
  );
}

export default MetricCard;
