import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, Tag, Terminal } from 'lucide-react';
import { blogPosts } from '../../../lib/blog';
import PublicHeader from '../../../components/PublicHeader';
import BlogCTA from '../../../components/BlogCTA';
import CopyButton from '../../../components/CopyButton';

interface ArticlePageProps {
  params: {
    slug: string;
  };
}

export default function ArticlePage({ params }: ArticlePageProps) {
  const post = blogPosts.find((p) => p.slug === params.slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="bg-zinc-950 text-zinc-200 min-h-screen relative overflow-x-hidden w-full font-sans antialiased">
      {/* Background SRE Grids - subtle fade top */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f11_1px,transparent_1px),linear-gradient(to_bottom,#0f0f11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_50%_30%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header */}
      <PublicHeader />

      {/* Main Container */}
      <main className="relative max-w-3xl mx-auto px-6 pt-32 pb-24 space-y-12">
        {/* Back Link */}
        <Link 
          href="/blog" 
          className="inline-flex items-center space-x-2 text-xs font-mono font-semibold text-zinc-500 hover:text-zinc-350 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
          <span>Back to Blog</span>
        </Link>

        {/* Article Meta */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3 text-xs font-mono text-zinc-500">
            <span className="flex items-center space-x-1">
              <Tag className="w-3 h-3 text-indigo-400" />
              <span className="text-zinc-350 font-semibold">{post.tag}</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{post.readTime}</span>
            </span>
            <span>•</span>
            <span>{post.date}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
            {post.title}
          </h1>
        </div>

        {/* Intro */}
        <div className="text-zinc-300 text-base sm:text-[17px] leading-relaxed font-sans border-l-2 border-indigo-500/80 pl-4 py-1 italic bg-indigo-950/5 rounded-r">
          {post.intro}
        </div>

        {/* Sections */}
        <div className="space-y-10 text-zinc-300 text-sm sm:text-base leading-relaxed font-sans">
          {post.sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight pt-4">
                {section.title}
              </h2>
              {section.paragraphs.map((para, pIdx) => (
                <p key={pIdx} className="text-zinc-450 leading-relaxed font-sans">
                  {para}
                </p>
              ))}

              {section.code && (
                <div className="bg-[#0b0b0d] border border-zinc-900 rounded-lg overflow-hidden my-6 shadow-xl transition-colors hover:border-zinc-800">
                  <div className="flex items-center justify-between px-4 py-2 bg-[#09090b] border-b border-zinc-900">
                    <div className="flex items-center space-x-2">
                      <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-[11px] font-mono text-zinc-400 font-medium">
                        {section.codeFilename || 'script.ts'}
                      </span>
                    </div>
                    <CopyButton text={section.code} />
                  </div>
                  <pre className="p-4 overflow-x-auto text-[13px] font-mono text-zinc-350 bg-[#070708] leading-relaxed scrollbar-thin select-all">
                    <code>{section.code}</code>
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Conclusion */}
        <div className="pt-8 border-t border-zinc-900 space-y-4">
          <h3 className="text-lg font-bold text-white font-mono">Conclusion</h3>
          <p className="text-zinc-450 text-sm sm:text-base leading-relaxed font-sans">
            {post.conclusion}
          </p>
        </div>

        {/* Action / Final CTA */}
        <BlogCTA />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-955 py-12 px-4 md:px-8 text-center text-xs text-zinc-550 font-mono">
        <p>&copy; {new Date().getFullYear()} QueueWatch. Operational Reliability Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}

// Next.js static generation parameters
export function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}
