'use client';

import { useMemo, useState, useEffect } from 'react';
import { Button, Card, DataTable, EmptyState, LoadingState, StatTile } from '@/components/ui';
import TerminalShell from '@/components/terminal/TerminalShell';
import OrganizationDrillPanel from '@/components/terminal/OrganizationDrillPanel';
import { num, pct, runWarehouseQuerySafe, usd } from '@/lib/warehouse';

interface PipelineRow {
  as_of_date: string;
  open_pipeline_usd: number;
  won_revenue_usd: number;
  lead_conversion_rate_pct: number;
  opportunity_win_rate_pct: number;
}

interface CampaignRow {
  metric_month: string;
  campaign_name: string;
  channel: string;
  won_revenue_usd: number;
  campaign_roas: number | null;
}

interface CustomerRow {
  organization_id: string;
  organization_name: string;
  current_plan_name: string;
  realized_revenue_usd: number;
  collection_rate_pct: number;
}

export default function GtmTerminalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineRow | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [pipelineRows, campaignRows, customerRows] = await Promise.all([
          runWarehouseQuerySafe(`
            SELECT as_of_date, open_pipeline_usd, won_revenue_usd, lead_conversion_rate_pct, opportunity_win_rate_pct
            FROM gtm.snap_pipeline_daily
            ORDER BY as_of_date DESC
            LIMIT 1
          `),
          runWarehouseQuerySafe(`
            SELECT metric_month, campaign_name, channel, won_revenue_usd, campaign_roas
            FROM gtm.agg_campaign_channel_monthly
            ORDER BY metric_month DESC, won_revenue_usd DESC
            LIMIT 100
          `),
          runWarehouseQuerySafe(`
            SELECT organization_id, organization_name, current_plan_name, realized_revenue_usd, collection_rate_pct
            FROM fin.agg_revenue_monthly
            WHERE revenue_month = (SELECT MAX(revenue_month) FROM fin.agg_revenue_monthly)
            ORDER BY realized_revenue_usd DESC
            LIMIT 100
          `),
        ]);

        const p = pipelineRows[0];
        setPipeline(
          p
            ? {
                as_of_date: String(p.as_of_date ?? ''),
                open_pipeline_usd: num(p.open_pipeline_usd),
                won_revenue_usd: num(p.won_revenue_usd),
                lead_conversion_rate_pct: num(p.lead_conversion_rate_pct),
                opportunity_win_rate_pct: num(p.opportunity_win_rate_pct),
              }
            : null,
        );

        setCampaigns(
          campaignRows.map((row) => ({
            metric_month: String(row.metric_month ?? ''),
            campaign_name: String(row.campaign_name ?? ''),
            channel: String(row.channel ?? ''),
            won_revenue_usd: num(row.won_revenue_usd),
            campaign_roas: row.campaign_roas == null ? null : num(row.campaign_roas),
          })),
        );

        setCustomers(
          customerRows.map((row) => ({
            organization_id: String(row.organization_id ?? ''),
            organization_name: String(row.organization_name ?? ''),
            current_plan_name: String(row.current_plan_name ?? ''),
            realized_revenue_usd: num(row.realized_revenue_usd),
            collection_rate_pct: num(row.collection_rate_pct),
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load GTM terminal');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const channels = useMemo(() => ['all', ...Array.from(new Set(campaigns.map((row) => row.channel).filter(Boolean))).slice(0, 8)], [campaigns]);
  const filteredCampaigns = useMemo(() => {
    if (selectedChannel === 'all') return campaigns;
    return campaigns.filter((row) => row.channel === selectedChannel);
  }, [campaigns, selectedChannel]);

  const topCampaignRevenue = filteredCampaigns.slice(0, 10).reduce((acc, row) => acc + row.won_revenue_usd, 0);

  if (loading) {
    return (
      <TerminalShell active="gtm" title="GTM Terminal" subtitle="Pipeline, campaign efficiency, and top-client monetization.">
        <LoadingState title="Loading GTM terminal" description="Compiling pipeline and campaign surfaces." />
      </TerminalShell>
    );
  }

  if (error || !pipeline) {
    return (
      <TerminalShell active="gtm" title="GTM Terminal" subtitle="Pipeline, campaign efficiency, and top-client monetization.">
        <EmptyState title="GTM terminal unavailable" description={error || 'No data found'} actionLabel="Retry" onAction={() => window.location.reload()} />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell active="gtm" title="GTM Terminal" subtitle="Pipeline, campaign efficiency, and top-client monetization.">
      <div className="space-y-3">
        {selectedOrganizationId ? (
          <OrganizationDrillPanel organizationId={selectedOrganizationId} onClose={() => setSelectedOrganizationId(null)} />
        ) : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Open Pipeline" value={usd(pipeline.open_pipeline_usd)} trend="up" />
          <StatTile label="Won Revenue" value={usd(pipeline.won_revenue_usd)} trend="up" />
          <StatTile label="Lead Conversion" value={pct(pipeline.lead_conversion_rate_pct)} trend="up" />
          <StatTile label="Win Rate" value={pct(pipeline.opportunity_win_rate_pct)} trend="up" />
          <StatTile label="Top 10 Won" value={usd(topCampaignRevenue)} trend="up" />
        </section>

        <Card variant="elevated" className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-content-primary">Campaign Board</h2>
            <div className="flex flex-wrap gap-1">
              {channels.map((channel) => (
                <button
                  key={channel}
                  onClick={() => setSelectedChannel(channel)}
                  className={`rounded px-2 py-1 text-xs ${
                    selectedChannel === channel ? 'bg-accent text-white' : 'bg-surface-secondary text-content-secondary'
                  }`}
                >
                  {channel}
                </button>
              ))}
            </div>
          </div>
          <DataTable<CampaignRow>
            columns={[
              { key: 'metric_month', header: 'Month' },
              { key: 'campaign_name', header: 'Campaign' },
              { key: 'channel', header: 'Channel' },
              { key: 'won_revenue_usd', header: 'Won', align: 'right', render: (row) => usd(row.won_revenue_usd) },
              { key: 'campaign_roas', header: 'ROAS', align: 'right', render: (row) => (row.campaign_roas == null ? 'n/a' : row.campaign_roas.toFixed(2)) },
            ]}
            rows={filteredCampaigns.slice(0, 30)}
            emptyLabel="No campaign rows"
          />
        </Card>

        <Card variant="elevated" className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-content-primary">Best Clients</h2>
          <DataTable<CustomerRow>
            columns={[
              { key: 'organization_name', header: 'Customer' },
              { key: 'current_plan_name', header: 'Plan' },
              { key: 'realized_revenue_usd', header: 'Realized', align: 'right', render: (row) => usd(row.realized_revenue_usd) },
              { key: 'collection_rate_pct', header: 'Collect %', align: 'right', render: (row) => pct(row.collection_rate_pct) },
              {
                key: 'drill',
                header: 'Drill',
                render: (row) => (
                  row.organization_id
                    ? (
                      <Button size="sm" variant="ghost" onClick={() => setSelectedOrganizationId(row.organization_id)}>
                        Open
                      </Button>
                    )
                    : 'n/a'
                ),
              },
            ]}
            rows={customers.slice(0, 25)}
            emptyLabel="No customer rows"
          />
        </Card>
      </div>
    </TerminalShell>
  );
}
