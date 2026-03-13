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
              href="/chat"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              Chat
            </Link>
            <Link
              href="/schema"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              Schema
            </Link>
            <Link
              href="/dictionary"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              Dictionary
            </Link>
            <Link
              href="/terminal"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-tertiary transition-colors"
            >
              Terminal
            </Link>
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
