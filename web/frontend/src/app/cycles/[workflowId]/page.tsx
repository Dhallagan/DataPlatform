import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Toolbar from '@/components/Toolbar';
import { getWorkflowById } from '@/lib/workflows';

interface Stage {
  name: string;
  durationSec: number;
  status: 'success' | 'running' | 'queued' | 'failed';
}

function fmt(dateLike: string | Date | null): string {
  if (!dateLike) return 'Never';
  const date = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function fmtRelative(dateLike: string | Date | null): string {
  if (!dateLike) return 'never';
  const date = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  if (Number.isNaN(date.getTime())) return 'invalid date';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const absMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));

  if (absMinutes < 1) return 'now';
  if (absMinutes < 60) return `${absMinutes}m ago`;

  const absHours = Math.floor(absMinutes / 60);
  if (absHours < 24) return `${absHours}h ago`;

  const absDays = Math.floor(absHours / 24);
  return `${absDays}d ago`;
}

function stageStatusColor(status: Stage['status']): string {
  if (status === 'success') return '#16A34A';
  if (status === 'failed') return '#DC2626';
  if (status === 'queued') return '#D97706';
  return '#E8432A';
}

function statusTextClass(status: Stage['status']): string {
  if (status === 'success') return 'text-success';
  if (status === 'failed') return 'text-error';
  if (status === 'queued') return 'text-warning';
  return 'text-accent';
}

function buildStages(workflowId: string): Stage[] {
  const base = [
    { name: 'Ingest signals', durationSec: 8, status: 'success' as const },
    { name: 'Load context', durationSec: 12, status: 'success' as const },
    { name: 'Plan actions', durationSec: 16, status: 'success' as const },
    { name: 'Execute tools', durationSec: 22, status: 'running' as const },
    { name: 'Write run log', durationSec: 4, status: 'queued' as const },
  ];

  if (workflowId.includes('finance')) {
    return [
      { name: 'Ingest signals', durationSec: 10, status: 'success' },
      { name: 'Load context', durationSec: 15, status: 'success' },
      { name: 'Plan actions', durationSec: 19, status: 'success' },
      { name: 'Execute tools', durationSec: 27, status: 'success' },
      { name: 'Write run log', durationSec: 6, status: 'success' },
    ];
  }

  return base;
}

async function loadCode(codePath: string): Promise<string> {
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const targetPath = path.resolve(repoRoot, codePath);

  if (!targetPath.startsWith(repoRoot)) {
    return 'Blocked: invalid code path.';
  }

  try {
    return await fs.readFile(targetPath, 'utf-8');
  } catch (error) {
    return `Failed to load ${codePath}: ${error instanceof Error ? error.message : 'unknown error'}`;
  }
}

export default async function WorkflowDetailPage({
  params,
}: {
  params: { workflowId: string };
}) {
  const workflow = getWorkflowById(params.workflowId);
  if (!workflow) notFound();

  const code = await loadCode(workflow.code_path);
  const stages = buildStages(workflow.id);
  const totalDuration = stages.reduce((sum, stage) => sum + stage.durationSec, 0);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Toolbar />

      <main className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
        <section className="bg-surface-elevated border border-border rounded-lg p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-content-tertiary">Cycles run summary</p>
              <h1 className="text-2xl font-semibold text-content-primary mt-1">{workflow.name}</h1>
              <p className="text-sm text-content-tertiary mt-1">{workflow.description}</p>
            </div>
            <Link href="/cycles" className="text-sm px-3 py-1.5 rounded-lg bg-surface-tertiary text-content-secondary hover:text-content-primary">
              Back to all runs
            </Link>
          </div>
        </section>

        <section className="bg-surface-elevated border border-border rounded-lg p-4 grid grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
          <div className="rounded border border-border bg-surface-primary px-3 py-2">
            <p className="text-content-tertiary">Owner</p>
            <p className="text-content-primary font-medium mt-1">{workflow.owner}</p>
          </div>
          <div className="rounded border border-border bg-surface-primary px-3 py-2">
            <p className="text-content-tertiary">Status</p>
            <p className="text-success font-medium mt-1">Success</p>
          </div>
          <div className="rounded border border-border bg-surface-primary px-3 py-2">
            <p className="text-content-tertiary">Last run</p>
            <p className="text-content-primary font-medium mt-1">{fmt(workflow.last_run_at)}</p>
          </div>
          <div className="rounded border border-border bg-surface-primary px-3 py-2">
            <p className="text-content-tertiary">Relative</p>
            <p className="text-content-primary font-medium mt-1">{fmtRelative(workflow.last_run_at)}</p>
          </div>
          <div className="rounded border border-border bg-surface-primary px-3 py-2">
            <p className="text-content-tertiary">Total duration</p>
            <p className="text-content-primary font-medium mt-1">{totalDuration}s</p>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4">
          <aside className="bg-surface-elevated border border-border rounded-lg overflow-hidden h-fit">
            <div className="px-4 py-3 bg-surface-tertiary border-b border-border">
              <p className="text-sm font-semibold text-content-primary">All jobs</p>
            </div>
            <div className="p-3 space-y-2">
              {stages.map((stage) => (
                <div key={stage.name} className="rounded border border-border bg-surface-primary px-3 py-2">
                  <p className={`text-sm font-medium ${statusTextClass(stage.status)}`}>{stage.name}</p>
                  <p className="text-xs text-content-tertiary mt-1">{stage.durationSec}s</p>
                </div>
              ))}
            </div>
          </aside>

          <section className="space-y-4">
            <div className="bg-surface-elevated border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface-tertiary">
                <p className="font-semibold text-content-primary">Execution Graph</p>
              </div>
              <div className="p-4">
                <svg viewBox="0 0 760 180" className="w-full h-[220px]">
                  {stages.map((stage, index) => {
                    const x = 60 + index * 145;
                    const y = 80;
                    return (
                      <g key={stage.name}>
                        {index < stages.length - 1 && (
                          <line x1={x + 40} y1={y} x2={x + 105} y2={y} stroke="#9CA3AF" strokeWidth="2" />
                        )}
                        <circle cx={x} cy={y} r="14" fill={stageStatusColor(stage.status)} />
                        <text x={x} y={y + 34} textAnchor="middle" fontSize="11" fill="#4B5563">{stage.durationSec}s</text>
                        <text x={x} y={y - 26} textAnchor="middle" fontSize="11" fill="#111827">{stage.name}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <div className="bg-surface-elevated border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface-tertiary flex items-center justify-between">
                <p className="font-semibold text-content-primary">Workflow Code</p>
                <span className="text-xs text-content-tertiary">{workflow.code_path}</span>
              </div>
              <pre className="m-0 p-4 overflow-x-auto text-sm leading-6 bg-content-primary text-surface-primary">
                <code>{code}</code>
              </pre>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
