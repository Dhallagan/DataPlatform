#!/usr/bin/env python3
"""Validate dbt model/schema contracts from manifest.json."""

from __future__ import annotations

import json
from pathlib import Path


# model_name -> expected_schema
EXPECTED_MODELS = {
    "stg_organizations": "silver",
    "organizations": "core",
    "sessions": "core",
    "dim_time": "core",
    "bridge_organization_activity": "core",
    "signal_trial_conversion_risk_daily": "gtm",
    "growth_task_queue": "gtm",
    "action_log": "gtm",
    "daily_kpis": "core",
    "metric_spine": "core",
    "mrr": "fin",
}

# model_name -> expected physical alias (only for models where alias != name)
EXPECTED_ALIASES = {
    "sessions": "fct_browser_sessions",
    "growth_daily": "agg_growth_daily",
    "growth_kpis": "kpi_growth",
    "signal_thresholds": "cfg_signal_thresholds",
    "active_organizations": "agg_active_organizations",
    "cohort_retention": "agg_cohort_retention_weekly",
    "daily_sessions": "agg_sessions_daily",
    "product_daily": "agg_product_daily",
    "product_kpis": "kpi_product",
    "engineering_daily": "agg_engineering_daily",
    "engineering_kpis": "kpi_engineering",
    "ops_daily": "agg_ops_daily",
    "ops_kpis": "kpi_ops",
    "finance_budget_vs_actual_monthly": "agg_budget_vs_actual_monthly",
    "monthly_revenue": "agg_revenue_monthly",
    "mrr": "snap_mrr",
    "ramp_spend_monthly": "agg_spend_monthly",
    "ramp_vendor_spend_monthly": "agg_vendor_spend_monthly",
    "fct_terminal_exec_daily": "terminal_exec_daily",
    "fct_terminal_customer_daily": "terminal_customer_daily",
    "fct_terminal_product_daily": "terminal_product_daily",
    "fct_terminal_gtm_daily": "terminal_gtm_daily",
    "fct_terminal_finance_monthly": "terminal_finance_monthly",
}


def main() -> None:
    manifest_path = Path(__file__).resolve().parent.parent / "warehouse" / "target" / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"Manifest not found: {manifest_path}. Run `dbt parse` first.")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    nodes = manifest.get("nodes", {})

    found_schemas: dict[str, str] = {}
    found_aliases: dict[str, str] = {}
    for node in nodes.values():
        if node.get("resource_type") != "model":
            continue
        model_name = node.get("name")
        schema_name = node.get("schema")
        alias = node.get("alias", model_name)
        if model_name in EXPECTED_MODELS:
            found_schemas[model_name] = schema_name
        if model_name in EXPECTED_ALIASES:
            found_aliases[model_name] = alias

    errors: list[str] = []

    # Check schema assignments
    for model_name, expected_schema in EXPECTED_MODELS.items():
        actual = found_schemas.get(model_name)
        if actual is None:
            errors.append(f"missing model: {model_name}")
            continue
        if actual != expected_schema:
            errors.append(f"schema mismatch for {model_name}: expected={expected_schema}, actual={actual}")

    # Check physical alias names
    for model_name, expected_alias in EXPECTED_ALIASES.items():
        actual = found_aliases.get(model_name)
        if actual is None:
            errors.append(f"missing model for alias check: {model_name}")
            continue
        if actual != expected_alias:
            errors.append(f"alias mismatch for {model_name}: expected={expected_alias}, actual={actual}")

    if errors:
        print("Schema contract check FAILED:")
        for err in errors:
            print(f"- {err}")
        raise SystemExit(1)

    print("Schema contract check PASSED.")
    print("\nSchema assignments:")
    for model_name in sorted(EXPECTED_MODELS):
        print(f"  {model_name}: {found_schemas[model_name]}")
    print("\nAlias assignments:")
    for model_name in sorted(EXPECTED_ALIASES):
        if model_name in found_aliases:
            print(f"  {model_name} -> {found_aliases[model_name]}")


if __name__ == "__main__":
    main()
