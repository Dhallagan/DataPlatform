# PRD: Executive-Grade Terminal Coverage & Data Completeness

## Document Control
- Owner: GTM + Data Platform + Product Engineering
- Date: March 5, 2026
- Status: Draft for implementation
- Source of findings: Playwright MCP walkthrough of `http://127.0.0.1:3000` terminal flows

## 1) Problem Statement
The terminal UX is structurally strong, but decision-readiness is inconsistent because several functions have sparse or zero-heavy data, partial empty states, and limited context for executive decisions.

For executive usage, each function must answer:
1. What happened?
2. Why did it happen?
3. What should we do next?

Today, multiple surfaces answer only (1), and some not reliably.

## 2) Test Scope and Observed State
Routes tested (all HTTP 200 after rebuild):
- `/terminal`
- `/terminal/executive`
- `/terminal/gtm`
- `/terminal/growth`
- `/terminal/product`
- `/terminal/finance`
- `/terminal/ops`
- `/terminal/meta`

Commands tested:
- `OV`, `OV.LM`, `OV.THIS`, `SC`, `BS`, `GTM`, `FIN`, `PROD`, `OPS`, `META`, `META DICT`, `META SCHEMA`, `META ONTOLOGY`, `CUS.acme`

Key observed gaps:
- Overview (`/terminal`): high zero-value prevalence and missing organization rows.
- Growth (`/terminal/growth`): explicit unavailable/empty signals in multiple sections.
- Finance (`/terminal/finance`): many zero-value fields (high noise vs actionable signal).
- Product + Ops: core KPIs present, but low density and limited segmentation/root cause context.
- Customer drill (`CUS.<org>`): valid routing, but drill often returns all-zero profile metrics.
- Metadata panels route correctly but still read as holding-function content, not complete operating documentation.

## 3) Product Goal
Make the terminal the default executive operating system for weekly business review.

Success definition: an executive can make GTM, finance, product, and reliability decisions in under 10 minutes without leaving the terminal.

## 4) Functional Requirements by Terminal Function

### OV / BS (Overview / Business Snapshot)
- Show complete monthly scoreboard for last 12 months with non-null values for core KPIs.
- Organization leaderboard must return populated rows for selected month (minimum 20 orgs where available).
- Add variance deltas: MoM and vs plan for Revenue, Spend, Gross Margin, Run Success.
- If data missing, show model/source freshness and actionable remediation link.

### SC / EXE (Executive)
- Preserve 15 KPI tile concept but enforce complete KPI population.
- Add trigger-state labels (`healthy`, `watch`, `action`) with threshold logic.
- Add direct drill links to GTM/Finance/Product/Ops for each KPI.

### GTM
- Populate funnel and pipeline with stage-level breakdowns and conversion rates.
- Add campaign efficiency by channel (spend, CAC, SQL rate, payback proxy).
- Add top-customer monetization with trend, not point-in-time only.

### Growth
- Remove empty sections by backfilling required upstream models.
- Add demand-to-revenue chain: leads -> opps -> wins -> revenue.
- Add unit economics (CAC, payback months, LTV/CAC proxy) with confidence flags.

### FIN
- Reduce zero-heavy KPI surface by filtering/annotating non-operational null buckets.
- Add budget ownership view by function and variance driver decomposition.
- Add concentration risk views (vendor/source/customer) with thresholds and alerts.

### PROD
- Add feature-level adoption trends (WAU/MAU, activation, retention proxy).
- Add reliability decomposition by failure mode and impacted org cohort.
- Add release/change correlation layer for performance regressions.

### OPS
- Add queue/backlog depth, retry churn, and incident linkage.
- Add segmentation by environment, workflow type, plan tier, and region.
- Replace any empty table sections with minimum viable operational rows or explicit TODO ownership.

### META (DICT / SCHEMA / ONTOLOGY)
- Upgrade from holding page to operating metadata hub:
  - metric definitions + owner + SQL lineage
  - source model freshness/SLA
  - ontology navigation with business-domain index
- Add search and direct jump from KPI tile to metric definition.

### CUS.<org>
- Guarantee non-empty profile for known orgs in production dataset.
- Show 30/90-day trends for revenue, usage, reliability, and support risk.
- Add benchmark context against org cohort.

## 5) Data Completeness Requirements (Hard Gates)
The following must pass before executive rollout:
- Core executive KPIs: >= 95% non-null over trailing 90 days.
- Overview leaderboard: selected month must return rows when source model has records.
- Growth and customer drill: no critical card may default to all-zero unless explicitly true and annotated.
- Freshness SLA visible for each function (e.g., last loaded timestamp).

## 6) UX and Usability Requirements
- Command latency: p95 < 2.5s from submit to first paint.
- Data loading state shown within 150ms, never blank screen.
- Command feedback: always echo interpreted command and destination function.
- Empty states must include:
  - reason (`missing upstream model`, `no rows for month`, etc.)
  - owner
  - remediation action/button

## 7) Instrumentation Requirements
Track and expose:
- `command_submitted`, `command_resolved_route`, `command_failed`
- `tile_rendered`, `tile_empty`, `tile_out_of_sla`
- `drill_opened`, `drill_no_data`
- Page-level data freshness and query duration

## 8) Delivery Plan
### Phase 1: Reliability + completeness baseline (1 sprint)
- Eliminate empty critical cards in OV, Growth, CUS.
- Add freshness and explicit no-data diagnostics everywhere.

### Phase 2: Executive decision depth (1-2 sprints)
- Add driver analysis and threshold states to SC/EXE, FIN, GTM.
- Add segmentation and cohort context in PROD/OPS/CUS.

### Phase 3: Metadata operating layer (1 sprint)
- Deliver full DICT/SCHEMA/ONTOLOGY integration and search.

## 9) Acceptance Criteria
1. All terminal routes and commands above return successfully with no broken navigation.
2. No critical KPI card is blank or unexplained.
3. Executive weekly review can be completed end-to-end inside terminal without external dashboard dependency.
4. Metadata drill from KPI to definition/lineage works for all executive KPIs.

## 10) Out of Scope (This PRD)
- New standalone BI dashboard builds outside terminal.
- Re-architecting the visual shell/navigation paradigm.

