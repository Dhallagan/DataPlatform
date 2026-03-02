#!/usr/bin/env python3
"""Validate dbt model/schema contracts from manifest.json."""

from __future__ import annotations

import json
from pathlib import Path


EXPECTED_MODELS = {
    "stg_organizations": "silver",
    "organizations": "silver",
    "sessions": "silver",
    "fct_runs": "silver",
    "signal_trial_conversion_risk_daily": "growth",
    "growth_task_queue": "growth",
    "action_log": "growth",
    "daily_kpis": "core",
    "metric_spine": "core",
    "mrr": "finance",
}


def main() -> None:
    manifest_path = Path(__file__).resolve().parent.parent / "warehouse" / "target" / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"Manifest not found: {manifest_path}. Run `dbt parse` first.")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    nodes = manifest.get("nodes", {})

    found: dict[str, str] = {}
    for node in nodes.values():
        if node.get("resource_type") != "model":
            continue
        model_name = node.get("name")
        schema_name = node.get("schema")
        if model_name in EXPECTED_MODELS:
            found[model_name] = schema_name

    errors: list[str] = []
    for model_name, expected_schema in EXPECTED_MODELS.items():
        actual = found.get(model_name)
        if actual is None:
            errors.append(f"missing model: {model_name}")
            continue
        if actual != expected_schema:
            errors.append(f"schema mismatch for {model_name}: expected={expected_schema}, actual={actual}")

    if errors:
        print("Schema contract check FAILED:")
        for err in errors:
            print(f"- {err}")
        raise SystemExit(1)

    print("Schema contract check PASSED.")
    for model_name in sorted(EXPECTED_MODELS):
        print(f"- {model_name}: {found[model_name]}")


if __name__ == "__main__":
    main()
