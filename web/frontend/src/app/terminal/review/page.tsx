'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Drawer, EmptyState, LoadingState } from '@/components/ui';
import TerminalShell from '@/components/terminal/TerminalShell';
import { num, runWarehouseQuerySafe, usd } from '@/lib/warehouse';

interface TaskRow {
  task_id: string;
  organization_id: string;
  organization_name: string;
  signal_score: number;
  priority: string;
  reason_code: string;
  due_at: string;
}

interface ActionRow {
  action_type: string;
  status: string;
  action_count_7d: number;
}

interface PipelineSnapshot {
  open_pipeline_usd: number;
}

type PriorityFilter = 'all' | 'urgent' | 'high' | 'normal';
type OwnerFilter = 'all' | 'unassigned' | string;
type TaskStatus = 'researching' | 'draft_ready' | 'needs_approval' | 'edited' | 'blocked';
type TaskType = 'draft outbound email' | 'follow-up reminder' | 'expansion opportunity' | 'deal risk alert';

interface AgentTask {
  taskId: string;
  organizationId: string;
  organizationName: string;
  owner: string | null;
  reviewer: string | null;
  contactName: string;
  contactRole: string;
  taskType: TaskType;
  priority: 'urgent' | 'high' | 'normal';
  status: TaskStatus;
  relationship: string;
  suggestedAngle: string;
  autoSendLabel: string;
  dueLabel: string;
  signalScore: number;
  subject: string;
  body: string;
  followUp: string;
  reasoning: string[];
  evidence: { label: string; detail: string }[];
  memoryUpdate: string;
  riskFlags: string[];
  ifApproved: string[];
  confidenceLabel: string;
  confidenceReason: string;
  runMetadata: {
    durationLabel: string;
    toolsUsed: string;
    triggeredBy: string;
  };
  traceId: string;
}

interface TeamSummary {
  key: string;
  label: string;
  queueCount: number;
}

interface WorkflowSection {
  key: string;
  title: string;
  summary: string;
  detail: string[];
  tone?: 'default' | 'blocked';
}

interface WorkflowRow {
  key: string;
  label: string;
  detail: string;
  state: 'done' | 'current' | 'upcoming' | 'blocked';
}

const OWNER_POOL = ['Avery', 'Mika', 'Jordan', 'Priya', 'Noah'];
const CONTACT_FIRST_NAMES = ['Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Alex'];
const CONTACT_LAST_NAMES = ['Kim', 'Patel', 'Lopez', 'Nguyen', 'Park', 'Cole'];
const CONTACT_ROLES = ['VP Growth', 'Head of AI', 'RevOps Lead', 'Product Lead', 'CTO', 'Developer Relations'];
const RELATIONSHIP_POOL = ['warm prospect', 'existing customer', 'new inbound', 'expansion target'];
const TASK_TYPE_POOL: TaskType[] = ['draft outbound email', 'follow-up reminder', 'expansion opportunity', 'deal risk alert'];
const MEMORY_POOL = [
  'Agent learned: keep openings concise and skip generic positioning.',
  'Memory updated: lead with implementation help before product claims.',
  'Memory updated: prefer short subject lines and one clear CTA.',
  'Agent learned: expansion accounts should reference current usage first.',
];

function normalizePriority(priority: string): 'urgent' | 'high' | 'normal' {
  const normalized = String(priority || '').toLowerCase();
  if (normalized === 'urgent') return 'urgent';
  if (normalized === 'high') return 'high';
  return 'normal';
}

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickFromPool(pool: string[], index: number, fallback: string): string {
  const item = pool[index % pool.length];
  return typeof item === 'string' && item.length > 0 ? item : fallback;
}

function prettyReasonCode(reasonCode: string): string {
  if (!reasonCode) return 'Unknown trigger';
  return reasonCode
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function priorityVariant(priority: 'urgent' | 'high' | 'normal'): 'error' | 'warning' | 'neutral' {
  if (priority === 'urgent') return 'error';
  if (priority === 'high') return 'warning';
  return 'neutral';
}

function statusVariant(status: TaskStatus): 'warning' | 'success' | 'error' | 'neutral' {
  if (status === 'needs_approval') return 'warning';
  if (status === 'draft_ready' || status === 'edited') return 'success';
  if (status === 'blocked') return 'error';
  return 'neutral';
}

function queueStatusLabel(task: AgentTask): string {
  if (task.status === 'blocked') return 'Blocked before send';
  if (task.status === 'edited') return 'Edited draft awaiting review';
  if (task.status === 'researching') return 'Research in progress';
  if (task.status === 'draft_ready') return 'Draft ready for review';
  return 'Awaiting review';
}

function formatRelativeHours(value: string): { dueLabel: string; autoSendLabel: string } {
  if (!value) return { dueLabel: 'No SLA', autoSendLabel: 'Auto-send disabled' };
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return { dueLabel: 'No SLA', autoSendLabel: 'Auto-send disabled' };
  const deltaHours = Math.round((due.getTime() - Date.now()) / (1000 * 60 * 60));
  if (deltaHours < 0) return { dueLabel: `Overdue ${Math.abs(deltaHours)}h`, autoSendLabel: 'Past auto-send window' };
  if (deltaHours < 24) return { dueLabel: `${deltaHours}h left`, autoSendLabel: `Auto-send in ${deltaHours}h` };
  return { dueLabel: `${Math.round(deltaHours / 24)}d left`, autoSendLabel: `Auto-send in ${deltaHours}h` };
}

function chooseStatus(row: TaskRow, priority: 'urgent' | 'high' | 'normal', hash: number): TaskStatus {
  const normalizedReason = String(row.reason_code || '').toLowerCase();
  if (normalizedReason.includes('support') || normalizedReason.includes('ticket')) return 'blocked';
  if (hash % 7 === 0) return 'edited';
  if (row.signal_score >= 0.72 || priority === 'urgent') return 'needs_approval';
  if (hash % 5 === 0) return 'researching';
  return 'draft_ready';
}

function chooseAngle(reason: string, relationship: string): string {
  const normalized = reason.toLowerCase();
  if (normalized.includes('trial') || normalized.includes('usage')) return 'Offer implementation help';
  if (normalized.includes('pricing')) return 'Acknowledge buying intent and propose a short working session';
  if (relationship === 'existing customer') return 'Frame as expansion, not net-new outbound';
  if (relationship === 'warm prospect') return 'Reference prior context and suggest the next concrete step';
  return 'Keep it brief and research-backed';
}

function buildAgentTask(row: TaskRow, index: number): AgentTask {
  const hash = hashString(`${row.task_id}-${row.organization_id}-${row.organization_name}`);
  const priority = normalizePriority(row.priority);
  const reviewer = hash % 6 === 0 ? null : OWNER_POOL[hash % OWNER_POOL.length];
  const relationship = pickFromPool(RELATIONSHIP_POOL, hash, 'new inbound');
  const contactName = `${pickFromPool(CONTACT_FIRST_NAMES, hash, 'Alex')} ${pickFromPool(CONTACT_LAST_NAMES, hash >> 3, 'Kim')}`;
  const contactRole = pickFromPool(CONTACT_ROLES, hash >> 5, 'RevOps Lead');
  const taskType = TASK_TYPE_POOL[hash % TASK_TYPE_POOL.length];
  const reason = prettyReasonCode(row.reason_code);
  const status = chooseStatus(row, priority, hash);
  const timing = formatRelativeHours(row.due_at);
  const orgName = row.organization_name || 'Unknown account';
  const firstName = contactName.split(' ')[0];
  const confidenceScore = Math.round(row.signal_score * 100);
  const confidenceLabel = confidenceScore >= 85 ? 'High' : confidenceScore >= 70 ? 'Medium' : 'Low';

  return {
    taskId: row.task_id || `task-${index + 1}`,
    organizationId: row.organization_id,
    organizationName: orgName,
    owner: reviewer,
    reviewer,
    contactName,
    contactRole,
    taskType,
    priority,
    status,
    relationship,
    suggestedAngle: chooseAngle(reason, relationship),
    autoSendLabel: timing.autoSendLabel,
    dueLabel: timing.dueLabel,
    signalScore: row.signal_score,
    subject:
      relationship === 'existing customer'
        ? `${orgName}: follow-up on active usage and expansion`
        : `${orgName}: quick question on your browser automation workflow`,
    body: `Hi ${firstName},\n\nI noticed ${orgName} has been showing strong intent recently, and ${reason.toLowerCase()} looked like the clearest reason to reach out now.\n\nTeams in a similar spot usually need help moving from a promising trial or prototype into a reliable production workflow. If useful, I can share a few implementation patterns we have seen work well.\n\nWould a short 15 minute call next week be useful?\n`,
    followUp: 'Suggested follow-up: enroll in a 2-step sequence if no response after 4 business days.',
    reasoning: [
      `${reason} is the primary trigger for the run.`,
      `${relationship} changed the messaging angle, so the draft avoids generic cold outreach language.`,
      status === 'blocked' ? 'The run paused because the account needs manual judgment before any send.' : `${timing.autoSendLabel}. Human review is required before execution.`,
    ],
    evidence: [
      { label: 'Salesforce', detail: `${orgName} is tagged as ${relationship} and mapped to ${contactName}.` },
      { label: 'Gong', detail: `No recent call in the last ${(hash % 4) + 2} weeks. No overlapping follow-up found.` },
      { label: 'LinkedIn / Web', detail: `${contactName} is listed as ${contactRole}. The account is actively evaluating AI workflow tooling.` },
      { label: 'Product / Intent', detail: `${reason}. Pricing or trial activity suggests near-term interest.` },
    ],
    memoryUpdate: pickFromPool(MEMORY_POOL, hash >> 2, 'Memory updated: prefer concise drafts with one clear CTA.'),
    riskFlags: status === 'blocked' ? ['Conflict check required', 'Manual review before send'] : [],
    ifApproved:
      status === 'blocked'
        ? ['No email is sent until the blocker is cleared.']
        : ['Email sends immediately.', 'A 2-step follow-up sequence is scheduled.', 'Outcome tracking starts after send.'],
    confidenceLabel,
    confidenceReason:
      relationship === 'existing customer'
        ? 'Existing relationship plus expansion or retention signal.'
        : 'Strong intent signal with no recent overlapping outreach.',
    runMetadata: {
      durationLabel: `${((hash % 70) + 18) / 10}s`,
      toolsUsed: taskType === 'follow-up reminder' ? 'Salesforce, Gong' : 'Salesforce, Gong, Exa',
      triggeredBy: reason,
    },
    traceId: `trace_${row.task_id || index + 1}`,
  };
}

function workflowRowsForTask(task: AgentTask): WorkflowRow[] {
  if (task.status === 'blocked') {
    return [
      { key: 'signal', label: 'Signal detected', detail: task.runMetadata.triggeredBy, state: 'done' },
      { key: 'checks', label: 'Safety checks', detail: task.riskFlags[0] || 'Blocked', state: 'blocked' },
      { key: 'research', label: 'Research complete', detail: 'Waiting', state: 'upcoming' },
      { key: 'draft', label: 'Draft ready', detail: 'Waiting', state: 'upcoming' },
      { key: 'send', label: 'Send email', detail: 'Waiting', state: 'upcoming' },
    ];
  }

  if (task.status === 'researching') {
    return [
      { key: 'signal', label: 'Signal detected', detail: task.runMetadata.triggeredBy, state: 'done' },
      { key: 'checks', label: 'Safety checks passed', detail: 'No recent outreach found', state: 'done' },
      { key: 'research', label: 'Research complete', detail: task.runMetadata.toolsUsed, state: 'current' },
      { key: 'draft', label: 'Draft ready', detail: 'Generating', state: 'upcoming' },
      { key: 'send', label: 'Send email', detail: 'Waiting for review', state: 'upcoming' },
    ];
  }

  return [
    { key: 'signal', label: 'Signal detected', detail: task.runMetadata.triggeredBy, state: 'done' },
    { key: 'checks', label: 'Safety checks passed', detail: 'No recent outreach found', state: 'done' },
    { key: 'research', label: 'Research complete', detail: task.runMetadata.toolsUsed, state: 'done' },
    { key: 'draft', label: 'Draft ready', detail: queueStatusLabel(task), state: 'current' },
    { key: 'send', label: 'Send email', detail: task.autoSendLabel, state: 'upcoming' },
  ];
}

function workflowSectionsForTask(task: AgentTask): WorkflowSection[] {
  return [
    {
      key: 'research',
      title: 'Research details',
      summary: `${task.relationship} context and rationale`,
      detail: [...task.reasoning, ...task.evidence.map((entry) => `${entry.label}: ${entry.detail}`)],
    },
    {
      key: 'memory',
      title: 'Memory applied',
      summary: task.memoryUpdate,
      detail: [task.memoryUpdate],
    },
    {
      key: 'audit',
      title: 'Run audit',
      summary: `${task.traceId} • ${task.runMetadata.durationLabel} • ${task.runMetadata.toolsUsed}`,
      detail: [
        `Confidence: ${task.confidenceLabel} (${Math.round(task.signalScore * 100)})`,
        task.confidenceReason,
        `Reviewer: ${task.reviewer ?? 'Unassigned'}`,
        `Auto-send: ${task.autoSendLabel}`,
      ],
      tone: task.status === 'blocked' ? 'blocked' : 'default',
    },
  ];
}

function workflowRowTone(state: WorkflowRow['state']): string {
  if (state === 'done') return 'border-green-600/25 bg-green-600/8 text-green-700';
  if (state === 'current') return 'border-accent-active bg-surface-primary text-content-primary';
  if (state === 'blocked') return 'border-red-500/25 bg-red-500/8 text-red-600';
  return 'border-border bg-surface-primary text-content-tertiary';
}

function WorkflowSectionCard({ section }: { section: WorkflowSection }) {
  return (
    <details className={`rounded-xl border p-3 ${section.tone === 'blocked' ? 'border-red-500/20 bg-red-500/5' : 'border-border bg-surface-primary'}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-content-primary">{section.title}</p>
          <p className="mt-1 text-xs text-content-tertiary">{section.summary}</p>
        </div>
        <Badge variant={section.tone === 'blocked' ? 'error' : 'neutral'}>{section.tone === 'blocked' ? 'BLOCKED' : 'DETAILS'}</Badge>
      </summary>
      <div className="mt-3 space-y-2">
        {section.detail.map((item) => (
          <div key={item} className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-content-primary">
            {item}
          </div>
        ))}
      </div>
    </details>
  );
}

function metricValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : 'No data';
}

export default function LeadReviewTerminalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [taskRows, actionRows, pipelineRows] = await Promise.all([
          runWarehouseQuerySafe(`
            SELECT task_id, organization_id, organization_name, signal_score, priority, reason_code, due_at
            FROM gtm.growth_task_queue
            ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, signal_score DESC, due_at ASC
            LIMIT 120
          `),
          runWarehouseQuerySafe(`
            SELECT action_type, status, COUNT(*) AS action_count_7d
            FROM gtm.action_log
            WHERE executed_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
            GROUP BY 1, 2
            ORDER BY action_count_7d DESC
            LIMIT 25
          `),
          runWarehouseQuerySafe(`
            SELECT open_pipeline_usd
            FROM gtm.snap_pipeline_daily
            ORDER BY as_of_date DESC
            LIMIT 1
          `),
        ]);

        setTasks(
          taskRows.map((row) => ({
            task_id: String(row.task_id ?? ''),
            organization_id: String(row.organization_id ?? ''),
            organization_name: String(row.organization_name ?? ''),
            signal_score: num(row.signal_score),
            priority: String(row.priority ?? ''),
            reason_code: String(row.reason_code ?? ''),
            due_at: String(row.due_at ?? ''),
          })),
        );

        setActions(
          actionRows.map((row) => ({
            action_type: String(row.action_type ?? ''),
            status: String(row.status ?? ''),
            action_count_7d: num(row.action_count_7d),
          })),
        );

        const latestPipeline = pipelineRows[0];
        setPipeline(latestPipeline ? { open_pipeline_usd: num(latestPipeline.open_pipeline_usd) } : null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to load leads terminal');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const agentTasks = useMemo(() => tasks.map((row, index) => buildAgentTask(row, index)), [tasks]);

  const filteredTasks = useMemo(() => {
    return agentTasks.filter((item) => {
      const priorityMatches = priorityFilter === 'all' || item.priority === priorityFilter;
      const ownerMatches = ownerFilter === 'all' || (ownerFilter === 'unassigned' ? item.owner == null : item.owner === ownerFilter);
      return priorityMatches && ownerMatches;
    });
  }, [agentTasks, ownerFilter, priorityFilter]);

  useEffect(() => {
    if (filteredTasks.length === 0) {
      setSelectedTaskId(null);
      return;
    }
    if (!selectedTaskId || !filteredTasks.some((task) => task.taskId === selectedTaskId)) {
      setSelectedTaskId(filteredTasks[0].taskId);
    }
  }, [filteredTasks, selectedTaskId]);

  const selectedTask = filteredTasks.find((task) => task.taskId === selectedTaskId) ?? filteredTasks[0] ?? null;
  const workflowRows = useMemo(() => (selectedTask ? workflowRowsForTask(selectedTask) : []), [selectedTask]);
  const workflowSections = useMemo(() => (selectedTask ? workflowSectionsForTask(selectedTask) : []), [selectedTask]);
  const blockedCount = useMemo(() => agentTasks.filter((task) => task.status === 'blocked').length, [agentTasks]);
  const needsApprovalCount = useMemo(() => agentTasks.filter((task) => task.status === 'needs_approval').length, [agentTasks]);
  const teamSummaries = useMemo<TeamSummary[]>(() => {
    const summaries: TeamSummary[] = [
      { key: 'all', label: 'All', queueCount: agentTasks.length },
      { key: 'unassigned', label: 'Unassigned', queueCount: agentTasks.filter((task) => task.owner == null).length },
    ];

    OWNER_POOL.forEach((owner) => {
      summaries.push({
        key: owner,
        label: owner,
        queueCount: agentTasks.filter((task) => task.owner === owner).length,
      });
    });

    return summaries;
  }, [agentTasks]);

  useEffect(() => {
    if (!selectedTask) return;
    setDraftSubject(selectedTask.subject);
    setDraftBody(selectedTask.body);
    setIsEditingDraft(false);
    setIsDetailsOpen(false);
  }, [selectedTask]);

  if (loading) {
    return (
      <TerminalShell active="review" title="Leads Terminal" subtitle="Workflow inbox and approval console for GTM agent runs.">
        <LoadingState title="Loading leads terminal" description="Pulling workflow runs and action history." />
      </TerminalShell>
    );
  }

  if (error) {
    return (
      <TerminalShell active="review" title="Leads Terminal" subtitle="Workflow inbox and approval console for GTM agent runs.">
        <EmptyState title="Leads terminal unavailable" description={error} actionLabel="Retry" onAction={() => window.location.reload()} />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell active="review" title="Leads Terminal" subtitle="Workflow inbox and approval console for GTM agent runs.">
      <div className="space-y-4">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-amber-700">
            Under Construction · LEADS is still in active development
          </p>
          <p className="mt-1 text-sm text-amber-900/80">
            Workflow states, actions, and routing may change as the function is being built.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-surface-elevated px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-content-tertiary">Agent Workflow</p>
              <p className="text-sm text-content-primary">Each task is an agent run. Follow the checklist, review the draft, then decide.</p>
            </div>
            <div className="rounded-full border border-border bg-surface-primary px-3 py-2 text-xs text-content-secondary">
              <span className="font-medium text-content-primary">{agentTasks.length} runs</span>
              {' • '}
              <span className="font-medium text-content-primary">{needsApprovalCount} awaiting review</span>
              {' • '}
              <span className="font-medium text-content-primary">{metricValue(pipeline ? usd(pipeline.open_pipeline_usd) : null)} pipeline</span>
              {' • '}
              <span className={blockedCount > 0 ? 'text-red-500' : 'text-content-primary'}>{blockedCount} blocked</span>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-border bg-surface-elevated">
          <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="border-r border-border bg-surface-primary p-4">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.22em] text-content-tertiary">Queues</p>
                <p className="mt-1 text-sm text-content-secondary">Filter the workflow inbox.</p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setOwnerFilter('all');
                    setPriorityFilter('all');
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-medium ${
                    ownerFilter === 'all' && priorityFilter === 'all'
                      ? 'border-accent-active bg-accent/10 text-content-primary'
                      : 'border-border bg-surface-elevated text-content-secondary hover:bg-surface-secondary'
                  }`}
                >
                  All sessions
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerFilter('unassigned')}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-medium ${
                    ownerFilter === 'unassigned'
                      ? 'border-accent-active bg-accent/10 text-content-primary'
                      : 'border-border bg-surface-elevated text-content-secondary hover:bg-surface-secondary'
                  }`}
                >
                  Unassigned
                </button>
              </div>

              <div className="mt-5">
                <p className="text-xs uppercase tracking-[0.22em] text-content-tertiary">Priority</p>
                <div className="mt-2 space-y-2">
                  {(['all', 'urgent', 'high', 'normal'] as PriorityFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setPriorityFilter(filter)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-medium ${
                        priorityFilter === filter
                          ? 'border-accent-active bg-accent/10 text-content-primary'
                          : 'border-border bg-surface-elevated text-content-secondary hover:bg-surface-secondary'
                      }`}
                    >
                      {filter === 'all' ? 'All priorities' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs uppercase tracking-[0.22em] text-content-tertiary">Reviewers</p>
                <div className="mt-2 space-y-2">
                  {teamSummaries.filter((team) => team.key !== 'all' && team.key !== 'unassigned').map((team) => {
                    const isActive = ownerFilter === team.key;
                    return (
                      <button
                        key={team.key}
                        type="button"
                        onClick={() => setOwnerFilter(team.key)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-medium ${
                          isActive
                            ? 'border-accent-active bg-accent/10 text-content-primary'
                            : 'border-border bg-surface-elevated text-content-secondary hover:bg-surface-secondary'
                        }`}
                      >
                        {team.label}
                        <span className="float-right text-xs text-content-tertiary">{team.queueCount}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className="grid grid-cols-1 border-t border-border xl:grid-cols-[360px_minmax(0,1fr)] xl:border-t-0">
              <div className="border-r border-border bg-surface-secondary p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-content-tertiary">Sessions</p>
                    <p className="mt-1 text-sm text-content-primary">{filteredTasks.length} active runs</p>
                  </div>
                  <Badge variant="neutral">Leads</Badge>
                </div>

                <div className="space-y-2">
                  {filteredTasks.length === 0 ? (
                    <div className="rounded-xl border border-border bg-surface-primary px-3 py-6 text-sm text-content-tertiary">
                      No runs match the current filters.
                    </div>
                  ) : (
                    filteredTasks.slice(0, 18).map((task) => {
                      const isSelected = selectedTask?.taskId === task.taskId;
                      return (
                        <button
                          key={task.taskId}
                          type="button"
                          onClick={() => setSelectedTaskId(task.taskId)}
                          className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                            isSelected ? 'border-accent-active bg-accent/10' : 'border-border bg-surface-primary hover:bg-surface-elevated'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-content-primary">{task.organizationName}</p>
                              <p className="mt-1 text-xs text-content-secondary">{task.contactName} · {queueStatusLabel(task)}</p>
                              <p className="mt-1 text-xs text-content-tertiary">{task.runMetadata.triggeredBy}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <Badge variant={task.status === 'blocked' ? 'error' : priorityVariant(task.priority)}>
                                {task.status === 'blocked' ? 'BLOCKED' : task.priority.toUpperCase()}
                              </Badge>
                              <p className="mt-2 text-xs text-content-tertiary">{task.autoSendLabel}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-surface-secondary">
                <div className="border-b border-border bg-surface-primary px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-content-tertiary">Workflow Console</p>
                      {selectedTask ? (
                        <>
                          <h2 className="mt-1 text-xl font-semibold text-content-primary">{prettyReasonCode(selectedTask.taskType)}</h2>
                          <p className="mt-1 text-sm text-content-secondary">{selectedTask.organizationName} · {selectedTask.contactName} · {selectedTask.contactRole}</p>
                          <p className="mt-1 text-sm text-content-secondary">{queueStatusLabel(selectedTask)} • {selectedTask.autoSendLabel}</p>
                        </>
                      ) : null}
                    </div>
                    {selectedTask ? <Badge variant={statusVariant(selectedTask.status)}>{queueStatusLabel(selectedTask)}</Badge> : null}
                  </div>
                </div>

                <div className="space-y-4 px-5 py-5">
                  {selectedTask ? (
                    <>
                      <section className="rounded-2xl border border-border bg-surface-primary p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-content-tertiary">Workflow Checklist</p>
                        <div className="mt-3 space-y-2">
                          {workflowRows.map((row) => {
                            const isCurrent = row.state === 'current';
                            return (
                              <div key={row.key} className={`rounded-xl border ${workflowRowTone(row.state)}`}>
                                <div className="flex items-center justify-between gap-3 px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium">{row.label}</p>
                                    <p className="mt-0.5 text-xs opacity-80">{row.detail}</p>
                                  </div>
                                  <div className="pl-3 text-sm font-semibold">
                                    {row.state === 'done' ? '✓' : row.state === 'current' ? '●' : row.state === 'blocked' ? '!' : '○'}
                                  </div>
                                </div>

                                {isCurrent ? (
                                  <div className="border-t border-border px-3 py-3">
                                    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                                      <div className="mb-3 flex items-center justify-between gap-3">
                                        <p className="text-[11px] uppercase tracking-[0.22em] text-content-tertiary">Email Draft</p>
                                        <Link href={`/terminal/unit-economics?customer=${encodeURIComponent(selectedTask.organizationId)}`} className="text-xs font-medium text-accent hover:underline">
                                          Open Unit Econ
                                        </Link>
                                      </div>

                                      {isEditingDraft ? (
                                        <div className="space-y-3">
                                          <div>
                                            <label className="text-xs uppercase tracking-wide text-content-tertiary">Subject</label>
                                            <input
                                              value={draftSubject}
                                              onChange={(event) => setDraftSubject(event.target.value)}
                                              className="mt-1 w-full rounded-xl border border-border bg-surface-primary px-3 py-2 text-sm text-content-primary"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-xs uppercase tracking-wide text-content-tertiary">Body</label>
                                            <textarea
                                              value={draftBody}
                                              onChange={(event) => setDraftBody(event.target.value)}
                                              rows={10}
                                              className="mt-1 w-full rounded-xl border border-border bg-surface-primary px-3 py-3 text-sm text-content-primary"
                                            />
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="rounded-xl border border-border bg-white px-4 py-4">
                                          <p className="text-sm font-semibold text-content-primary">Subject: {draftSubject}</p>
                                          <p className="mt-3 whitespace-pre-wrap text-sm text-content-secondary">{draftBody}</p>
                                        </div>
                                      )}

                                      <p className="mt-3 text-sm text-content-secondary">If approved, the email sends now and follow-up is scheduled.</p>

                                      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-4">
                                        <Button variant="primary">{selectedTask.status === 'blocked' ? 'Resolve Blocker' : 'Approve & Send'}</Button>
                                        <Button variant="secondary" onClick={() => setIsEditingDraft((value) => !value)}>
                                          {isEditingDraft ? 'Done Editing' : 'Edit Draft'}
                                        </Button>
                                        <Button variant="ghost">Cancel Run</Button>
                                        <Button
                                          variant="ghost"
                                          onClick={() => {
                                            setDraftSubject(selectedTask.subject);
                                            setDraftBody(selectedTask.body);
                                            setIsEditingDraft(false);
                                          }}
                                        >
                                          Reset Draft
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      <div className="flex items-center justify-end">
                        <Button variant="ghost" onClick={() => setIsDetailsOpen(true)}>
                          Open Details
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-border bg-surface-primary px-4 py-8 text-sm text-content-tertiary">
                      Select a run from the sessions list to open the workflow console.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      {selectedTask ? (
        <Drawer
          open={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          title="Run Details"
          widthClassName="w-full max-w-2xl"
          contentClassName="flex-1 overflow-auto p-4"
        >
          <div className="space-y-3">
            {workflowSections.map((section) => (
              <WorkflowSectionCard key={section.key} section={section} />
            ))}
          </div>
        </Drawer>
      ) : null}
    </TerminalShell>
  );
}
