# BrowserBase Data Platform

Foundational business data platform for BrowserBase: ingestion, warehouse modeling, governed metrics, and self-serve analytics surfaces (chat, explorer, workflows).

## Canonical Governance Docs

- `NORTH_STAR.md` — mission, strategic outcomes, operating principles
- `LLM.txt` — machine-readable policy and answer contract for AI workflows
- `ROADMAP_90_DAYS.md` — phased execution plan and success criteria
- `CHECKLIST.md` — atomic implementation checklist

## Repository Layout

- `supabase/` source schema, migrations, and seed scripts
- `pipeline/` replication and orchestration scripts
- `warehouse/` dbt project and models
- `queries/` example SQL checks
- `web/` chat, explorer, docs, and monitoring product surface
- `workflows/` automation and agent workflow specs

## Data Flow

1. Source data is defined and seeded in Supabase.
2. `pipeline/replicate.py` syncs source data to `bronze_supabase`.
3. dbt builds `silver` canonical models and domain schemas (`growth`, `product`, `finance`, `eng`, `ops`, `core`).
4. Web and workflow surfaces consume governed models and metrics.

## Environment Setup

1. Copy `env.example` to `.env`.
2. Fill required values for local DuckDB and/or MotherDuck.

Required variables (minimum):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `MOTHERDUCK_TOKEN`

Optional reliability variables:

- `FRESHNESS_THRESHOLDS_JSON` (schema-level max age hours)
- `FRESHNESS_TABLE_THRESHOLDS_JSON` (table-level max age hours for tier-1 models)

## Common Commands

```bash
# End-to-end run (seed + replicate + dbt + tests)
./pipeline/run_pipeline.sh

# GTM/finance/trial scenario workflow
./pipeline/run_gtm_workflow.sh

# Replicate source -> bronze
python3 pipeline/replicate.py

# dbt build/test
cd warehouse
dbt run
dbt test
```

## Documentation Policy

- Root docs are intentionally small and strategic; keep them current.
- Put detailed implementation docs next to code in each subsystem.
- Archive stale narratives instead of letting them conflict with canonical docs.
