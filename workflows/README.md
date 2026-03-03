# Workflows Hub

This folder is the foundation for time-based and event-based agentic workflows.

## Purpose

- Define workflows as data (`specs/`)
- Implement workflow logic as code (`agents/`)
- Run workflows from a registry (`runner.py`)

## Structure

- `specs/registry.json`: source of truth for workflows shown in UI
- `specs/*.json`: per-workflow spec files
- `agents/*.py`: executable workflow handlers
- `templates/workflow_template.py`: starter template for new workflows

## Trigger Model

Every workflow must use one trigger mode:

- `time`: cron/scheduled cycle (`daily`, `weekly`, `monthly`, etc.)
- `event`: emitted business event (`new_lead_created`, `invoice_overdue`, etc.)

## Minimal Workflow Contract

Each workflow should define:

- `trigger`
- `inputs`
- `decision_policy`
- `actions`
- `human_checkpoint`
- `kpis`
- `owner`

## Run Example

```bash
python3 workflows/runner.py --list
python3 workflows/runner.py --workflow daily_growth_digest
```
