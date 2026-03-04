'use client';

import { useEffect, useState } from 'react';
import { AppShell, Badge, Card, EmptyState, LoadingState, PageHeader } from '@/components/ui';

interface DictionaryPayload {
  success: boolean;
  name?: string;
  markdown?: string;
  detail?: string;
}

export default function DictionaryPage() {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/platform/data-dictionary');
        const payload = (await response.json()) as DictionaryPayload;
        if (!response.ok || !payload.success || !payload.markdown) {
          throw new Error(payload.detail || 'Failed to load data dictionary');
        }
        setMarkdown(payload.markdown);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data dictionary');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <AppShell>
        <LoadingState title="Loading data dictionary" description="Fetching canonical business dictionary." />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <EmptyState title="Dictionary unavailable" description={error} actionLabel="Retry" onAction={() => window.location.reload()} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Data Dictionary"
          subtitle="Canonical definitions for models, grains, and key fields."
          actions={<Badge variant="neutral">Source: DATA_DICTIONARY.md</Badge>}
        />
        <Card variant="elevated" className="p-4">
          <pre className="whitespace-pre-wrap text-sm leading-6 text-content-primary">{markdown}</pre>
        </Card>
      </div>
    </AppShell>
  );
}
