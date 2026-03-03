# Platform Execution Plan (P0/P1/P2)

## P0: Trust Foundation (Now)
- Build certified metric registry (`core.metric_registry`) with owners, formulas, grain, and SLAs.
- Expose metadata APIs for tables, table detail, metrics, and lineage.
- Enforce governed read-only query execution with schema allowlist and audit logs.
- Align canonical docs (`NORTH_STAR.md`, `LLM.txt`, `ROADMAP_90_DAYS.md`, `CHECKLIST.md`).

P0 Exit Criteria
- Certified metric registry is queryable by app and agent.
- Every ad-hoc query execution is policy-checked and audit-logged.
- Teams have one unambiguous platform/AI operating contract.

## P1: Reliability and Governance
- Add contract tests for tier-1 models (grain, nullability, key constraints).
- Add freshness SLAs and alerting policy by model tier.
- Add schema drift alert routing and incident runbooks.
- Add documentation ownership metadata for docs pages and model docs.

P1 Exit Criteria
- CI blocks contract regressions on tier-1 models.
- Freshness and drift issues are actively alerted with owner routing.
- Ownership for critical docs/models is explicit.

## P2: Self-Serve Scale
- Add explorer provenance UX: owner, sensitivity, freshness, lineage.
- Add chat provenance card in every answer.
- Add adoption analytics: deflection, self-serve usage, trust incidents.
- Standardize onboarding for teams using AI-assisted analytics.

P2 Exit Criteria
- Teams can self-serve common analytical workflows with confidence.
- Trust and adoption metrics are visible and improving month-over-month.
