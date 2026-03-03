#!/usr/bin/env python3
"""Simple workflow runner for local development."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent
REGISTRY_PATH = ROOT / "specs" / "registry.json"


def load_registry() -> List[Dict[str, Any]]:
    with REGISTRY_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def get_workflow(workflow_id: str) -> Dict[str, Any]:
    registry = load_registry()
    for workflow in registry:
        if workflow["id"] == workflow_id:
            return workflow
    raise ValueError(f"Workflow '{workflow_id}' not found in registry")


def import_runner(code_path: str):
    module_file = (ROOT.parent / code_path).resolve()
    module_name = module_file.stem
    spec = importlib.util.spec_from_file_location(module_name, module_file)
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to load workflow module from '{code_path}'")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_workflow(workflow_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    workflow = get_workflow(workflow_id)
    runner_module = import_runner(workflow["code_path"])
    if not hasattr(runner_module, "run"):
        raise AttributeError(f"Workflow module '{workflow['code_path']}' has no run(context) function")

    context = {
        "workflow": workflow,
        "payload": payload,
    }
    return runner_module.run(context)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run registered workflows")
    parser.add_argument("--list", action="store_true", help="List workflow ids")
    parser.add_argument("--workflow", type=str, help="Workflow id to run")
    parser.add_argument(
        "--payload",
        type=str,
        default="{}",
        help="JSON payload passed into workflow context",
    )
    args = parser.parse_args()

    if args.list:
        for item in load_registry():
            print(f"{item['id']}: {item['name']}")
        return

    if not args.workflow:
        raise SystemExit("Pass --workflow <workflow_id> or use --list")

    payload = json.loads(args.payload)
    result = run_workflow(args.workflow, payload)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
