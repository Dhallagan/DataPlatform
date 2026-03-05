# Warehouse Naming Conventions

This repo uses a strict medallion layout in one database:

- `bronze_supabase`: raw source replicas
- `silver`: staging views (`stg_*`)
- `core`: canonical entities, facts, dims, and cross-domain metrics
- Domain-scoped gold schemas:
  - `gtm`: growth/go-to-market models
  - `pro`: product analytics models
  - `fin`: finance models
  - `eng`: engineering models
  - `ops`: operations models
  - `core`: cross-domain metrics and catalog

## Prefix Rules

- `stg_`: cleaned source tables in `silver`
- `dim_`: dimensions in `core`
- `fct_`: event/transaction facts in `core`
- `bridge_`: cross-entity relationship tables in `core`
- `snap_`: point-in-time snapshots (gold schemas)
- `agg_`: pre-aggregated rollups (gold schemas)
- `kpi_`: KPI contract views (gold schemas)
- `cfg_`: configuration/threshold tables (gold schemas)
- `metric_`: semantic layer metrics (usually `core`)

## Domain Naming

Use 3-letter schema abbreviations for gold:

- Growth/GTM: `gtm.agg_funnel_daily`, `gtm.snap_pipeline_daily`, `gtm.kpi_growth`, `gtm.cfg_signal_thresholds`
- Product: `pro.agg_sessions_daily`, `pro.kpi_product`
- Finance: `fin.snap_mrr`, `fin.agg_revenue_monthly`, `fin.agg_budget_vs_actual_monthly`
- Engineering: `eng.agg_engineering_daily`, `eng.kpi_engineering`
- Operations: `ops.agg_ops_daily`, `ops.kpi_ops`

Do not repeat schema names in object names.
Good: `gtm.agg_funnel_daily`
Avoid: `gtm.gtm_funnel_daily`

## Practical Rules

- Keep canonical facts/dims in `core`; staging views in `silver`; domain rollups in gold schemas.
- Use `{{ config(alias='...') }}` in model files for database-facing names.
- File names stay as-is (less churn in `ref()` calls); aliases control the output table name.
- Avoid creating new top-level schemas unless there is an explicit serving need.
