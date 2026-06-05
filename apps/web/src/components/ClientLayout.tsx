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
  Loader2,
  ChevronDown,
  Search,
  Menu,
  X,
  GitCommit,
  Bell,
  Sparkles,
  BookOpen,
  History,
  FileText,
  Network,
  Cpu,
  ShieldCheck,
  TrendingUp,
  Activity,
  LineChart
} from 'lucide-react';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAuthenticated, logout, projects, activeProject, setActiveProjectId, createProject } = useAuth();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const commandRoutes = [
    { name: 'System Overview Dashboard', path: '/dashboard', desc: 'Observe Redis queue throughput, workers load, and latencies', icon: LayoutDashboard },
    { name: 'Services Registry Catalog', path: '/services', desc: 'Microservices registry, health indicators, & metadata', icon: Cpu },
    { name: 'Dependency Topology Map', path: '/dependencies', desc: 'SRE dependency graphs, downstream impact cascades, & blast radius analysis', icon: Network },
    { name: 'Reliability Center Ledger', path: '/reliability', desc: 'Service reliability scoring (0-100) & performance trends', icon: ShieldCheck },
    { name: 'Predictive Warnings Center', path: '/predictions', desc: 'Deterministic incident predictions & queue backlog projections', icon: TrendingUp },
    { name: 'Global Health Center', path: '/health', desc: 'Platform health status command center and quick-stats overview', icon: Activity },
    { name: 'SRE Performance Analytics', path: '/analytics', desc: 'Quarterly MTTR reports, stability rate trends, & incident stats', icon: LineChart },
    { name: 'Queues Registry Catalog', path: '/queues', desc: 'List active Redis BullMQ channels, pause/resume workers', icon: Layers },
    { name: 'Incident Exceptions Workspace', path: '/incidents', desc: 'Inspect failing job parameters and Zod validations', icon: AlertCircle },
    { name: 'Dead-Letter Queue Pool', path: '/dead-letter', desc: 'Trace max retry crashes, audit payload stacktraces', icon: Inbox },
    { name: 'Reliability Copilot Chat', path: '/copilot', desc: 'Ask operational questions and trace grounded SRE telemetry', icon: Sparkles },
    { name: 'Recurring failure patterns', path: '/recurring-incidents', desc: 'Audit repeat error patterns and preventions', icon: History },
    { name: 'Recovery runbooks manual', path: '/runbooks', desc: 'Step-by-step resolution guides', icon: FileText },
    { name: 'SRE Knowledge Base', path: '/knowledge-base', desc: 'Search historical resolved incident learnings', icon: BookOpen },
    { name: 'Simulation Control Sandbox', path: '/settings', desc: 'Inject synthetic traffic and simulate SMTP/Stripe bottlenecks', icon: Sliders },
  ];

  const filteredRoutes = commandRoutes.filter(route =>
    route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    setPaletteIndex(0);
  }, [searchQuery]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowLogoutModal(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  useEffect(() => {
    if (!showCommandPalette) return;
    const handlePaletteKeys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPaletteIndex((prev) => (filteredRoutes.length > 0 ? (prev + 1) % filteredRoutes.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPaletteIndex((prev) => (filteredRoutes.length > 0 ? (prev - 1 + filteredRoutes.length) % filteredRoutes.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredRoutes[paletteIndex]) {
          router.push(filteredRoutes[paletteIndex].path);
          setShowCommandPalette(false);
          setSearchQuery('');
        }
      }
    };
    window.addEventListener('keydown', handlePaletteKeys);
    return () => window.removeEventListener('keydown', handlePaletteKeys);
  }, [showCommandPalette, filteredRoutes, paletteIndex, router]);

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
    return `flex items-center space-x-3 px-3 py-2 rounded-md text-[13px] font-sans font-medium transition-all ${active
        ? 'bg-zinc-900 text-white font-semibold'
        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
      }`;
  };

  const navIconClass = (path: string) => {
    const active = isActive(path);
    return `w-4 h-4 shrink-0 ${active ? 'text-zinc-200' : 'text-zinc-500'
      }`;
  };

  const sectionHeaderClass = "px-3 mt-4 mb-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-sans";

  // ── Shared sidebar content ───────────────────────────────────────────────
  const SidebarContent = () => (
    <>
      <div className="flex flex-col h-full justify-between">
        <div>
          {/* Brand Header */}
          <div className="px-5 py-4 flex items-center space-x-2.5 border-b border-zinc-900">
            <div className="w-5 h-5 rounded bg-zinc-100 flex items-center justify-center font-bold text-[11px] text-black font-sans shrink-0">
              Q
            </div>
            <span className="text-[13px] font-bold text-white uppercase tracking-wider font-sans">QueueWatch</span>
          </div>

          {/* Project selector dropdown */}
          <div className="px-4 py-3 border-b border-zinc-900 relative">
            <div
              onClick={() => setShowProjectDropdown(prev => !prev)}
              className="flex items-center justify-between bg-zinc-900/20 hover:bg-zinc-900/50 border border-zinc-900 rounded-md px-3 py-2 cursor-pointer transition-all"
            >
              <div className="flex flex-col min-w-0 text-left font-sans">
                <span className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider leading-none mb-1">Project</span>
                <span className="text-xs font-semibold text-zinc-200 truncate">
                  {activeProject ? activeProject.name : 'Select Project'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0 ml-2" />
            </div>

            {/* Project selection dropdown */}
            {showProjectDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProjectDropdown(false)}
                />
                <div className="absolute top-[56px] left-4 right-4 bg-zinc-950 border border-zinc-900 rounded-md shadow-2xl z-50 py-1 font-sans text-xs space-y-0.5 max-h-48 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[9px] text-zinc-550 uppercase tracking-widest font-bold border-b border-zinc-900/60 mb-1">
                    Select Project
                  </div>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActiveProjectId(p.id);
                        setShowProjectDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 transition-colors flex items-center justify-between ${p.id === (activeProject?.id)
                          ? 'bg-zinc-900 text-white font-semibold'
                          : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'
                        }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {p.id === (activeProject?.id) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 ml-1.5" />
                      )}
                    </button>
                  ))}
                  {projects.length === 0 && (
                    <div className="px-3 py-2 text-zinc-500 text-xs">
                      No active projects.
                    </div>
                  )}
                  <div className="h-px bg-zinc-900 my-1" />
                  <button
                    onClick={() => {
                      setShowCreateProjectModal(true);
                      setShowProjectDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-900/50 hover:text-white transition-colors font-semibold flex items-center space-x-1.5"
                  >
                    <span>+ Create Project</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Search Input */}
          <div className="px-4 py-2 border-b border-zinc-900/60">
            <button
              onClick={() => setShowCommandPalette(true)}
              className="w-full flex items-center justify-between bg-zinc-900/20 border border-zinc-900 px-3 py-1.5 rounded-md text-xs font-sans text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-350 transition-colors focus:outline-none"
            >
              <div className="flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5" />
                <span>Search pages...</span>
              </div>
              <span className="bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 text-[9px] text-zinc-650 font-sans font-bold">⌘K</span>
            </button>
          </div>

          {/* Grouped Nav Links */}
          <nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">
            {/* Overview */}
            <div>
              <div className={sectionHeaderClass}>Overview</div>
              <div className="space-y-0.5">
                <Link href="/dashboard" className={navItemClass('/dashboard')}>
                  <LayoutDashboard className={navIconClass('/dashboard')} />
                  <span>Dashboard</span>
                </Link>
              </div>
            </div>

            {/* Monitor */}
            <div>
              <div className={sectionHeaderClass}>Monitor</div>
              <div className="space-y-0.5">
                <Link href="/queues" className={navItemClass('/queues')}>
                  <Layers className={navIconClass('/queues')} />
                  <span>Queues</span>
                </Link>
                <Link href="/workers" className={navItemClass('/workers')}>
                  <Cpu className={navIconClass('/workers')} />
                  <span>Workers</span>
                </Link>
                <Link href="/logs" className={navItemClass('/logs')}>
                  <Terminal className={navIconClass('/logs')} />
                  <span>Logs</span>
                </Link>
              </div>
            </div>

            {/* Investigate */}
            <div>
              <div className={sectionHeaderClass}>Investigate</div>
              <div className="space-y-0.5">
                <Link href="/incidents" className={navItemClass('/incidents')}>
                  <AlertCircle className={navIconClass('/incidents')} />
                  <span>Incidents</span>
                </Link>
                <Link href="/dead-letter" className={navItemClass('/dead-letter')}>
                  <Inbox className={navIconClass('/dead-letter')} />
                  <span>Dead Letter</span>
                </Link>
                <Link href="/deployments" className={navItemClass('/deployments')}>
                  <GitCommit className={navIconClass('/deployments')} />
                  <span>Deployments</span>
                </Link>
              </div>
            </div>

            {/* Intelligence */}
            <div>
              <div className={sectionHeaderClass}>Intelligence</div>
              <div className="space-y-0.5">
                <Link href="/copilot" className={navItemClass('/copilot')}>
                  <Sparkles className={navIconClass('/copilot')} />
                  <span>Copilot</span>
                </Link>
                <Link href="/reliability" className={navItemClass('/reliability')}>
                  <ShieldCheck className={navIconClass('/reliability')} />
                  <span>Reliability</span>
                </Link>
                <Link href="/predictions" className={navItemClass('/predictions')}>
                  <TrendingUp className={navIconClass('/predictions')} />
                  <span>Predictions</span>
                </Link>
                <Link href="/knowledge-base" className={navItemClass('/knowledge-base')}>
                  <BookOpen className={navIconClass('/knowledge-base')} />
                  <span>Knowledge Base</span>
                </Link>
              </div>
            </div>

            {/* Platform */}
            <div>
              <div className={sectionHeaderClass}>Platform</div>
              <div className="space-y-0.5">
                <Link href="/sdk" className={navItemClass('/sdk')}>
                  <Sliders className={navIconClass('/sdk')} />
                  <span>SDK Setup & Keys</span>
                </Link>
                <Link href="/settings" className={navItemClass('/settings')}>
                  <Sliders className={navIconClass('/settings')} />
                  <span>Settings</span>
                </Link>
              </div>
            </div>
          </nav>
        </div>

        {/* User Identity and Session Management */}
        <div className="border-t border-zinc-900 bg-zinc-950/20 flex flex-col mt-auto">
          {user && (
            <div className="px-4 py-3.5 flex items-center justify-between bg-zinc-950/45">
              <div className="flex items-center space-x-2.5 min-w-0 font-sans">
                <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 font-bold text-zinc-300">
                  {user.name.substring(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-[12px] font-bold text-white truncate leading-none mb-1">{user.name}</h4>
                  <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
                </div>
              </div>

              <button
                onClick={() => setShowLogoutModal(true)}
                className="p-1.5 rounded hover:bg-rose-500/10 text-zinc-550 hover:text-rose-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex overflow-x-hidden min-h-screen w-full bg-zinc-950 text-zinc-200">

      {/* ── Mobile sidebar backdrop overlay ─────────────────────────────── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-fade-in"
        />
      )}

      {/* ── Sidebar — mobile: slide-in drawer, md+: static ──────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-900 bg-zinc-950 flex flex-col justify-between h-screen
          transform transition-transform duration-300 ease-in-out
          md:static md:translate-x-0 md:z-auto md:w-56 lg:w-60 md:shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-3 md:hidden p-1 rounded text-zinc-500 hover:text-white transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>

        <SidebarContent />
      </aside>

      {/* ── Main Content Area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <header className="h-14 border-b border-zinc-900 px-4 md:px-6 flex items-center justify-between bg-zinc-950/40 backdrop-blur-md sticky top-0 z-30 font-sans">

          {/* Left: Hamburger + Project Name + Health Status */}
          <div className="flex items-center space-x-4">
            {/* Hamburger — only on mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2.5">
              <span className="text-xs font-semibold text-white tracking-tight">
                {activeProject ? activeProject.name : 'Select Project'}
              </span>
              {activeProject && (
                <span className="flex items-center space-x-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse active-pulse-emerald" />
                  <span>Healthy</span>
                </span>
              )}
            </div>
          </div>

          {/* Right: Search Box + Bell + Avatar */}
          <div className="flex items-center space-x-4">
            {/* Vercel-like Search Button */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="hidden md:flex items-center space-x-2 bg-zinc-900/40 border border-zinc-900/80 hover:border-zinc-800 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-300 transition-all focus:outline-none w-44 lg:w-56 justify-between"
            >
              <div className="flex items-center space-x-2">
                <Search className="w-3.5 h-3.5 text-zinc-500" />
                <span className="font-sans">Search...</span>
              </div>
              <kbd className="bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-855 text-[9px] text-zinc-550 font-sans font-bold">⌘K</kbd>
            </button>

            {/* Notification Bell */}
            <button className="relative p-1.5 rounded-md hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors">
              <Bell className="w-4 h-4" />
              {activeProject && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              )}
            </button>

            {/* User Avatar / Profile Dropdown */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown(prev => !prev)}
                  className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-300 hover:border-zinc-700 transition-colors select-none focus:outline-none"
                >
                  {user.name.substring(0, 1).toUpperCase()}
                </button>

                {showUserDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-zinc-950 border border-zinc-900 rounded-md shadow-2xl z-50 py-1 font-sans text-xs">
                      <div className="px-3 py-2 border-b border-zinc-900/60 mb-1">
                        <p className="font-semibold text-white truncate">{user.name}</p>
                        <p className="text-[10px] text-zinc-550 truncate">{user.email}</p>
                      </div>
                      <Link
                        href="/settings"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center px-3 py-2 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
                      >
                        Settings
                      </Link>
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          setShowLogoutModal(true);
                        }}
                        className="w-full text-left flex items-center px-3 py-2 text-rose-455 hover:bg-rose-500/10 transition-colors font-medium border-t border-zinc-900/40 mt-1"
                      >
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <main data-scroll-native className="flex-1 p-4 md:p-6 overflow-y-auto bg-zinc-950">
          {children}
        </main>
      </div>

      {/* ── Create project confirmation modal ─────────────────────────────────────── */}
      {showCreateProjectModal && (
        <div
          onClick={() => {
            setShowCreateProjectModal(false);
            setNewProjectName('');
          }}
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-opacity animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-zinc-900 p-6 rounded-lg w-full max-w-sm shadow-2xl font-sans text-sm space-y-4 animate-slide-up text-zinc-300"
          >
            <div className="flex items-center space-x-2 border-b border-zinc-900 pb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
              <span className="text-sm font-semibold text-white">Create New Project</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Project Name</label>
              <input
                autoFocus
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Production Web Service"
                className="w-full bg-zinc-900/40 border border-zinc-900 rounded-md px-3 py-2 focus:outline-none focus:border-zinc-700 text-sm text-white"
              />
            </div>

            <div className="flex space-x-3 pt-1.5">
              <button
                disabled={creatingProject}
                onClick={() => {
                  setShowCreateProjectModal(false);
                  setNewProjectName('');
                }}
                className="flex-1 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-850 text-xs font-semibold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={creatingProject || !newProjectName.trim()}
                onClick={async () => {
                  try {
                    setCreatingProject(true);
                    await createProject(newProjectName.trim());
                    setShowCreateProjectModal(false);
                    setNewProjectName('');
                    router.push('/sdk');
                  } catch (err: any) {
                    alert(err.message || 'Failed to create project');
                  } finally {
                    setCreatingProject(false);
                  }
                }}
                className="flex-1 py-2 rounded-md bg-white hover:bg-zinc-100 text-black text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {creatingProject ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-black animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Project</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Logout confirmation modal ─────────────────────────────────────── */}
      {showLogoutModal && (
        <div
          onClick={() => setShowLogoutModal(false)}
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-opacity animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-zinc-900 p-6 rounded-lg w-full max-w-xs shadow-2xl font-sans text-xs space-y-4 animate-slide-up text-zinc-300"
          >
            <div className="flex items-center space-x-2 border-b border-zinc-900 pb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
              <span className="text-sm font-semibold text-white">Disconnect Session?</span>
            </div>
            <p className="leading-relaxed text-zinc-400 text-xs">
              Are you sure you want to securely terminate your active SRE background telemetry session?
            </p>
            <div className="flex space-x-3 pt-1.5">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  logout();
                  setShowLogoutModal(false);
                  router.push('/login');
                }}
                className="flex-1 py-2 rounded-md bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Command Palette ───────────────────────────────────────────────── */}
      {showCommandPalette && (
        <div
          onClick={() => {
            setShowCommandPalette(false);
            setSearchQuery('');
          }}
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex justify-center pt-[12vh] px-4 transition-opacity animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-zinc-900 w-full max-w-lg rounded-lg shadow-2xl overflow-hidden font-sans text-xs animate-slide-up h-fit"
          >
            <div className="flex items-center space-x-3 px-4 py-3 border-b border-zinc-900 bg-zinc-950">
              <Search className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Search pages, tools, and actions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-zinc-500 py-1"
              />
              <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 shrink-0">ESC</span>
            </div>

            <div className="max-h-64 overflow-y-auto p-2 space-y-1">
              {filteredRoutes.map((route, index) => {
                const IconComponent = route.icon;
                const isSelected = index === paletteIndex;
                return (
                  <div
                    key={route.path}
                    onClick={() => {
                      router.push(route.path);
                      setShowCommandPalette(false);
                      setSearchQuery('');
                    }}
                    onMouseEnter={() => setPaletteIndex(index)}
                    className={`flex items-start space-x-3 px-4 py-3 rounded-md cursor-pointer transition-colors ${isSelected
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-white'
                      }`}
                  >
                    <IconComponent className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-white' : 'text-zinc-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs">{route.name}</span>
                        {isSelected && (
                          <span className="text-[10px] text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 shrink-0 ml-2">
                            Enter
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-normal">
                        {route.desc}
                      </p>
                    </div>
                  </div>
                );
              })}

              {filteredRoutes.length === 0 && (
                <div className="py-6 text-center text-zinc-555 font-semibold">
                  No active console destinations matched query.
                </div>
              )}
            </div>

            <div className="bg-zinc-950 border-t border-zinc-900/60 px-4 py-2.5 flex items-center justify-between text-[10px] text-zinc-555 font-medium">
              <span>Quick Navigation</span>
              <span className="hidden sm:block">Use ↑↓ keys to navigate • Enter to select • Esc to dismiss</span>
            </div>
          </div>
        </div>
      )}
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
