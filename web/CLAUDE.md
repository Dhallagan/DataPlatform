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
- **silver_core**: Cleaned dims/facts (dim_org, dim_user, core_sessions, fct_browser_run, fct_event, fct_subscription)
- **gold_marts**: Pre-aggregated team fact tables (fct_daily_sessions, fct_monthly_revenue, fct_engineering_daily, fct_growth_daily, fct_ops_daily, fct_product_daily)
- **gold_metrics**: KPI views (v_daily_kpis, v_mrr, v_cohort_retention, v_active_organizations, v_growth_kpis, v_engineering_kpis, v_ops_kpis, v_product_kpis)

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
