#!/usr/bin/env python3
"""Generate metadata catalog seed files from dbt artifacts."""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path


def relation_name(node: dict) -> str:
    schema = str(node.get("schema") or "").strip()
    alias = str(node.get("alias") or node.get("name") or "").strip()
    if schema and alias:
        return f"{schema}.{alias}"
    return alias or node.get("unique_id", "unknown")


def build_lookup(manifest: dict) -> dict[str, dict]:
    lookup: dict[str, dict] = {}
    for section in ("nodes", "sources", "seeds"):
        for unique_id, payload in manifest.get(section, {}).items():
            lookup[unique_id] = payload
    return lookup


def generate_lineage_rows(manifest: dict) -> list[dict[str, str]]:
    lookup = build_lookup(manifest)
    rows: list[dict[str, str]] = []
    generated_at = datetime.now(timezone.utc).isoformat()

    for unique_id, node in manifest.get("nodes", {}).items():
        if node.get("resource_type") != "model":
            continue
        if node.get("package_name") != "browserbase_warehouse":
            continue

        child_object = relation_name(node)
        child_resource_type = str(node.get("resource_type") or "model")
        for parent_id in node.get("depends_on", {}).get("nodes", []):
            parent = lookup.get(parent_id)
            if not parent:
                continue
            parent_object = relation_name(parent)
            parent_resource_type = str(parent.get("resource_type") or "unknown")
            rows.append(
                {
                    "child_unique_id": unique_id,
                    "child_object": child_object,
                    "child_resource_type": child_resource_type,
                    "parent_unique_id": parent_id,
                    "parent_object": parent_object,
                    "parent_resource_type": parent_resource_type,
                    "generated_at": generated_at,
                }
            )
    return rows


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "child_unique_id",
        "child_object",
        "child_resource_type",
        "parent_unique_id",
        "parent_object",
        "parent_resource_type",
        "generated_at",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate metadata catalog seed from dbt manifest.")
    parser.add_argument(
        "--manifest",
        default="warehouse/target/manifest.json",
        help="Path to dbt manifest.json",
    )
    parser.add_argument(
        "--lineage-out",
        default="warehouse/seeds/metadata/metadata_lineage_catalog.csv",
        help="Path to lineage seed CSV output",
    )
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        raise SystemExit(f"Manifest not found: {manifest_path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    lineage_rows = generate_lineage_rows(manifest)
    write_csv(Path(args.lineage_out), lineage_rows)
    print(f"Wrote {len(lineage_rows)} lineage rows to {args.lineage_out}")


if __name__ == "__main__":
    main()
