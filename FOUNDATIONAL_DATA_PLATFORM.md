# BrowserBase Foundational Data Platform

## 1. Objective
Build a production-grade data foundation for BrowserBase that powers:
- Finance operations (close, reconciliation, dunning, revenue analytics)
- Growth operations (activation, conversion, expansion workflows)
- Product and ops reliability decisions (run quality, incident impact, cost control)

Design principle: model business objects and lifecycle states first, then compute metrics and workflow signals from those objects.

## 2. Platform Architecture
Data flow:
1. Sources -> Supabase app DB, billing provider, CRM
2. Ingestion -> raw append-only replication into warehouse bronze
3. Core modeling -> canonical objects and relationships in silver/core
4. Semantics -> governed KPI layer in gold/metrics
5. Activation -> workflow signals pushed to CRM, support, and internal agents

Current repo alignment:
- Source schema: `supabase/` tables
- Warehouse transforms: `warehouse/models/staging`, `warehouse/models/core`, `warehouse/models/growth`, `warehouse/models/product`, `warehouse/models/finance`, `warehouse/models/eng`, `warehouse/models/ops`, `warehouse/models/core_metrics`
- Orchestration scripts: `pipeline/`

## 3. Canonical Data Domains
Core objects (authoritative analytics layer):
- Organization
- User
- Project
- API Key
- Browser Run
- Run Event
- Plan
- Subscription
- Usage Record
- Invoice

Each object contract includes:
- Stable primary key
- Business status enum
- Event timestamps (`created_at`, `updated_at`, lifecycle transition timestamps)
- Ownership (`team_owner`, `data_owner`)
- PII classification

## 4. Warehouse Layering Standard
1. Bronze (`warehouse.bronze_supabase`)
- Exact source shape, no logic changes
- Required metadata columns: `_synced_at`, `_batch_id`, `_source_table`

2. Silver Staging (`warehouse.silver` with `stg_*` models)
- Type casting, null normalization, light dedupe
- Source-specific cleaning only

3. Silver Core (`warehouse.silver` core/dim/fct models)
- Canonical entities + fact tables
- Relationship integrity and enum constraints enforced via tests

4. Gold Marts (`analytics.{growth,product,finance,eng,ops}`)
- Team-oriented aggregates for finance/growth/product/ops

5. Gold Metrics (`analytics.core` + domain KPI models)
- KPI views with shared definitions and explicit grain

## 5. Semantic Metric Contracts
Every KPI must define:
- Metric name + owner
- SQL definition and source models
- Grain (`daily`, `weekly`, `monthly`, `org_daily`, etc.)
- Freshness SLA
- Data quality tests (null, bounds, accepted values, reconciliation)

Priority KPI set:
- Finance: `mrr`, `arr`, `nrr`, `arpa`, `invoice_collection_rate`, `past_due_amount`
- Growth: `lead_to_trial_rate`, `trial_to_paid_rate`, `activation_rate_7d`, `time_to_first_successful_run`
- Product/Ops: `run_success_rate`, `timeout_rate`, `p95_runtime_seconds`, `cost_per_successful_run`

## 6. Workflow Signal Layer
Create explicit signal models as the automation interface.

Required v1 signal tables:
- `signal_dunning_candidates_daily`
- `signal_trial_conversion_risk_daily`
- `signal_expansion_candidates_daily`
- `signal_incident_arr_exposure_hourly`

Signal table standard:
- `signal_id`
- `object_type` (`organization`, `subscription`, `run_cluster`, etc.)
- `object_id`
- `signal_score` (0-1 or 0-100)
- `reason_code`
- `triggered_at`
- `expires_at`
- `version`

## 7. Activation and Action Logging
Activation targets:
- CRM tasks (sales/growth)
- Billing comms tooling (finance)
- Incident tooling (ops)

Every automated action must be logged:
- `action_id`
- `signal_id`
- `action_type`
- `destination_system`
- `actor_type` (`human`, `automation`)
- `actor_id`
- `executed_at`
- `status`
- `error_message` (nullable)

## 8. Governance and Reliability
Access control:
- Restrict raw event payload access
- Separate analyst vs operator roles

PII policy:
- Tokenize/hash emails in analytics-facing layers
- Keep sensitive columns out of default marts

Reliability SLOs:
- Ingestion freshness: <= 15 minutes
- Core model freshness: <= 60 minutes
- KPI freshness: <= 2 hours

Data quality gates:
- PK uniqueness and not-null on all core entities
- FK integrity across org/user/run/subscription/invoice graph
- Status enum accepted values
- Finance reconciliation tests (invoice totals vs usage-derived billing)

## 9. Implementation Blueprint (30 Days)
Week 1: Contracts and foundations
1. Freeze canonical object contracts and status enums
2. Add/standardize bronze metadata columns
3. Add missing core model tests for PK/FK/enums

Week 2: Metrics hardening
1. Define metric contract YAML for top 10 KPIs
2. Backfill and validate `mrr`, `nrr`, `trial_to_paid`, `run_success_rate`
3. Add reconciliation tests for finance-critical metrics

Week 3: Workflow signalization
1. Build 4 v1 signal models
2. Add threshold configuration table per signal
3. Add signal QA tests (non-negative score, id uniqueness, freshness)

Week 4: Activation and operations
1. Implement action log table and write-path
2. Wire first two automations:
   - dunning candidate -> finance queue
   - expansion candidate -> growth queue
3. Create operational dashboard: freshness, test pass rate, signal volumes, action success rate

## 10. Definition of Done (v1)
The foundational platform is v1-ready when:
1. Core object layer is test-enforced and documented
2. Finance and growth KPI contracts are published and validated
3. Signal tables are produced on SLA and consumed by at least one workflow each
4. Action logging provides full audit trail from signal to downstream execution
5. On-call runbook exists for pipeline failures and data quality incidents
