# Project Conventions

## SQL Style

- Never use `SELECT *` in dbt models. Always explicitly list the columns being selected, even in CTE imports.
- Every model follows the CTE pattern: `WITH ... final AS (...) SELECT * FROM final`. The only `SELECT *` allowed is the final select from the `final` CTE.
- Every model file starts with a comment header block: model name, source, grain, and purpose.
- Staging models always cast types and rename columns. No raw column names should leak past staging.
- Add `_loaded_at` (or `_calculated_at` for metric views) metadata column on all materialized models.
- Use `COALESCE` for nullable aggregations, `NULLIF` to guard division by zero.
- Dates: use `DATE()` or `DATE_TRUNC()` for date dimensions, never string manipulation.

## dbt Naming

- Staging: `stg_` prefix (e.g., `stg_sessions`, `stg_plans`)
- Core entities: no prefix (e.g., `organizations`, `users`, `sessions`)
- Dimensions: `dim_` prefix, full plural names (e.g., `dim_organizations`, not `dim_org`)
- Facts: `fct_` prefix, plural (e.g., `fct_runs`, `fct_events`)
- Analytics models: no prefix, clean names (e.g., `mrr`, `daily_sessions`, `cohort_retention`)

## Canonical Object Naming (Warehouse + Analytics)

- Use: `<domain>.<layer>_<entity>[_<grain>]`
- `layer` must be one of: `dim`, `fct`, `agg`, `kpi`, `cfg`, `bridge`, `snap`.
- `entity` must be a clear business noun (e.g., `browser_sessions`, `organizations`, `revenue`).
- `grain` is required for time series models and must be explicit (`daily`, `weekly`, `monthly`).
- Do not repeat the domain token in the table name (avoid names like `growth_growth_daily`).
- Do not use vague entity names like `runs` if a precise name exists; prefer `browser_sessions` or `browser_runs`.

### Required Renames (Current Examples)

- `growth.growth_daily` -> `growth.agg_growth_daily` (or a more specific entity form like `growth.agg_pipeline_daily`)
- `growth.growth_kpis` -> `growth.kpi_growth_daily`
- `growth.signal_thresholds` -> `growth.cfg_signal_thresholds`
- `silver.fct_runs` -> `silver.fct_browser_sessions` (or `silver.fct_browser_runs`, pick one canonical term and use consistently)

## dbt Testing

- Every model must have a corresponding YAML file with at minimum primary key `not_null` + `unique` tests.
- Use `accepted_values` on all status/enum columns.
- Use `relationships` tests for foreign keys between core models.

## Architecture

- Two databases: `warehouse` (plumbing) and `analytics` (analyst-facing).
- Bronze schemas are source-scoped: `bronze_supabase`, `bronze_ramp`, etc.
- Silver is a single schema in the warehouse DB for all staging + core models.
- Analytics schemas are division-scoped: `growth`, `product`, `finance`, `eng`, `ops`, `core`.
- New data sources get their own `bronze_<source>` schema and `stg_` models before joining in core.

## Python / Pipeline

- No external dependency for `.env` loading. Use the custom parser in `replicate.py` / `query_warehouse.py`.
- Replication is full-refresh (DELETE + INSERT), not incremental.

## Documentation

- `SYSTEM_DOCUMENTATION.md` is the single canonical doc for setup, architecture, and troubleshooting.

## Do Not

- Do not use `SELECT *` in CTEs or model imports. Always list columns explicitly.
- Do not create new documentation files. Update `SYSTEM_DOCUMENTATION.md` instead.
- Do not commit `.duckdb` files or `.env` to git.
- Do not add `python-dotenv` or other external dependencies for env loading.
- Do not use abbreviated model names (`dim_org`, `dim_user`, `fct_sub`). Use full plural names.
- Do not put `fct_` or `v_` prefixes on analytics-layer models. Those are clean names only.
- Do not create single-file subdirectories. If a directory has one model, it belongs in its parent.
- Do not hardcode schema or database names in SQL model files. Use `ref()` and `source()` exclusively.
- Do not skip the comment header block on new models.
- Do not skip YAML test definitions for new models.
- Do not mock data. Use real sources or the seed generators in `supabase/`.
- Do not gracefully fail. Let errors propagate. No silent `try/except` swallowing, no `|| true` in pipelines, no fallback defaults that hide broken data.
