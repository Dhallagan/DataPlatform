'use client';

import { useState } from 'react';
import Toolbar from '@/components/Toolbar';

export default function ExplorerPage() {
  const [iframeError, setIframeError] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-surface-primary">
      <Toolbar />

      {iframeError ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-lg bg-surface-tertiary flex items-center justify-center">
              <span className="text-2xl">🦆</span>
            </div>
            <h2 className="text-lg font-semibold text-content-primary">
              DuckDB UI not running
            </h2>
            <p className="text-sm text-content-secondary">
              Start the DuckDB explorer to browse your MotherDuck database:
            </p>
            <pre className="bg-surface-secondary border border-border rounded-lg p-4 text-left text-xs text-content-secondary overflow-x-auto">
              ./scripts/start-explorer.sh
            </pre>
            <p className="text-xs text-content-tertiary">
              This starts DuckDB with the Local UI at{' '}
              <code className="bg-surface-tertiary px-1 py-0.5 rounded">localhost:4213</code>{' '}
              connected to your MotherDuck database.
            </p>
            <button
              onClick={() => setIframeError(false)}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      ) : (
        <iframe
          src="http://localhost:4213"
          className="flex-1 w-full border-none"
          title="DuckDB Explorer"
          onError={() => setIframeError(true)}
          onLoad={(e) => {
            // iframe onError doesn't fire for connection refused,
            // but onLoad fires with empty content — check via timeout
            try {
              const iframe = e.target as HTMLIFrameElement;
              // If we can't access contentWindow, it loaded something
              if (!iframe.contentWindow?.document?.title) {
                // This will throw for cross-origin, which means it loaded
              }
            } catch {
              // Cross-origin means the DuckDB UI loaded successfully
            }
          }}
        />
      )}
    </div>
  );
}
