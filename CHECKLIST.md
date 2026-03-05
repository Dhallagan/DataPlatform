# Atomic Checklist: Foundational Data Platform

## Governance and Direction
- [ ] Keep `NORTH_STAR.md` current and reviewed monthly.
- [ ] Keep `LLM.txt` current with policy and response contract changes.
- [ ] Remove or archive stale narratives that conflict with canonical docs.
- [ ] Define and publish document ownership and last-reviewed metadata.

## Metadata and Semantic Layer
- [ ] Create metadata tables: `table_catalog`, `column_catalog`, `metric_catalog`, `lineage_catalog`.
- [ ] Ingest dbt artifacts (`manifest.json`, `catalog.json`) into metadata tables.
- [ ] Capture owner, sensitivity, certification, and freshness per object.
- [ ] Define tier-1 certified metric contracts with owners and SLAs.

## Backend and Query Safety
- [ ] Add metadata endpoints for tables, metrics, lineage, and freshness.
- [ ] Enforce schema/table allowlist in query execution path.
- [ ] Replace regex-only SQL validation with parser-based read-only enforcement.
- [ ] Add query timeout, row caps, payload caps, and concurrency controls.
- [ ] Implement query audit logs (actor, query, tables, status, latency, row_count).

## Access and Security
- [ ] Add RBAC checks for chat, explorer, and query endpoints.
- [ ] Add sensitive-column masking/redaction policies.
- [ ] Verify least-privilege service credentials for warehouse access.

## UX and Self-Serve
- [ ] Show provenance in every chat answer.
- [ ] Show freshness timestamps in query/report cards.
- [ ] Add explorer fields: owner, certified status, sensitivity, lineage links.
- [ ] Add guided fallback flows when the LLM cannot safely answer.

## Reliability and Operations
- [ ] Add dbt contract tests for critical models.
- [ ] Add freshness and schema drift alerts with severity and routing.
- [ ] Publish incident runbooks for drift/freshness/query failures.
- [ ] Add CI gates for contract and quality regression.

## Adoption and Org Scale
- [ ] Define quarterly platform KPIs and review cadence.
- [ ] Track self-serve adoption and ad-hoc request deflection.
- [ ] Draft first-hire role scorecards after foundation KPIs are stable.
