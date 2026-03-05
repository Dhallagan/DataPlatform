import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Toolbar from '@/components/Toolbar';

async function loadArchitectureEssay(): Promise<string> {
  const filePath = path.join(process.cwd(), 'docs', 'architecture-decisions.md');
  return readFile(filePath, 'utf-8');
}

export default async function AboutPage() {
  const markdown = await loadArchitectureEssay();

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Toolbar />

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 lg:px-6">
        <section className="rounded-lg border border-border bg-surface-elevated p-6">
          <p className="text-xs uppercase tracking-wide text-content-tertiary">About</p>
          <h1 className="mt-1 text-2xl font-semibold text-content-primary">Architecture Decisions</h1>
          <p className="mt-2 text-sm text-content-secondary">
            Why the BrowserBase analytics platform is structured the way it is, including tradeoffs and operating practices.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/terminal" className="rounded bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent-hover">
              Open Terminal
            </Link>
            <Link href="/chat" className="rounded bg-surface-tertiary px-3 py-1.5 text-xs text-content-primary hover:bg-surface-primary">
              Open Chat
            </Link>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface-elevated p-6">
          <article className="prose prose-slate max-w-none text-sm prose-headings:text-content-primary prose-p:text-content-secondary prose-li:text-content-secondary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </article>
        </section>
      </main>
    </div>
  );
}
