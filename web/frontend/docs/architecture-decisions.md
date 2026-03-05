# BrowserBase: Replication, Warehouse, and Terminal Mart Decisions

This note is intentionally focused on three things:

1. Why we chose the replication pipeline shape.
2. Why we modeled the warehouse in Bronze -> Silver -> Gold layers.
3. How Terminal became a dedicated mart instead of a UI over random tables.

## What Problem We Were Solving

We needed an operating system for the business, not just a chat toy or a dashboard pile.

That meant:

- Ingesting source data with low friction.
- Preserving source truth before transforming.
- Building stable, governed marts for decisions.
- Serving those marts in a fast terminal workflow.

## Replication Pipeline Decisions

### 1) Replicate Source-Aligned Data First

We intentionally replicate raw-ish source data first, before business transforms.

Why:

- Faster onboarding of new sources.
- Easier debugging (you can inspect what source actually sent).
- Lower risk of silent logic drift during ingestion.

Tradeoff:

- Raw layers are noisy and not analytics-ready.
- We accept that because cleanup belongs in dbt, not in ingestion scripts.

### 2) Keep Pipeline Tasks Explicit and Scriptable

We kept ingestion and orchestration in explicit scripts (`pipeline/*`) and shell workflows.

Why:

- You can run pieces independently when incidents happen.
- Easier operational debugging than hiding everything in one monolithic job.
- Works in both local and deployed contexts.

### 3) Treat Freshness and Contracts as First-Class

We added checks around freshness/schema contracts, not just row movement.

Why:

- “Pipeline succeeded” is meaningless if key tables are stale or shape-shifted.
- Monitoring is part of the product, not an afterthought.

## Warehouse Modeling Decisions

### 1) Layered Architecture: Bronze -> Silver -> Gold

We standardized layers:

- **Bronze (`010_bronze`)**: source-aligned staging.
- **Silver (`020_silver`)**: conformed entities and cleaned facts/dims.
- **Gold (`030_gold`)**: business-ready marts and KPI surfaces.

Why:

- Clear semantic boundary between raw, conformed, and decision-grade data.
- Prevents business logic duplication.
- Makes refactors safer because contracts are layer-scoped.

### 2) Build Canonical Domain Marts

We built/maintained domain marts for GTM, Finance, Ops, Product, and executive metrics.

Why:

- Business questions should hit stable marts, not unstable intermediate models.
- Domain ownership becomes clearer.
- Performance is better when repeated logic is materialized once.

### 3) Test Grain and Metric Contracts

We added tests for uniqueness, constraints, and consistency in key terminal-facing marts.

Why:

- A terminal experience is only as trustworthy as metric contracts.
- Catching grain breaks early prevents decision errors later.

## How Terminal Became a Mart

This is the core design move.

### Before

Terminal-like pages queried mixed models directly, with ad hoc SQL patterns per page.

Problems:

- Logic drift between pages.
- Fragile query behavior.
- Hard to guarantee consistent definitions.

### After

We established terminal-specific marts in Gold/Core metrics:

- `term.business_snapshot_monthly`
- `term.scorecard_daily`
- `term.customer_daily`
- `term.gtm_daily`
- `term.finance_monthly`
- `term.product_daily`
- `term.exec_daily` (ops/reliability use cases)

Then terminal functions (`OV`, `SC`, `GTM`, `FIN`, `OPS`, `CUS`, `META`, `ABOUT`) map to those stable marts.

What this gave us:

- Terminal is now a consumption layer over governed marts.
- Every command has a model contract.
- UI changes no longer require redefining business logic.

## Why This Matters Operationally

When leadership asks “what changed?”, we can answer from a known contract model.
When product asks “which customers are impacted?”, we drill from terminal command to terminal mart to customer-level facts.
When data quality shifts, monitoring and tests show us where trust degraded.

In short: terminal UX is fast because warehouse contracts are strong.

## Best Practices We Intentionally Followed

- Source-aligned replication first; business logic later.
- Keep transformation logic in dbt models, not ingestion code.
- Enforce layered model semantics (Bronze/Silver/Gold).
- Create dedicated decision marts for user workflows.
- Map product commands to canonical marts.
- Treat freshness, contracts, and drift monitoring as product requirements.

## Practical Rule for Future Changes

If a new terminal surface cannot name its canonical mart and grain in one sentence, it is not ready.

The architecture works because commands, marts, and contracts stay aligned.
