'use client';

import Link from 'next/link';

export default function Toolbar() {
  return (
    <header className="bg-surface-elevated border-b border-border px-4 py-2.5 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-accent rounded-none flex items-center justify-center">
              <span className="text-white font-semibold text-xs">B</span>
            </div>
            <span className="text-[15px] font-semibold text-content-primary">BasedHoc</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              Workspace
            </Link>
            <Link
              href="/dashboards"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              Dashboards
            </Link>
            <Link
              href="/growth-actions"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              Growth
            </Link>
            <Link
              href="/finance-actions"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              Finance
            </Link>
            <Link
              href="/product-actions"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              Product
            </Link>
            <Link
              href="/cycles"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              Cycles
            </Link>
            <Link
              href="/monitoring"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              Monitoring
            </Link>
            <Link
              href="/explorer"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              Explorer
            </Link>
            <Link
              href="/about"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              About
            </Link>
            <details className="relative">
              <summary className="list-none cursor-pointer px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors">
                Docs
              </summary>
              <div className="absolute left-0 mt-2 min-w-[220px] border border-border rounded-lg bg-surface-elevated shadow-soft z-20 p-1">
                <Link href="/docs" className="block px-3 py-2 rounded text-sm text-content-secondary hover:bg-surface-tertiary hover:text-content-primary">Overview</Link>
                <Link href="/about" className="block px-3 py-2 rounded text-sm text-content-secondary hover:bg-surface-tertiary hover:text-content-primary">About</Link>
                <Link href="/docs/data-governance" className="block px-3 py-2 rounded text-sm text-content-secondary hover:bg-surface-tertiary hover:text-content-primary">Glossary</Link>
                <Link href="/docs/metrics-layer" className="block px-3 py-2 rounded text-sm text-content-secondary hover:bg-surface-tertiary hover:text-content-primary">Metrics Layer</Link>
                <Link href="/docs/sources-of-truth" className="block px-3 py-2 rounded text-sm text-content-secondary hover:bg-surface-tertiary hover:text-content-primary">Sources of Truth</Link>
              </div>
            </details>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-xs text-content-tertiary">Connected</span>
          </div>
        </div>
      </div>
    </header>
  );
}
