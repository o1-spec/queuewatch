'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Layers, 
  AlertCircle, 
  Inbox, 
  Sliders, 
  LogOut, 
  Terminal, 
  User,
  Loader2,
  ShieldCheck
} from 'lucide-react';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();

  const isPublicPath = pathname === '/' || pathname === '/login' || pathname === '/register';

  useEffect(() => {
    if (!isPublicPath && !loading && !isAuthenticated()) {
      router.push('/login');
    }
  }, [isPublicPath, loading, isAuthenticated, router]);

  if (loading && !isPublicPath) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-xl border border-slate-900 bg-slate-950 flex items-center justify-center shadow-indigo-500/10 shadow-2xl">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-xs font-extrabold uppercase font-mono tracking-widest text-slate-400">Loading Telemetry</h3>
          <p className="text-[10px] text-slate-500 font-mono">Securing WebSocket Gateway Connection...</p>
        </div>
      </div>
    );
  }

  if (!isPublicPath && !isAuthenticated()) {
    return null;
  }

  if (isPublicPath) {
    return <>{children}</>;
  }

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  const navItemClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
      active 
        ? 'bg-indigo-600/15 text-indigo-400 border-l-2 border-indigo-500 pl-3 font-semibold' 
        : 'text-slate-400 hover:text-white hover:bg-white/5 pl-4'
    }`;
  };

  const navIconClass = (path: string) => {
    const active = isActive(path);
    return `w-4 h-4 transition-colors ${
      active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-indigo-400'
    }`;
  };

  return (
    <div className="flex overflow-x-hidden min-h-screen w-full bg-slate-950">
      <aside className="w-64 border-r border-slate-900 bg-slate-950/40 backdrop-blur-xl flex flex-col justify-between shrink-0 h-screen sticky top-0 z-40">
        <div>
          <div className="p-6 border-b border-slate-900 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-indigo-500/30 shadow-md">
              Q
            </div>
            <div>
              <h1 className="font-bold text-md tracking-wider text-white">QueueWatch</h1>
              <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest leading-none">Telemetry Engine</p>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            <Link href="/dashboard" className={navItemClass('/dashboard')}>
              <LayoutDashboard className={navIconClass('/dashboard')} />
              <span>Overview</span>
            </Link>
            <Link href="/queues" className={navItemClass('/queues')}>
              <Layers className={navIconClass('/queues')} />
              <span>Queues Explorer</span>
            </Link>
            <Link href="/incidents" className={navItemClass('/incidents')}>
              <AlertCircle className={navIconClass('/incidents')} />
              <span>Incident Logs</span>
            </Link>
            <Link href="/dead-letter" className={navItemClass('/dead-letter')}>
              <Inbox className={navIconClass('/dead-letter')} />
              <span>Dead Letter</span>
            </Link>
            <Link href="/settings" className={navItemClass('/settings')}>
              <Sliders className={navIconClass('/settings')} />
              <span>Outage Controls</span>
            </Link>
          </nav>
        </div>

        <div className="border-t border-slate-900 bg-slate-950/20 flex flex-col">
          {user && (
            <div className="px-5 py-3.5 border-b border-slate-900 flex items-center space-x-3 bg-slate-950/40">
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white truncate leading-none mb-0.5">{user.name}</h4>
                <p className="text-[10px] text-slate-500 font-mono truncate">{user.email}</p>
              </div>
            </div>
          )}
          
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">Broker Operational</span>
            </div>
            
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              title="Logout Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <header className="h-16 border-b border-slate-900 px-8 flex items-center justify-between bg-slate-950/20 backdrop-blur-md sticky top-0 z-30">
          <div>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest leading-none mb-0.5">BullMQ Observability</p>
            <h2 className="text-xs font-semibold text-white tracking-wide">Realtime Telemetry Center</h2>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-xs flex items-center space-x-2 bg-slate-900/60 px-3.5 py-1.5 rounded-full border border-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
              <span className="text-slate-400 font-medium font-mono text-[10.5px]">Redis Address: 127.0.0.1:6379</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AuthProvider>
  );
}
