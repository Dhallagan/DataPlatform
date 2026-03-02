# BrowserBase Ontology Blueprint

## 1. Purpose
Define a single business ontology that connects product usage, customer lifecycle, and commercial outcomes so Growth, Finance, and Product can run on shared definitions.

This ontology is intended to:
- align decisions across teams,
- make KPI logic explainable and auditable,
- support self-serve analytics,
- power operational signals and actions.

## 2. Ontology Design Principles
- Model business objects first, then metrics.
- Every object has clear identity, lifecycle state, and ownership.
- Every KPI is derived from declared objects and facts.
- Every signal maps to a business action and outcome.
- No metric or signal exists without a data contract and test coverage.

## 3. Core Object Model

### 3.1 Customer Domain
- `organization`
- `user`
- `organization_member`

Key outcomes:
- account lifecycle state,
- user activation and engagement,
- ownership for GTM actions.

### 3.2 Product Runtime Domain
- `project`
- `api_key`
- `browser_run` (session)
- `run_event`

Key outcomes:
- reliable value delivery,
- performance and quality,
- adoption and depth of usage.

### 3.3 Commercial Domain
- `plan`
- `subscription`
- `usage_record`
- `invoice`

Key outcomes:
- recurring revenue,
- collections health,
- expansion/churn economics.

## 4. Canonical Relationships
- `organization` 1:N `users`
- `organization` 1:N `projects`
- `organization` 1:N `api_keys`
- `organization` 1:N `browser_runs`
- `browser_run` 1:N `run_events`
- `organization` 1:N `subscriptions` (time-based history)
- `plan` 1:N `subscriptions`
- `organization` 1:N `usage_records`
- `organization` 1:N `invoices`
- `subscription` 1:N `invoices`

## 5. Lifecycle States (Ontology State Machines)

### 5.1 Customer Lifecycle
`lead -> trial -> activated -> paying -> expanded | at_risk | churned`

### 5.2 Run Lifecycle
`pending -> running -> completed | failed | timeout`

### 5.3 Billing Lifecycle
`trialing -> active -> past_due -> recovered | canceled`

## 6. Warehouse Mapping
- Source: `supabase.public.*`
- Bronze: `bronze_supabase.*` (raw replication)
- Silver: `silver.stg_*`, `silver.{organizations,users,sessions}`, `silver.dim_*`, `silver.fct_*`
- Domain Analytics: `growth.*`, `product.*`, `finance.*`, `eng.*`, `ops.*`
- Shared KPI Layer: `core.daily_kpis`, `core.metric_spine`

Ontology rule:
- Objects are primarily defined in `silver`.
- Team/business rollups live in domain analytics schemas (`growth/product/finance/eng/ops`).
- Shared KPI contracts live in `core`.

## 7. Signal Framework
Signals are first-class ontology objects derived from metrics + state transitions.

Signal contract:
- `signal_id`
- `signal_name`
- `domain` (`growth`, `finance`, `product`)
- `object_type` (`organization`, `subscription`, `run_cluster`, etc.)
- `object_id`
- `signal_score` (0-1)
- `severity` (`low`, `medium`, `high`, `critical`)
- `reason_code`
- `triggered_at`
- `expires_at`
- `version`

### 7.1 Growth Signals
1. `trial_conversion_risk_daily`
- Object: `organization`
- Inputs: activation within 7d, successful runs, trial days remaining
- Action: create lifecycle task for growth owner

2. `expansion_candidate_daily`
- Object: `organization`
- Inputs: usage trend, quota pressure, plan fit gap
- Action: route to AE/CS for upgrade workflow

3. `activation_stall_risk_daily`
- Object: `organization`
- Inputs: no first successful run, low event quality, low user engagement
- Action: onboarding intervention

### 7.2 Finance Signals
1. `dunning_candidate_daily`
- Object: `subscription` / `invoice`
- Inputs: past due days, failed payment attempts, invoice status
- Action: dunning sequence + owner queue

2. `revenue_leakage_risk_daily`
- Object: `organization`
- Inputs: high usage with stale plan, unbilled overage anomalies
- Action: billing reconciliation task

3. `renewal_risk_30d`
- Object: `subscription`
- Inputs: renewal proximity, usage decline, support/incident history
- Action: pre-renewal finance + CS intervention

### 7.3 Product Signals
1. `run_quality_regression_hourly`
- Object: `run_cluster` (route/region/browser type)
- Inputs: success rate delta, timeout spikes, p95 runtime drift
- Action: incident/open investigation

2. `adoption_drop_risk_daily`
- Object: `organization`
- Inputs: WAU/MAU decline, session depth decline, key feature usage drop
- Action: product/CS outreach trigger

3. `incident_arr_exposure_hourly`
- Object: `incident`
- Inputs: impacted paying orgs, MRR exposure, duration
- Action: escalation + status communication workflow

## 8. Action Logging (Closed Loop)
Every signal-triggered action must be logged.

Action contract:
- `action_id`
- `signal_id`
- `action_type`
- `destination_system`
- `actor_type` (`human` | `automation`)
- `actor_id`
- `executed_at`
- `status`
- `error_message`
- `outcome_label` (optional)

## 9. Governance and Ownership
- Each object has `data_owner` and `team_owner`.
- Each KPI has `metric_owner`, grain, SLA, and tests.
- Each signal has owner, threshold policy, and runbook.
- Access controls separate:
  - raw payload access,
  - modeled analytics access,
  - operational signal/action controls.

## 10. V1 Build Plan (Practical)
1. Freeze object contracts in `silver`.
2. Publish top KPI contracts in `core` and domain analytics schemas.
3. Ship three initial signals:
   - `trial_conversion_risk_daily`
   - `dunning_candidate_daily`
   - `run_quality_regression_hourly`
4. Implement action logging and first downstream actions.
5. Add ontology docs view in BasedHoc:
   - domain map,
   - object graph,
   - signal catalog.

## 11. Definition of Done (Ontology v1)
- Core objects documented and test-enforced.
- Growth/Finance/Product signal contracts published.
- At least one active workflow per domain writes to action log.
- Metric-to-object lineage is visible in docs/UI.
- On-call runbook exists for signal and data-quality incidents.
