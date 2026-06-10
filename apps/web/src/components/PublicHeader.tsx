'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Menu, X } from 'lucide-react';

export default function PublicHeader() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="border-b border-zinc-900/80 bg-zinc-950/70 backdrop-blur-md fixed top-0 left-0 right-0 z-50 px-4 md:px-8 lg:px-12 h-14 flex items-center justify-between font-sans">
      <div className="flex items-center space-x-2.5">
        <Link href="/" className="w-5.5 h-5.5 rounded bg-zinc-100 flex items-center justify-center font-bold text-xs text-black shadow-md font-mono shrink-0">
          Q
        </Link>
        <span className="font-mono font-extrabold text-[12px] tracking-wider text-white">QUEUEWATCH</span>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center space-x-6 text-xs font-mono font-semibold text-zinc-400">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
        <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
        <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
        <Link href="/about" className="hover:text-white transition-colors">About</Link>
        <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
      </nav>

      <div className="hidden md:flex items-center space-x-3 font-mono">
        <Link href={isAuthenticated() ? "/dashboard" : "/register"} className="px-4 py-2 rounded border border-zinc-850 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold text-xs transition-all flex items-center space-x-1">
          <span>{isAuthenticated() ? "Console" : "Get Started"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Mobile Hamburger Button */}
      <div className="flex md:hidden items-center space-x-3">
        <Link href={isAuthenticated() ? "/dashboard" : "/register"} className="px-3 py-1.5 rounded border border-zinc-850 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold text-[10px] font-mono transition-all flex items-center space-x-1">
          <span>{isAuthenticated() ? "Console" : "Get Started"}</span>
        </Link>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Slide-over Panel */}
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 top-14 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          />
          {/* Menu Panel */}
          <aside className="fixed top-14 left-0 right-0 z-50 bg-zinc-950 border-b border-zinc-900 p-6 md:hidden animate-slide-down shadow-2xl flex flex-col space-y-4 font-mono text-xs">
            <nav className="flex flex-col space-y-3">
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="py-2 text-zinc-400 hover:text-white border-b border-zinc-900/60 transition-colors"
              >
                Home
              </Link>
              <Link
                href="/pricing"
                onClick={() => setIsOpen(false)}
                className="py-2 text-zinc-400 hover:text-white border-b border-zinc-900/60 transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/docs"
                onClick={() => setIsOpen(false)}
                className="py-2 text-zinc-400 hover:text-white border-b border-zinc-900/60 transition-colors"
              >
                Docs
              </Link>
              <Link
                href="/blog"
                onClick={() => setIsOpen(false)}
                className="py-2 text-zinc-400 hover:text-white border-b border-zinc-900/60 transition-colors"
              >
                Blog
              </Link>
              <Link
                href="/about"
                onClick={() => setIsOpen(false)}
                className="py-2 text-zinc-400 hover:text-white border-b border-zinc-900/60 transition-colors"
              >
                About
              </Link>
              <Link
                href="/contact"
                onClick={() => setIsOpen(false)}
                className="py-2 text-zinc-400 hover:text-white border-b border-zinc-900/60 transition-colors"
              >
                Contact
              </Link>
            </nav>
          </aside>
        </>
      )}
    </header>
  );
}

