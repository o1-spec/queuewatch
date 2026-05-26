'use client';

import React, { useEffect, useState } from 'react';
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
  ChevronDown,
  Search,
  Server
} from 'lucide-react';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();
  
  const [workspace, setWorkspace] = useState('o1-spec / queuewatch');
  const [env, setEnv] = useState<'production' | 'staging'>('production');

  const isPublicPath = pathname === '/' || pathname === '/login' || pathname === '/register';

  useEffect(() => {
    if (!isPublicPath && !loading && !isAuthenticated()) {
      router.push('/login');
    }
  }, [isPublicPath, loading, isAuthenticated, router]);

  if (loading && !isPublicPath) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded border border-zinc-900 bg-zinc-950 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-[10px] font-bold uppercase font-mono tracking-widest text-zinc-400">Loading Telemetry</h3>
          <p className="text-[9px] text-zinc-500 font-mono">Securing WebSocket Gateway Connection...</p>
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
    return `flex items-center space-x-2.5 px-3 py-2 rounded text-[11px] font-mono transition-all font-semibold ${
      active 
        ? 'bg-zinc-900 text-white border-l border-zinc-400 pl-2.5' 
        : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
    }`;
  };

  const navIconClass = (path: string) => {
    const active = isActive(path);
    return `w-3.5 h-3.5 ${
      active ? 'text-white' : 'text-zinc-500'
    }`;
  };

  return (
    <div className="flex overflow-x-hidden min-h-screen w-full bg-zinc-950 text-zinc-200">
      {/* Sidebar */}
      <aside className="w-60 border-r border-zinc-900 bg-zinc-950/40 flex flex-col justify-between shrink-0 h-screen sticky top-0 z-40">
        <div>
          {/* Workspace selector SRE style */}
          <div className="p-4 border-b border-zinc-900">
            <div className="flex items-center justify-between bg-zinc-900/40 border border-zinc-900 rounded px-2.5 py-1.5 cursor-pointer hover:bg-zinc-900 transition-all">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-4 h-4 rounded bg-zinc-700 flex items-center justify-center font-bold text-[10px] text-white shrink-0">
                  Q
                </div>
                <span className="text-[11px] font-bold text-white font-mono truncate">{workspace}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
            </div>

            {/* Environment selector */}
            <div className="flex mt-3 gap-1 p-0.5 bg-zinc-900/50 rounded border border-zinc-900/60 font-mono text-[9px]">
              <button
                onClick={() => setEnv('production')}
                className={`flex-1 py-1 text-center rounded font-bold uppercase transition-all ${env === 'production' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                production
              </button>
              <button
                onClick={() => setEnv('staging')}
                className={`flex-1 py-1 text-center rounded font-bold uppercase transition-all ${env === 'staging' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                staging
              </button>
            </div>
          </div>

          {/* Quick Find (Cmd + K) placeholder */}
          <div className="px-4 py-2 border-b border-zinc-900/60">
            <div className="flex items-center justify-between bg-zinc-900/10 border border-zinc-900 px-2 py-1 rounded text-[10px] font-mono text-zinc-500">
              <div className="flex items-center space-x-1.5">
                <Search className="w-3 h-3" />
                <span>Quick jump...</span>
              </div>
              <span className="bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800 text-[8px]">⌘K</span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="p-3 space-y-1">
            <Link href="/dashboard" className={navItemClass('/dashboard')}>
              <LayoutDashboard className={navIconClass('/dashboard')} />
              <span>Overview</span>
            </Link>
            <Link href="/queues" className={navItemClass('/queues')}>
              <Layers className={navIconClass('/queues')} />
              <span>Queues Registry</span>
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
              <span>Simulation Sandbox</span>
            </Link>
          </nav>
        </div>

        {/* User Identity and Session Management */}
        <div className="border-t border-zinc-900 bg-zinc-950/20 flex flex-col">
          {user && (
            <div className="px-4 py-3 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/40">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[10px] font-bold text-white truncate leading-none mb-0.5">{user.name}</h4>
                  <p className="text-[9px] text-zinc-500 font-mono truncate">{user.email}</p>
                </div>
              </div>
              
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="p-1 rounded hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          
          <div className="p-3.5 flex items-center justify-between font-mono text-[9px] text-zinc-500">
            <div className="flex items-center space-x-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="font-bold uppercase tracking-wider text-zinc-400">broker connected</span>
            </div>
            
            <span>v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <header className="h-14 border-b border-zinc-900 px-6 flex items-center justify-between bg-zinc-950/40 backdrop-blur-md sticky top-0 z-30 font-mono">
          <div className="flex items-center space-x-3 text-[10px]">
            <span className="text-zinc-500 uppercase font-bold">telemetry node:</span>
            <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300 font-bold">127.0.0.1:6379</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 text-[10px] text-zinc-400 bg-zinc-900/40 px-2.5 py-1 rounded border border-zinc-900">
              <Server className="w-3.5 h-3.5 text-zinc-500" />
              <span>Redis active indices: 4</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto bg-zinc-950">
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
