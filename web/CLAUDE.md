# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BasedHoc is a self-service chat portal for ad-hoc reporting on BrowserBase operational data. Users interact with a chat interface to explore a MotherDuck (DuckDB) data warehouse containing browser sessions, organizations, users, subscriptions, invoices, and pre-built KPI views. The system uses LLM-powered tool calling with schema introspection and dynamic SQL generation.

## Architecture

- **Frontend**: Next.js SPA with TypeScript and Tailwind CSS (`frontend/`)
- **Backend**: FastAPI with LangChain and Pydantic (`backend/`)
- **LLM**: Anthropic Claude via LangChain for tool calling
- **Database**: MotherDuck (cloud DuckDB) with medallion architecture

### Data Warehouse Schemas
- **bronze_supabase**: Raw tables (api_keys, browser_sessions, invoices, organizations, plans, projects, session_events, subscriptions, usage_records, users)
- **silver**: Staging views (stg_sessions, stg_organizations, stg_plans, stg_invoices, etc.)
- **core**: Canonical entities and facts (organizations, sessions/fct_browser_sessions, dim_time, bridge_organization_activity, fct_events, daily_kpis, metric_spine)
- **gtm**: Growth/GTM models (growth_task_queue, signal_trial_conversion_risk_daily, gtm_pipeline_snapshot, gtm_funnel_daily, active_organizations, cohort_retention)
- **fin**: Finance models (mrr, monthly_revenue, finance_budget_vs_actual_monthly, ramp_spend_monthly)
- **pro**: Product models (product_daily, product_kpis, daily_sessions)
- **eng**: Engineering models (engineering_daily, engineering_kpis)
- **ops**: Operations models (ops_daily, ops_kpis)

The LangChain agent has two tools:
- `introspect_schema`: Discover available tables and columns across all warehouse schemas
- `execute_query`: Run read-only DuckDB SQL queries

## Development Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload  # Start dev server on :8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev  # Start dev server on :3000
```

### Environment Setup
Copy `backend/.env.example` to `backend/.env` and add:
- `ANTHROPIC_API_KEY` — your Anthropic API key
- `MOTHERDUCK_TOKEN` — your MotherDuck access token
- `MOTHERDUCK_DATABASE` — database name (default: `browserbase_demo`)

## Key Files

- `backend/agent/agent.py`: LangChain agent setup, system prompt, and execution
- `backend/agent/tools/schema.py`: Schema introspection tool
- `backend/agent/tools/query.py`: SQL query execution tool (with safety checks)
- `backend/db/database.py`: MotherDuck/DuckDB connection and utilities
- `frontend/src/components/ChatPanel.tsx`: Main chat interface
- `frontend/src/components/ChatWindow.tsx`: Alternative chat interface with example prompts
- `frontend/src/lib/reports.ts`: Data tool definitions
