# Metric Dictionary v1

## Principles
- Every KPI has an owner, grain, source model, and exact formula.
- No dashboard-only metrics without warehouse lineage.

## Metrics

### activation_rate_30d
- Owner: Product
- Grain: Daily
- Source models: `growth.gtm_lifecycle_accounts`, `product.daily_sessions`
- Definition: Share of trial organizations that activate within 30 days.
- Formula: `activated_orgs_30d / nullif(trial_orgs_30d, 0)`

### pql_to_sql_conversion_rate
- Owner: GTM Ops
- Grain: Weekly
- Source models: `growth.gtm_funnel_daily`, `growth.gtm_pipeline_snapshot`
- Definition: Share of product-qualified leads converted to sales-qualified leads.
- Formula: `sql_from_pql / nullif(total_pql, 0)`

### nrr
- Owner: Finance
- Grain: Monthly
- Source models: `finance.mrr`, `finance.monthly_revenue`
- Definition: Net revenue retention on starting cohort.
- Formula: `(starting_mrr + expansion_mrr - contraction_mrr - churn_mrr) / nullif(starting_mrr, 0)`

### gross_margin_pct
- Owner: Finance
- Grain: Monthly
- Source models: `finance.monthly_revenue`, `finance.ramp_spend_monthly`
- Definition: Revenue retained after direct delivery cost.
- Formula: `(recognized_revenue_usd - cogs_usd) / nullif(recognized_revenue_usd, 0)`

### cost_per_successful_run
- Owner: Product
- Grain: Daily
- Source models: `core.fct_browser_sessions`, `fin.agg_spend_monthly`
- Definition: Effective infra cost per successfully completed run.
- Formula: `run_related_cost_usd / nullif(successful_runs, 0)`

### failed_session_revenue_impact_usd
- Owner: Shared (Product + Finance)
- Grain: Weekly
- Source models: `core.fct_browser_sessions`, `fin.agg_revenue_monthly`, `gtm.dim_lifecycle_accounts`
- Definition: Estimated revenue at risk from run failures in paying orgs.
- Formula: `sum(estimated_arr_at_risk_per_failed_org)`
