# 90-Day Roadmap: Foundational Data Platform

## Phase 1 (Days 1-30): Governance and Contracts
- Publish `LLM.txt` and north-star docs.
- Define metric registry template and certify top tier-1 metrics.
- Establish sources-of-truth ownership map by domain.
- Normalize docs and remove stale prototype narratives.
- Set baseline data contracts for critical dbt models.

Exit Criteria
- Core governance artifacts approved and in repo.
- Tier-1 metrics have owners, definitions, and SLAs.
- No conflicting system narrative in docs.

## Phase 2 (Days 31-60): Platform Hardening
- Add metadata APIs for tables, columns, metrics, lineage, freshness.
- Enforce read-only query policy with SQL parsing and allowlists.
- Add query limits (timeout, row cap, payload cap, concurrency).
- Add audit logging for all query and chat executions.
- Add RBAC and sensitive-column masking.

Exit Criteria
- LLM and humans use same governed metadata surface.
- Unsafe queries are blocked deterministically.
- Query/audit controls are active in production paths.

## Phase 3 (Days 61-90): Self-Serve Adoption
- Upgrade explorer with ownership, certification, sensitivity, lineage views.
- Add chat provenance panel (sources, metric contracts, freshness, caveats).
- Launch user onboarding for teams and data literacy playbook.
- Track adoption and request deflection metrics.

Exit Criteria
- Teams can self-serve common analytics tasks.
- Provenance is shown for all LLM answers.
- Ad-hoc request volume trend is declining.

## KPI Scorecard
- Pipeline run success rate
- Freshness SLA attainment for tier-1 models
- Certified metric coverage
- Documentation coverage
- Self-serve query adoption
- Ad-hoc request reduction
- Mean time to detect/resolve data incidents
