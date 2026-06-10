'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { 
  ArrowRight, 
  Copy, 
  Check, 
  Terminal, 
  Book, 
  Key, 
  ShieldAlert, 
  Layers, 
  Activity, 
  HelpCircle,
  Search,
  Github,
  Command,
  BookOpen,
  ArrowUpRight,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';

// Searchable docs database
const docsItems = [
  {
    id: 'intro',
    category: 'Getting Started',
    title: 'Platform Introduction',
    description: 'Overview of QueueWatch operational reliability and SRE diagnostics platform for background systems.',
    snippet: 'QueueWatch maps dependency flows, detects incidents, and monitors worker threads.'
  },
  {
    id: 'installation',
    category: 'Getting Started',
    title: 'Installing the SDK',
    description: 'Install our lightweight telemetry client wrapper via npm package manager.',
    snippet: 'npm install @queuewatch/node'
  },
  {
    id: 'projects',
    category: 'Getting Started',
    title: 'Create Project',
    description: 'Separate environments and services in the Console, generate project API keys, and configure environment variables.',
    snippet: 'QUEUEWATCH_PROJECT_ID, QUEUEWATCH_API_KEY, QUEUEWATCH_ENDPOINT'
  },
  {
    id: 'api-keys',
    category: 'Getting Started',
    title: 'API Credentials',
    description: 'Understand how to retrieve and set up authentication tokens for secure client connections.',
    snippet: 'Secure SRE credentials configuration inside your background processing nodes'
  },
  {
    id: 'bullmq',
    category: 'SDK Reference',
    title: 'BullMQ Integration',
    description: 'Wrap your active BullMQ queues with monitorQueue to hook onto listeners and stream telemetry.',
    snippet: 'monitorQueue(paymentQueue, { projectId, apiKey, endpoint })'
  },
  {
    id: 'events',
    category: 'SDK Reference',
    title: 'Tracked Telemetry Events',
    description: 'Automatic listening and streaming of BullMQ states: active, completed, failed, and stalled.',
    snippet: 'Latency logging, stack traces carrying, stalled/crashed lock indicators'
  },
  {
    id: 'logging',
    category: 'SDK Reference',
    title: 'Structured Logs Correlation',
    description: 'Use the queuewatchLogger stream inside job execution worker blocks to link trace logs directly with incidents.',
    snippet: 'queuewatchLogger.info(\'Job started processing\', { jobId, traceId })'
  },
  {
    id: 'troubleshooting',
    category: 'Guides',
    title: 'Troubleshooting & Support',
    description: 'Verify local port bindings, check Redis server containers, and confirm active authorization keys.',
    snippet: 'NestJS on 3001, Docker queuewatch-redis container, network connections'
  }
];

const sidebarCategories = [
  {
    title: 'Getting Started',
    items: [
      { id: 'intro', label: 'Introduction' },
      { id: 'installation', label: 'Installation' },
      { id: 'projects', label: 'Create Project' },
      { id: 'api-keys', label: 'API Credentials' },
    ]
  },
  {
    title: 'SDK Reference',
    items: [
      { id: 'bullmq', label: 'BullMQ Integration' },
      { id: 'events', label: 'Telemetry Events' },
      { id: 'logging', label: 'Structured Logs' },
    ]
  },
  {
    title: 'Guides',
    items: [
      { id: 'troubleshooting', label: 'Troubleshooting' },
    ]
  }
];

export default function DocsPage() {
  const { isAuthenticated } = useAuth();
  const [copiedSection, setCopiedSection] = useState<'install' | 'init' | 'env' | 'telemetry' | null>(null);
  
  // Interactive UI States
  const [activeSection, setActiveSection] = useState('intro');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  const installCmd = 'npm install @queuewatch/node';

  const envExample = `# QueueWatch Project Credentials
QUEUEWATCH_PROJECT_ID=proj_1780690458226_qffyus
QUEUEWATCH_API_KEY=qw_pk_70ycesng1mlqril8
QUEUEWATCH_ENDPOINT=http://localhost:3001`;

  const setupCode = `import { monitorQueue } from '@queuewatch/node';
import { Queue } from 'bullmq';

// 1. Initialize your BullMQ Queue as usual
const paymentQueue = new Queue('payment_processing', {
  connection: { host: 'localhost', port: 6379 }
});

// 2. Attach QueueWatch telemetry listeners
monitorQueue(paymentQueue, {
  projectId: process.env.QUEUEWATCH_PROJECT_ID,
  apiKey: process.env.QUEUEWATCH_API_KEY,
  endpoint: process.env.QUEUEWATCH_ENDPOINT,
  queueName: 'payment_processing'
});`;

  const logCodeText = `import { queuewatchLogger } from '@queuewatch/node';

// Stream structured SRE logs from inside your worker execution blocks:
worker.on('active', (job) => {
  queuewatchLogger.info('Job started processing', {
    jobId: job.id,
    queueName: 'payment_processing',
    traceId: \`tr_\${job.id}\`
  });
});`;

  // Filter search items
  const filteredResults = searchQuery.trim() === ''
    ? docsItems
    : docsItems.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );

  // Focus search input when modal opens
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [showSearch]);

  // Scroll Spy Observer to highlight active sidebar section
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-10% 0px -60% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, observerOptions);

    docsItems.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Keyboard navigation for search modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
        setSearchQuery('');
        setSearchIndex(0);
      }
      
      if (!showSearch) return;

      if (e.key === 'Escape') {
        setShowSearch(false);
        setSearchQuery('');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSearchIndex((prev) => (filteredResults.length > 0 ? (prev + 1) % filteredResults.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSearchIndex((prev) => (filteredResults.length > 0 ? (prev - 1 + filteredResults.length) % filteredResults.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredResults[searchIndex]) {
          navigateToSection(filteredResults[searchIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, searchQuery, searchIndex, filteredResults]);

  const navigateToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const headerOffset = 80;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      setActiveSection(id);
      setHighlightedSection(id);
      setTimeout(() => setHighlightedSection(null), 1500);
    }
    setShowSearch(false);
    setShowMobileSidebar(false);
    setSearchQuery('');
  };

  const copyToClipboard = (text: string, section: 'install' | 'init' | 'env' | 'telemetry') => {
    if (typeof window === 'undefined') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try { document.execCommand('copy'); } catch { }
      document.body.removeChild(textArea);
    }
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Syntax highlighting components
  const CodeInstall = () => (
    <pre className="text-xs sm:text-[13px] font-mono leading-relaxed select-all">
      <code>
        <span className="text-zinc-550 font-bold">$</span> <span className="text-cyan-400">npm</span> install <span className="text-emerald-400">@queuewatch/node</span>
      </code>
    </pre>
  );

  const CodeEnv = () => (
    <pre className="text-xs sm:text-[13px] font-mono leading-relaxed select-all">
      <code>
        <span className="text-zinc-500"># QueueWatch Project Credentials</span>{'\n'}
        <span className="text-cyan-400">QUEUEWATCH_PROJECT_ID</span>=<span className="text-amber-400">proj_1780690458226_qffyus</span>{'\n'}
        <span className="text-cyan-400">QUEUEWATCH_API_KEY</span>=<span className="text-amber-400">qw_pk_70ycesng1mlqril8</span>{'\n'}
        <span className="text-cyan-400">QUEUEWATCH_ENDPOINT</span>=<span className="text-emerald-400">http://localhost:3001</span>
      </code>
    </pre>
  );

  const CodeSetup = () => (
    <pre className="text-xs sm:text-[13px] font-mono leading-relaxed select-all">
      <code>
        <span className="text-purple-400">import</span> {"{ "}
        <span className="text-sky-300">monitorQueue</span> {" } "}
        <span className="text-purple-400">from</span> <span className="text-emerald-400">{"'@queuewatch/node'"}</span>;{'\n'}
        <span className="text-purple-400">import</span> {"{ "}
        <span className="text-sky-300">Queue</span> {" } "}
        <span className="text-purple-400">from</span> <span className="text-emerald-400">{"'bullmq'"}</span>;{'\n\n'}
        <span className="text-zinc-550 font-medium">{"// 1. Initialize your BullMQ Queue as usual"}</span>{'\n'}
        <span className="text-purple-400">const</span> <span className="text-blue-300">paymentQueue</span> = <span className="text-purple-400">new</span> <span className="text-yellow-300">Queue</span>(<span className="text-emerald-400">{"'payment_processing'"}</span>, {"{"}
        {'\n  '}connection: {"{"} host: <span className="text-emerald-400">{"'localhost'"}</span>, port: <span className="text-amber-400">6379</span> {"}"}
        {'\n'}{"}"});{'\n\n'}
        <span className="text-zinc-550 font-medium">{"// 2. Attach QueueWatch telemetry listeners"}</span>{'\n'}
        <span className="text-sky-300">monitorQueue</span>(paymentQueue, {"{"}
        {'\n  '}projectId: <span className="text-blue-300">process</span>.<span className="text-blue-300">env</span>.<span className="text-amber-400">QUEUEWATCH_PROJECT_ID</span>,
        {'\n  '}apiKey: <span className="text-blue-300">process</span>.<span className="text-blue-300">env</span>.<span className="text-amber-400">QUEUEWATCH_API_KEY</span>,
        {'\n  '}endpoint: <span className="text-blue-300">process</span>.<span className="text-blue-300">env</span>.<span className="text-amber-400">QUEUEWATCH_ENDPOINT</span>,
        {'\n  '}queueName: <span className="text-emerald-400">{"'payment_processing'"}</span>
        {'\n'}{"}"});
      </code>
    </pre>
  );

  const CodeLogger = () => (
    <pre className="text-xs sm:text-[13px] font-mono leading-relaxed select-all">
      <code>
        <span className="text-purple-400">import</span> {"{ "}
        <span className="text-sky-300">queuewatchLogger</span> {" } "}
        <span className="text-purple-400">from</span> <span className="text-emerald-400">{"'@queuewatch/node'"}</span>;{'\n\n'}
        <span className="text-zinc-550 font-medium">{"// Stream structured SRE logs from inside your worker execution blocks:"}</span>{'\n'}
        <span className="text-blue-300">worker</span>.<span className="text-yellow-300">on</span>(<span className="text-emerald-400">{"'active'"}</span>, (<span className="text-orange-300">job</span>) <span className="text-purple-400">=&gt;</span> {"{"}
        {'\n  '}<span className="text-blue-300">queuewatchLogger</span>.<span className="text-yellow-300">info</span>(<span className="text-emerald-400">{"'Job started processing'"}</span>, {"{"}
        {'\n    '}jobId: <span className="text-orange-300">job</span>.<span className="text-blue-300">id</span>,
        {'\n    '}queueName: <span className="text-emerald-400">{"'payment_processing'"}</span>,
        {'\n    '}traceId: <span className="text-emerald-400">{"`tr_"}</span><span className="text-purple-400">{"${"}</span><span className="text-orange-300">job</span>.<span className="text-blue-300">id</span><span className="text-purple-400">{"}"}</span><span className="text-emerald-300">{"`"}</span>
        {'\n  '}{"}"});
        {'\n'}{"}"});
      </code>
    </pre>
  );

  interface PremiumCodeBlockProps {
    filename: string;
    code: string;
    section: 'install' | 'init' | 'env' | 'telemetry';
    children: React.ReactNode;
  }

  const PremiumCodeBlock = ({ filename, code, section, children }: PremiumCodeBlockProps) => {
    const isCopied = copiedSection === section;
    return (
      <div className="bg-[#0b0b0d] border border-zinc-800 rounded-lg overflow-hidden my-5 shadow-xl transition-colors hover:border-zinc-700/80">
        <div className="flex items-center justify-between px-4 py-2 bg-[#09090b] border-b border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div className="flex space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-850"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-850"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-850"></span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400 font-medium">{filename}</span>
          </div>
          <button
            onClick={() => copyToClipboard(code, section)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border transition-all text-[10.5px] font-semibold font-mono ${
              isCopied 
                ? 'text-emerald-400 border-emerald-950/30 bg-emerald-950/10' 
                : 'text-zinc-400 border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            {isCopied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div className="p-4 overflow-x-auto text-zinc-200 bg-[#070708]">
          {children}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-zinc-950 text-zinc-200 min-h-screen relative overflow-x-hidden w-full font-sans antialiased">
      {/* Background SRE Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f11_1px,transparent_1px),linear-gradient(to_bottom,#0f0f11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Search Dialog overlay */}
      {showSearch && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center pt-[10vh] px-4 animate-fade-in"
          onClick={() => {
            setShowSearch(false);
            setSearchQuery('');
          }}
        >
          <div 
            className="bg-[#0f0f12] border border-zinc-800 w-full max-w-xl rounded-lg shadow-2xl overflow-hidden animate-slide-up h-fit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 px-4 py-3.5 border-b border-zinc-850 bg-[#0b0b0d]">
              <Search className="w-4.5 h-4.5 text-zinc-455 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-zinc-200 focus:outline-none placeholder-zinc-500 py-0.5"
              />
              <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-450 font-mono shrink-0">ESC</span>
            </div>

            <div className="max-h-72 overflow-y-auto p-2.5 space-y-1">
              {filteredResults.map((item, idx) => {
                const isSelected = idx === searchIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => navigateToSection(item.id)}
                    onMouseEnter={() => setSearchIndex(idx)}
                    className={`flex items-start justify-between p-3 rounded-md cursor-pointer transition-colors ${
                      isSelected ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-950/20 border border-indigo-900/30">
                          {item.category}
                        </span>
                        <span className="font-semibold text-xs text-zinc-200">{item.title}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1 leading-normal truncate">{item.description}</p>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 shrink-0 font-mono self-center">
                        Enter
                      </span>
                    )}
                  </div>
                );
              })}

              {filteredResults.length === 0 && (
                <div className="py-8 text-center text-zinc-500 text-xs font-semibold">
                  No documentation matches for &quot;{searchQuery}&quot;
                </div>
              )}
            </div>

            <div className="bg-[#0b0b0d] border-t border-zinc-850 px-4 py-2.5 flex items-center justify-between text-[10px] text-zinc-500 font-mono font-medium">
              <span>Quick Navigation</span>
              <span>Use ↑↓ keys to navigate • Enter to select</span>
            </div>
          </div>
        </div>
      )}

      {/* Docs Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md fixed top-0 left-0 right-0 z-40 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/" className="w-5.5 h-5.5 rounded bg-zinc-100 flex items-center justify-center font-bold text-[11px] text-black font-mono shrink-0 shadow-md">
            Q
          </Link>
          <span className="font-mono font-extrabold text-[12px] tracking-wider text-zinc-200">QUEUEWATCH</span>
          <span className="bg-zinc-900 text-zinc-455 text-[10px] px-2 py-0.5 rounded border border-zinc-800 font-semibold font-mono tracking-wide">Docs</span>
        </div>

        {/* Center search button */}
        <button
          onClick={() => setShowSearch(true)}
          className="hidden md:flex items-center space-x-2 bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-850/60 px-3 py-1.5 rounded-md text-xs text-zinc-450 hover:text-zinc-355 transition-all focus:outline-none w-56 lg:w-72 justify-between"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <span className="font-sans">Search docs...</span>
          </div>
          <kbd className="bg-zinc-955 px-1.5 py-0.5 rounded border border-zinc-800 text-[9px] text-zinc-500 font-sans font-bold">⌘K</kbd>
        </button>

        <div className="flex items-center space-x-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-white transition-colors p-1"
            title="GitHub Repository"
          >
            <Github className="w-4.5 h-4.5" />
          </a>
          <Link 
            href={isAuthenticated() ? "/dashboard" : "/login"} 
            className="px-3.5 py-1.5 rounded border border-zinc-855 hover:border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-350 hover:text-zinc-200 font-bold text-xs transition-all flex items-center space-x-1"
          >
            <span>{isAuthenticated() ? "Console" : "Sign In"}</span>
            <ArrowRight className="w-3 h-3 text-zinc-500" />
          </Link>
        </div>
      </header>

      {/* Mobile outlines sticky sub-header */}
      <div className="lg:hidden border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-md sticky top-14 z-30 px-6 py-2.5 flex items-center justify-between text-xs">
        <span className="text-zinc-450 font-medium">
          Section: <span className="text-zinc-200 font-semibold">{
            docsItems.find(item => item.id === activeSection)?.title || 'Introduction'
          }</span>
        </span>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowSearch(true)}
            className="p-1.5 rounded border border-zinc-850 bg-zinc-900/50 text-zinc-400"
            title="Search"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-zinc-855 bg-zinc-900/50 text-zinc-300 hover:text-white"
          >
            <Menu className="w-3.5 h-3.5" />
            <span>Outline</span>
          </button>
        </div>
      </div>

      {/* Mobile outline drawer backdrop */}
      {showMobileSidebar && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Mobile outline drawer content */}
      <aside 
        className={`fixed inset-y-0 right-0 z-50 w-64 bg-zinc-955 border-l border-zinc-900 p-6 transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col justify-between ${
          showMobileSidebar ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <span className="font-mono font-bold text-[10px] text-zinc-455 uppercase tracking-widest">Documentation Outline</span>
            <button 
              onClick={() => setShowMobileSidebar(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="space-y-5">
            {sidebarCategories.map((category) => (
              <div key={category.title} className="space-y-2.5">
                <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] block font-mono">
                  {category.title}
                </span>
                <div className="space-y-1.5 flex flex-col border-l border-zinc-900 pl-1.5">
                  {category.items.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToSection(item.id);
                      }}
                      className={`text-[13.5px] py-1.5 px-3 rounded transition-all font-medium ${
                        activeSection === item.id 
                          ? 'bg-zinc-900/50 text-indigo-400 font-semibold border-l-2 border-indigo-500 pl-2' 
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Flex Wrapper */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 flex items-start gap-8 lg:gap-12 relative w-full pt-24 lg:pt-28">
        {/* Desktop Sidebar Navigation */}
        <aside data-scroll-native className="hidden lg:block w-80 shrink-0 sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto pr-6 border-r border-zinc-900/80 select-none scrollbar-thin">
          <nav className="space-y-8">
            {sidebarCategories.map((category) => (
              <div key={category.title} className="space-y-3">
                <span className="text-zinc-550 font-bold uppercase tracking-widest text-[10.5px] block font-mono">
                  {category.title}
                </span>
                <div className="space-y-1.5 flex flex-col pl-0.5">
                  {category.items.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToSection(item.id);
                      }}
                      className={`text-[14.5px] py-2 px-4 rounded transition-all font-medium border-l-2 ${
                        activeSection === item.id 
                          ? 'border-indigo-500 bg-zinc-900/40 text-indigo-400 font-semibold pl-4' 
                          : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20'
                      }`}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Documentation Content Panel */}
        <main className="flex-1 min-w-0 space-y-16 pb-24 max-w-3xl">
          
          {/* Section 1: Introduction */}
          <section 
            id="intro" 
            className={`scroll-mt-20 space-y-4 transition-all duration-700 rounded-lg p-1.5 ${
              highlightedSection === 'intro' ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'bg-transparent'
            }`}
          >
            <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2.5">
              <Book className="w-7 h-7 text-indigo-400" /> Platform Introduction
            </h1>
            <p className="text-zinc-350 text-[15px] leading-7 font-sans">
              QueueWatch is an operational reliability and SRE diagnostics platform built to monitor, investigate, and triage distributed asynchronous processes. By hooking directly into your background queues and worker runtimes, QueueWatch extracts real-time event logs, stack traces, and worker processing metrics. It generates active dependency topology maps and detects incident bottlenecks automatically, providing SREs with actionable resolution runbooks.
            </p>
          </section>

          {/* Section 2: Installation */}
          <section 
            id="installation" 
            className={`scroll-mt-20 space-y-4 transition-all duration-700 rounded-lg p-1.5 ${
              highlightedSection === 'installation' ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'bg-transparent'
            }`}
          >
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
              <Terminal className="w-6 h-6 text-indigo-400" /> Installing the SDK
            </h2>
            <p className="text-zinc-355 text-[15px] leading-7 font-sans">
              Deploy our lightweight, non-blocking telemetry collector directly into your background worker processes. The SDK collects and streams processing performance data asynchronously to avoid overhead on your active job pipelines.
            </p>
            <PremiumCodeBlock 
              filename="Terminal" 
              code={installCmd} 
              section="install"
            >
              <CodeInstall />
            </PremiumCodeBlock>
          </section>

          {/* Section 3: Create Project */}
          <section 
            id="projects" 
            className={`scroll-mt-20 space-y-4 transition-all duration-700 rounded-lg p-1.5 ${
              highlightedSection === 'projects' ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'bg-transparent'
            }`}
          >
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
              <Key className="w-6 h-6 text-indigo-400" /> Create a Project
            </h2>
            <p className="text-zinc-355 text-[15px] leading-7 font-sans">
              QueueWatch segments telemetry event records using distinct projects. This allows you to separate dashboards for staging, production, or individual microservices:
            </p>
            <ol className="space-y-3.5 text-zinc-355 text-[14.5px] leading-7 pl-6 list-decimal font-sans">
              <li>Open the <Link href="/login" className="text-indigo-400 hover:text-indigo-350 underline font-semibold transition-colors">QueueWatch Console</Link>.</li>
              <li>Click the project selector in the left sidebar and select <span className="text-zinc-100 font-semibold">+ Create Project</span>.</li>
              <li>Enter a descriptive name (e.g., <code className="bg-zinc-900 border border-zinc-800 text-indigo-355 px-1.5 py-0.5 rounded font-mono text-[13px]">Checkout API - Production</code>).</li>
              <li>Copy the credentials from the project setup panel and assign them in your environment settings (<code className="bg-zinc-900 border border-zinc-800 text-indigo-355 px-1.5 py-0.5 rounded font-mono text-[13px]">.env</code>):</li>
            </ol>

            <PremiumCodeBlock 
              filename=".env" 
              code={envExample} 
              section="env"
            >
              <CodeEnv />
            </PremiumCodeBlock>
          </section>

          {/* Section 4: API Credentials */}
          <section 
            id="api-keys" 
            className={`scroll-mt-20 space-y-4 transition-all duration-700 rounded-lg p-1.5 ${
              highlightedSection === 'api-keys' ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'bg-transparent'
            }`}
          >
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
              <Key className="w-6 h-6 text-indigo-400" /> API Credentials Security
            </h2>
            <p className="text-zinc-355 text-[15px] leading-7 font-sans">
              Authentication tokens authorize your background queues to transmit telemetry to our SRE event ingestion brokers. Keep these tokens secure.
            </p>

            <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-lg p-4 flex items-start gap-3 text-zinc-305 text-[13.5px] leading-relaxed">
              <ShieldAlert className="w-4.5 h-4.5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-100">Security Best Practice:</span> Never expose your API keys in client-side code bundles. Always load them secure in environment variables on your background processing servers or secrets manager.
              </div>
            </div>
          </section>

          {/* Section 5: BullMQ Integration */}
          <section 
            id="bullmq" 
            className={`scroll-mt-20 space-y-4 transition-all duration-700 rounded-lg p-1.5 ${
              highlightedSection === 'bullmq' ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'bg-transparent'
            }`}
          >
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
              <Layers className="w-6 h-6 text-indigo-400" /> BullMQ Integration
            </h2>
            <p className="text-zinc-355 text-[15px] leading-7 font-sans">
              To capture metrics, import the SDK and wrap your active BullMQ queues. This hooks onto queue listeners and streams telemetry indicators to your designated ingestion server:
            </p>

            <PremiumCodeBlock 
              filename="instrument.ts" 
              code={setupCode} 
              section="init"
            >
              <CodeSetup />
            </PremiumCodeBlock>
          </section>

          {/* Section 6: Telemetry Events */}
          <section 
            id="events" 
            className={`scroll-mt-20 space-y-4 transition-all duration-700 rounded-lg p-1.5 ${
              highlightedSection === 'events' ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'bg-transparent'
            }`}
          >
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-indigo-400" /> Tracked Telemetry Events
            </h2>
            <p className="text-zinc-355 text-[15px] leading-7 font-sans">
              Once wrapped with the <code className="bg-zinc-900 border border-zinc-800 text-indigo-350 px-1.5 py-0.5 rounded font-mono text-[13px]">monitorQueue</code> function, the SDK automatically listens for and transmits the following state transitions:
            </p>

            <div className="border border-zinc-800 rounded-lg overflow-hidden font-mono text-[12px] bg-[#0b0b0d]">
              <div className="grid grid-cols-1 sm:grid-cols-12 bg-[#09090b] px-4 py-2.5 text-zinc-400 font-bold border-b border-zinc-800">
                <div className="col-span-1 sm:col-span-4 font-mono tracking-wider">EVENT STATE</div>
                <div className="col-span-1 sm:col-span-8 font-mono tracking-wider hidden sm:block">TELEMETRY DETAIL</div>
              </div>
              <div className="divide-y divide-zinc-800">
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 text-zinc-305 gap-1 sm:gap-0">
                  <div className="col-span-1 sm:col-span-4 font-bold text-indigo-400">active</div>
                  <div className="col-span-1 sm:col-span-8 font-sans leading-relaxed text-zinc-350">Fired when a worker thread pulls a job and begins executing its handler. Starts the execution timer.</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 text-zinc-305 gap-1 sm:gap-0">
                  <div className="col-span-1 sm:col-span-4 font-bold text-indigo-400">completed</div>
                  <div className="col-span-1 sm:col-span-8 font-sans leading-relaxed text-zinc-350">Fired upon successful job completion, logging processing execution latencies and memory usage.</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 text-zinc-305 gap-1 sm:gap-0">
                  <div className="col-span-1 sm:col-span-4 font-bold text-indigo-400">failed</div>
                  <div className="col-span-1 sm:col-span-8 font-sans leading-relaxed text-zinc-350">Fired on job errors, carrying payload exception messages, stack traces, and retries attempts counts.</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 text-zinc-305 gap-1 sm:gap-0">
                  <div className="col-span-1 sm:col-span-4 font-bold text-indigo-400">stalled</div>
                  <div className="col-span-1 sm:col-span-8 font-sans leading-relaxed text-zinc-350">Fired when locks expire, indicating crashed or frozen worker execution threads that require rescheduling.</div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 7: Structured Logs */}
          <section 
            id="logging" 
            className={`scroll-mt-20 space-y-4 transition-all duration-700 rounded-lg p-1.5 ${
              highlightedSection === 'logging' ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'bg-transparent'
            }`}
          >
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-indigo-400" /> Structured Log Correlation
            </h2>
            <p className="text-zinc-355 text-[15px] leading-7 font-sans">
              Forward application logs from inside workers to automatically link trace logs directly with active SRE incident reports in the console. This correlation helps isolate issues instantly:
            </p>

            <PremiumCodeBlock 
              filename="worker.ts" 
              code={logCodeText} 
              section="telemetry"
            >
              <CodeLogger />
            </PremiumCodeBlock>
          </section>

          {/* Section 8: Troubleshooting */}
          <section 
            id="troubleshooting" 
            className={`scroll-mt-20 space-y-4 border-t border-zinc-850 pt-12 transition-all duration-700 rounded-lg p-1.5 ${
              highlightedSection === 'troubleshooting' ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'bg-transparent'
            }`}
          >
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
              Troubleshooting & Support
            </h2>
            <p className="text-zinc-355 text-[15px] leading-7 font-sans">
              If your console dashboard continues to show the onboarding waiting screen, verify the following:
            </p>
            
            <div className="space-y-6 text-zinc-355 font-sans mt-4">
              <div className="space-y-1.5">
                <p className="font-semibold text-zinc-100 text-[15px] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  1. Confirm Port Bindings & Endpoints
                </p>
                <p className="text-zinc-400 leading-relaxed text-[13.5px] pl-3.5">
                  By default, the SDK communicates with the endpoint on <code className="bg-zinc-900 text-zinc-300 border border-zinc-800 px-1 py-0.5 rounded font-mono text-xs">http://localhost:3001</code>. Ensure your API server is actively listening on port <code className="bg-zinc-900 text-zinc-300 border border-zinc-800 px-1 py-0.5 rounded font-mono text-xs">3001</code> and is accessible from your worker nodes.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="font-semibold text-zinc-100 text-[15px] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  2. Verify Project IDs & Secret Tokens
                </p>
                <p className="text-zinc-400 leading-relaxed text-[13.5px] pl-3.5">
                  Double check that the <code className="bg-zinc-900 text-zinc-300 border border-zinc-800 px-1 py-0.5 rounded font-mono text-xs">QUEUEWATCH_API_KEY</code> matches the exact string shown under the <span className="text-zinc-100 font-semibold">SDK Setup & Keys</span> tab inside the Console, and matches the active <code className="bg-zinc-900 text-zinc-300 border border-zinc-800 px-1 py-0.5 rounded font-mono text-xs">QUEUEWATCH_PROJECT_ID</code>.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="font-semibold text-zinc-100 text-[15px] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  3. Check Redis Connection State
                </p>
                <p className="text-zinc-400 leading-relaxed text-[13.5px] pl-3.5">
                  Verify that your local Redis container is up and running. In standard environments, you can verify this by checking if the docker container is active on port <code className="bg-zinc-900 text-zinc-300 border border-zinc-800 px-1 py-0.5 rounded font-mono text-xs">6379</code>.
                </p>
              </div>
            </div>

            <div className="bg-amber-950/15 border border-amber-900/30 rounded-lg p-4 flex items-start gap-3 text-zinc-300 text-[13px] leading-relaxed mt-6">
              <HelpCircle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-100">Connection Verification:</span> Run <code className="bg-zinc-900 text-zinc-300 border border-zinc-800 px-1 py-0.5 rounded font-mono text-xs">curl http://localhost:3001/health</code> from your worker server to verify network connectivity to the QueueWatch event API.
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#121214] bg-zinc-950 py-16 px-6 text-center text-xs text-zinc-550 font-mono relative z-10 w-full mt-24">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-zinc-500 font-mono">
          <div className="flex items-center space-x-2.5">
            <div className="w-4.5 h-4.5 rounded bg-zinc-100 flex items-center justify-center font-bold text-[10px] text-black leading-none shrink-0">
              Q
            </div>
            <span className="font-bold text-zinc-300">QueueWatch</span>
          </div>
          <p className="text-[10px]">&copy; {new Date().getFullYear()} QueueWatch. SRE Operational Reliability Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
