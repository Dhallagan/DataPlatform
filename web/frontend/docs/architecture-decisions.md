# BrowserBase Architecture Decisions

This document explains the design choices behind the current BrowserBase analytics platform. It is intentionally opinionated: the goal is not to describe every possible architecture, but to explain why this one exists, what problems it solves, and how to keep it healthy as the system grows.

## 1) Product and Workflow Decision: Terminal-First

We moved to a terminal-first analytics UX because our core users do not think in terms of static dashboard tabs; they think in terms of operating questions:

- "What changed this month?"
- "Which domain owns the regression?"
- "Which customers are impacted?"

The terminal command model (`OV`, `SC`, `GTM`, `FIN`, `OPS`, `CUS`, `META`, `ABOUT`) makes navigation and intent explicit. It reduces click-path ambiguity and creates a shared language between operators, analysts, and engineers. When someone says "run `OV` then `CUS <id>`," that is both product behavior and team process.

## 2) Architecture Boundary Decision: Split Frontend and Backend

We kept a clear split:

- `web/frontend` (Next.js): UX, routing, terminal affordances, and request orchestration.
- `web/backend` (FastAPI): governed query execution, metadata APIs, and operational endpoints.

This boundary makes ownership clear and keeps high-risk logic (query validation, warehouse access, API keys, governance rules) server-side. The frontend remains fast to iterate without leaking data-access controls into browser code.

## 3) API Routing Decision: Frontend Rewrite to Backend

The frontend uses a rewrite (`/api/:path* -> NEXT_PUBLIC_BACKEND_URL/api/:path*`). This gives us:

- a single-origin browser experience (fewer CORS/auth headaches),
- stable frontend code (`fetch('/api/...')` everywhere),
- deploy flexibility (swap backend URL per environment without changing app code).

This is why local dev and cloud deployment both work with the same frontend fetch paths.

## 4) Data Modeling Decision: Canonical Terminal Models

We standardized on explicit terminal-facing marts (`term.*` and scorecard models) rather than ad hoc model reads from many places. This protects consistency:

- `term.business_snapshot_monthly` for overview board,
- domain-aligned terminal datasets for GTM/Finance/Ops/Product,
- canonical scorecard outputs for executive review.

Result: every terminal surface maps to explicit contract models with known grain and expected fields. The UI is predictable because model semantics are predictable.

## 5) Governance Decision: Read-Only Query Guardrails

Custom query execution is intentionally constrained in backend validation:

- one statement only,
- read-only `SELECT`,
- schema allowlists and auditing.

This was a conscious tradeoff: we accept less SQL flexibility in exchange for safer operations and clearer observability. We also learned to design frontend queries to fit those rules (for example, avoiding blocked patterns in runtime endpoints and favoring explicit `SELECT` shapes).

## 6) Reliability Decision: Graceful Degradation in the UI

Terminal pages use safe query wrappers and explicit empty states so the interface does not crash when data is missing, delayed, or partially unavailable. This is not "hide all errors"; it is "preserve operator flow under imperfect data conditions."

The companion principle is to still surface context (empty notices, stale status, monitoring views) so users know what happened and what to do next.

## 7) Discoverability Decision: One Function Registry

We centralized function definitions in `terminalFunctions.ts` and drive multiple UI surfaces from it:

- command parsing,
- typeahead suggestions,
- sidebar function buttons,
- cheatsheet listings.

This avoids drift. A function should not exist in one place and disappear in another. We already used this pattern to hide certain functions (`PROD`, `BS`) from visible UI while keeping parser behavior deliberate and explicit.

## 8) Navigation Decision: Terminal as Default Home

We changed `/` to redirect to `/terminal`, while preserving chat at `/chat` with a direct button from terminal header. This reflects actual usage priorities:

- primary workflow starts in operations/decision mode,
- conversational analysis remains one click away.

The architecture supports both without forcing users into one mental model.

## 9) Deployment Decision: Monorepo Subdirectory Deploy

We deploy directly from the `DataPlatform` repo with subdirectory roots:

- Vercel root: `web/frontend`,
- Render root: `web/backend`.

This kept existing production URLs while avoiding repo duplication. It also means platform changes and data-model changes can ship together when needed, while still preserving explicit deploy roots.

## 10) Documentation Decision: Decision Narrative, Not Just Specs

We added this decision narrative because architecture quality decays when rationale is tribal knowledge. Specs tell you "what exists"; decision docs tell you "why this exists." Teams need both.

Use this document as the operator's guide for future changes:

- If a change improves local convenience but breaks model contracts, reject it.
- If a change adds a new surface, wire it through the shared function registry.
- If a change touches query behavior, validate against backend governance constraints.
- If a change affects home routing, preserve direct access to both terminal and chat.

## Implementation Best Practices We Followed

- Keep one source of truth for navigable commands.
- Prefer explicit model contracts over UI-derived semantics.
- Fail soft in UI, fail strict in data/governance boundaries.
- Deploy from one repo with explicit service roots.
- Preserve user-facing links during migrations (change internals before URLs).
- Document architectural decisions near the code, not in private notes.

If you continue extending this system, treat these principles as constraints, not suggestions. They are the reasons this architecture remains understandable under rapid iteration.
