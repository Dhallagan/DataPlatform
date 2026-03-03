'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Toolbar from '@/components/Toolbar';
import { WORKFLOWS, WorkflowDefinition } from '@/lib/workflows';

type IntervalLabel = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'event';
type RunStatus = 'success' | 'in_progress' | 'queued' | 'failed';

interface WorkflowRunRow {
  runId: string;
  workflowId: string;
  workflowName: string;
  owner: string;
  interval: IntervalLabel;
  event: string;
  status: RunStatus;
  branch: string;
  actor: string;
  startedAt: string;
}

function inferInterval(workflow: WorkflowDefinition): IntervalLabel {
  if (workflow.trigger.type === 'event') return 'event';

  const parts = workflow.trigger.schedule.trim().split(/\s+/);
  if (parts.length !== 5) return 'custom';
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const isDaily = dayOfMonth === '*' && month === '*' && dayOfWeek === '*';
  if (isDaily && minute !== '*' && hour !== '*') return 'daily';

  const isWeekly = dayOfMonth === '*' && month === '*' && dayOfWeek !== '*';
  if (isWeekly && minute !== '*' && hour !== '*') return 'weekly';

  const isMonthly = dayOfMonth !== '*' && month === '*' && dayOfWeek === '*';
  if (isMonthly && minute !== '*' && hour !== '*') return 'monthly';

  const isYearly = dayOfMonth !== '*' && month !== '*' && dayOfWeek === '*';
  if (isYearly && minute !== '*' && hour !== '*') return 'yearly';

  return 'custom';
}

function fmt(dateLike: string | Date | null): string {
  if (!dateLike) return 'Never';
  const date = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
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
  if (absMinutes < 60) return `${absMinutes}m`;

  const absHours = Math.floor(absMinutes / 60);
  if (absHours < 24) return `${absHours}h`;

  const absDays = Math.floor(absHours / 24);
  return `${absDays}d`;
}

function statusClass(status: RunStatus): string {
  if (status === 'success') return 'text-success';
  if (status === 'failed') return 'text-error';
  if (status === 'queued') return 'text-warning';
  return 'text-accent';
}

function runEvent(workflow: WorkflowDefinition): string {
  if (workflow.trigger.type === 'event') return workflow.trigger.event;
  return workflow.trigger.schedule;
}

function buildRunRows(workflows: WorkflowDefinition[]): WorkflowRunRow[] {
  const statuses: RunStatus[] = ['success', 'in_progress', 'queued', 'success'];

  return workflows.flatMap((workflow, index) => {
    const base = workflow.last_run_at ? new Date(workflow.last_run_at) : new Date();

    return statuses.map((status, i) => {
      const startedAt = new Date(base);
      startedAt.setMinutes(startedAt.getMinutes() - (index * 11 + i * 17));

      return {
        runId: `${workflow.id}-${i + 1}`,
        workflowId: workflow.id,
        workflowName: workflow.name,
        owner: workflow.owner,
        interval: inferInterval(workflow),
        event: runEvent(workflow),
        status,
        branch: i % 2 === 0 ? 'main' : 'feature/cycles-ui',
        actor: i % 2 === 0 ? 'cycles-bot' : 'dylan',
        startedAt: startedAt.toISOString(),
      };
    });
  }).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export default function CyclesPage() {
  const [intervalFilter, setIntervalFilter] = useState<IntervalLabel | 'all'>('all');
  const [query, setQuery] = useState('');

  const workflowList = useMemo(() => {
    return WORKFLOWS.map((workflow) => ({ workflow, interval: inferInterval(workflow) })).filter((item) => {
      const matchesInterval = intervalFilter === 'all' ? true : item.interval === intervalFilter;
      const q = query.trim().toLowerCase();
      const matchesQuery = q.length === 0
        ? true
        : item.workflow.name.toLowerCase().includes(q) || item.workflow.owner.toLowerCase().includes(q);
      return matchesInterval && matchesQuery;
    });
  }, [intervalFilter, query]);

  const runRows = useMemo(() => buildRunRows(workflowList.map((item) => item.workflow)), [workflowList]);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Toolbar />

      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4">
          <aside className="bg-surface-elevated border border-border rounded-lg overflow-hidden h-fit">
            <div className="px-4 py-3 border-b border-border bg-surface-tertiary">
              <p className="text-sm font-semibold text-content-primary">Cycles</p>
              <p className="text-xs text-content-tertiary mt-1">All workflows</p>
            </div>

            <div className="p-3 border-b border-border">
              <p className="text-xs uppercase tracking-wide text-content-tertiary mb-2">Filter interval</p>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'daily', 'weekly', 'monthly', 'yearly', 'custom', 'event'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setIntervalFilter(option)}
                    className={`px-2 py-1 rounded text-xs uppercase tracking-wide border transition-colors ${
                      intervalFilter === option
                        ? 'bg-accent-muted text-content-primary border-accent'
                        : 'bg-surface-primary text-content-secondary border-border hover:bg-surface-tertiary'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[600px] overflow-auto">
              {workflowList.map(({ workflow, interval }) => (
                <Link
                  key={workflow.id}
                  href={`/cycles/${workflow.id}`}
                  className="block px-4 py-3 border-b border-border hover:bg-surface-tertiary transition-colors"
                >
                  <p className="text-sm font-medium text-content-primary truncate">{workflow.name}</p>
                  <p className="text-xs text-content-tertiary mt-1">{workflow.owner} • {interval}</p>
                </Link>
              ))}
            </div>
          </aside>

          <section className="bg-surface-elevated border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-tertiary flex items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-content-primary">All workflow runs</h1>
                <p className="text-xs text-content-tertiary mt-1">GitHub Actions-style run feed for Cycles</p>
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter workflow runs"
                className="w-full max-w-sm border border-border rounded-lg bg-surface-primary text-sm px-3 py-2 text-content-primary"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-surface-primary border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-content-secondary">Workflow</th>
                    <th className="text-left px-4 py-3 font-semibold text-content-secondary">Owner</th>
                    <th className="text-left px-4 py-3 font-semibold text-content-secondary">Event</th>
                    <th className="text-left px-4 py-3 font-semibold text-content-secondary">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-content-secondary">Branch</th>
                    <th className="text-left px-4 py-3 font-semibold text-content-secondary">Actor</th>
                    <th className="text-left px-4 py-3 font-semibold text-content-secondary">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runRows.map((run) => (
                    <tr key={run.runId} className="border-b border-border hover:bg-surface-tertiary">
                      <td className="px-4 py-3">
                        <Link href={`/cycles/${run.workflowId}`} className="font-medium text-content-primary hover:text-accent">
                          {run.workflowName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-content-secondary">{run.owner}</td>
                      <td className="px-4 py-3 text-content-secondary">{run.event}</td>
                      <td className={`px-4 py-3 capitalize ${statusClass(run.status)}`}>{run.status.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-content-secondary">{run.branch}</td>
                      <td className="px-4 py-3 text-content-secondary">{run.actor}</td>
                      <td className="px-4 py-3 text-content-secondary whitespace-nowrap">
                        {fmt(run.startedAt)}
                        <span className="text-content-tertiary"> • {fmtRelative(run.startedAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
