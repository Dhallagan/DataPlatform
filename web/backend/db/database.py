"""Database connection and utilities for BasedHoc (MotherDuck/DuckDB)."""

import os
import json
import duckdb
from datetime import datetime, timezone
from pathlib import Path
from contextlib import contextmanager
from typing import Generator, Any

from dotenv import load_dotenv

load_dotenv()

MOTHERDUCK_TOKEN = os.getenv("MOTHERDUCK_TOKEN", "")
MOTHERDUCK_DATABASE = os.getenv("MOTHERDUCK_DATABASE", "browserbase_demo")
SCHEMA_BASELINE_PATH = Path(__file__).resolve().parent / "schema_baseline.json"
QUERY_AUDIT_LOG_PATH = Path(os.getenv("QUERY_AUDIT_LOG_PATH", str(Path(__file__).resolve().parent / "query_audit.jsonl")))

# Schemas relevant to BrowserBase data.
# Current dbt layout:
# - bronze_supabase (raw replication)
# - silver (staging + core canonical models)
# - analytics domain schemas (growth, product, finance, eng, ops, core)
RELEVANT_SCHEMAS = ["bronze_supabase", "silver", "growth", "product", "finance", "eng", "ops", "core"]


def get_connection() -> duckdb.DuckDBPyConnection:
    """Create a new MotherDuck connection."""
    conn_str = f"md:{MOTHERDUCK_DATABASE}?motherduck_token={MOTHERDUCK_TOKEN}"
    return duckdb.connect(conn_str)


@contextmanager
def get_db() -> Generator[duckdb.DuckDBPyConnection, None, None]:
    """Context manager for database connections."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def test_connection() -> bool:
    """Test that the MotherDuck connection works."""
    with get_db() as conn:
        result = conn.execute("SELECT 1 AS ok").fetchone()
        return result is not None and result[0] == 1


def execute_sql(sql: str, params: tuple = ()) -> list[dict]:
    """Execute SQL and return results as list of dicts."""
    with get_db() as conn:
        cursor = conn.execute(sql, params if params else None)
        if cursor.description is None:
            return []
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        return [dict(zip(columns, row)) for row in rows]


def get_schema_info() -> dict:
    """Get database schema information from MotherDuck information_schema."""
    with get_db() as conn:
        schema_filter = ", ".join(f"'{s}'" for s in RELEVANT_SCHEMAS)
        query = f"""
            SELECT table_schema, table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema IN ({schema_filter})
            ORDER BY table_schema, table_name, ordinal_position
        """
        cursor = conn.execute(query)
        rows = cursor.fetchall()

        schema: dict = {}
        for row in rows:
            table_schema, table_name, column_name, data_type, is_nullable = row
            full_name = f"{table_schema}.{table_name}"
            if full_name not in schema:
                schema[full_name] = []
            schema[full_name].append({
                "name": column_name,
                "type": data_type,
                "nullable": is_nullable == "YES",
            })

        return schema


def _quoted_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def _isoformat(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return str(value)


def _discover_freshness_targets(conn: duckdb.DuckDBPyConnection) -> list[tuple[str, str, str]]:
    schema_filter = ", ".join(f"'{s}'" for s in RELEVANT_SCHEMAS)
    rows = conn.execute(
        f"""
        WITH ranked AS (
            SELECT
                table_schema,
                table_name,
                column_name,
                CASE
                    WHEN column_name = '_loaded_at' THEN 1
                    WHEN column_name = '_calculated_at' THEN 2
                    WHEN column_name = 'triggered_at' THEN 3
                    WHEN column_name = '_synced_at' THEN 4
                    WHEN column_name = 'metric_date' THEN 5
                    WHEN column_name = 'as_of_date' THEN 6
                    WHEN column_name = 'date' THEN 7
                    ELSE 99
                END AS priority
            FROM information_schema.columns
            WHERE table_schema IN ({schema_filter})
              AND column_name IN (
                  '_loaded_at',
                  '_calculated_at',
                  'triggered_at',
                  '_synced_at',
                  'metric_date',
                  'as_of_date',
                  'date'
              )
        )
        SELECT table_schema, table_name, column_name
        FROM ranked
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY table_schema, table_name
            ORDER BY priority
        ) = 1
        ORDER BY table_schema, table_name
        """
    ).fetchall()
    return [(r[0], r[1], r[2]) for r in rows]


def get_monitoring_overview() -> dict:
    """Return freshness and shape metrics used by the monitoring dashboard."""
    with get_db() as conn:
        freshness_targets = _discover_freshness_targets(conn)
        table_stats: list[dict] = []

        for schema, table, freshness_column in freshness_targets:
            q_schema = _quoted_identifier(schema)
            q_table = _quoted_identifier(table)
            q_freshness = _quoted_identifier(freshness_column)
            query = f"""
                SELECT
                    MAX(CAST({q_freshness} AS TIMESTAMP)) AS freshest_at,
                    COUNT(*) AS row_count
                FROM {q_schema}.{q_table}
            """
            freshest_at, row_count = conn.execute(query).fetchone()
            table_stats.append(
                {
                    "table": f"{schema}.{table}",
                    "schema": schema,
                    "freshness_column": freshness_column,
                    "freshest_at": _isoformat(freshest_at),
                    "row_count": int(row_count or 0),
                }
            )

        by_schema: dict[str, dict[str, Any]] = {}
        for item in table_stats:
            schema = item["schema"]
            if schema not in by_schema:
                by_schema[schema] = {
                    "table_count": 0,
                    "freshest_at": None,
                    "stale_tables": 0,
                }
            bucket = by_schema[schema]
            bucket["table_count"] += 1
            freshest_at = item["freshest_at"]
            if freshest_at is None:
                bucket["stale_tables"] += 1
            if freshest_at and (bucket["freshest_at"] is None or freshest_at > bucket["freshest_at"]):
                bucket["freshest_at"] = freshest_at

        schema = get_schema_info()
        baseline_status = get_schema_drift()

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "tables": table_stats,
            "by_schema": by_schema,
            "schema_summary": {
                "table_count": len(schema),
                "column_count": sum(len(cols) for cols in schema.values()),
            },
            "schema_drift": baseline_status,
        }


def _normalize_schema(schema: dict) -> dict:
    normalized: dict[str, list[dict[str, Any]]] = {}
    for table_name, columns in schema.items():
        normalized_columns = []
        for col in columns:
            normalized_columns.append(
                {
                    "name": col["name"],
                    "type": str(col["type"]).lower(),
                    "nullable": bool(col["nullable"]),
                }
            )
        normalized[table_name] = sorted(normalized_columns, key=lambda c: c["name"])
    return normalized


def save_schema_baseline() -> dict:
    """Persist current schema as baseline for drift detection."""
    schema = _normalize_schema(get_schema_info())
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "schemas": RELEVANT_SCHEMAS,
        "tables": schema,
    }
    SCHEMA_BASELINE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def get_schema_baseline() -> dict | None:
    """Load stored schema baseline if available."""
    if not SCHEMA_BASELINE_PATH.exists():
        return None
    return json.loads(SCHEMA_BASELINE_PATH.read_text(encoding="utf-8"))


def get_schema_drift() -> dict:
    """Compare current schema with baseline and return drift deltas."""
    baseline = get_schema_baseline()
    current = _normalize_schema(get_schema_info())
    if baseline is None:
        return {
            "baseline_exists": False,
            "baseline_generated_at": None,
            "added_tables": sorted(list(current.keys())),
            "removed_tables": [],
            "changed_tables": [],
        }

    baseline_tables: dict[str, list[dict[str, Any]]] = baseline.get("tables", {})
    baseline_keys = set(baseline_tables.keys())
    current_keys = set(current.keys())

    added_tables = sorted(list(current_keys - baseline_keys))
    removed_tables = sorted(list(baseline_keys - current_keys))

    changed_tables: list[dict[str, Any]] = []
    for table in sorted(list(current_keys & baseline_keys)):
        current_cols = {c["name"]: c for c in current[table]}
        baseline_cols = {c["name"]: c for c in baseline_tables[table]}
        added_cols = sorted(list(set(current_cols.keys()) - set(baseline_cols.keys())))
        removed_cols = sorted(list(set(baseline_cols.keys()) - set(current_cols.keys())))

        type_or_nullable_changes = []
        for col in sorted(list(set(current_cols.keys()) & set(baseline_cols.keys()))):
            curr = current_cols[col]
            base = baseline_cols[col]
            if curr["type"] != base["type"] or curr["nullable"] != base["nullable"]:
                type_or_nullable_changes.append(
                    {
                        "column": col,
                        "baseline_type": base["type"],
                        "current_type": curr["type"],
                        "baseline_nullable": base["nullable"],
                        "current_nullable": curr["nullable"],
                    }
                )

        if added_cols or removed_cols or type_or_nullable_changes:
            changed_tables.append(
                {
                    "table": table,
                    "added_columns": added_cols,
                    "removed_columns": removed_cols,
                    "changed_columns": type_or_nullable_changes,
                }
            )

    return {
        "baseline_exists": True,
        "baseline_generated_at": baseline.get("generated_at"),
        "added_tables": added_tables,
        "removed_tables": removed_tables,
        "changed_tables": changed_tables,
    }


def _schema_filter_sql() -> str:
    return ", ".join(f"'{s}'" for s in RELEVANT_SCHEMAS)


def get_tables_catalog() -> dict:
    """List warehouse tables with lightweight metadata for explorer/chat discovery."""
    with get_db() as conn:
        table_rows = conn.execute(
            f"""
            SELECT
                table_schema,
                table_name,
                COUNT(*) AS column_count
            FROM information_schema.columns
            WHERE table_schema IN ({_schema_filter_sql()})
            GROUP BY 1, 2
            ORDER BY 1, 2
            """
        ).fetchall()

        freshness_targets = _discover_freshness_targets(conn)
        freshness_target_map = {(schema, table): column for schema, table, column in freshness_targets}

        freshness_map: dict[tuple[str, str], str | None] = {}
        for schema, table, freshness_column in freshness_targets:
            q_schema = _quoted_identifier(schema)
            q_table = _quoted_identifier(table)
            q_freshness = _quoted_identifier(freshness_column)
            freshest_at = conn.execute(
                f"""
                SELECT MAX(CAST({q_freshness} AS TIMESTAMP))
                FROM {q_schema}.{q_table}
                """
            ).fetchone()[0]
            freshness_map[(schema, table)] = _isoformat(freshest_at)

        tables = []
        for schema, table, column_count in table_rows:
            tables.append(
                {
                    "table": f"{schema}.{table}",
                    "table_schema": schema,
                    "table_name": table,
                    "column_count": int(column_count or 0),
                    "freshness_column": freshness_target_map.get((schema, table)),
                    "freshest_at": freshness_map.get((schema, table)),
                }
            )

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "schemas": RELEVANT_SCHEMAS,
            "table_count": len(tables),
            "tables": tables,
        }


def get_table_metadata(table_ref: str) -> dict | None:
    """Get detailed table metadata for a fully qualified table name."""
    if "." not in table_ref:
        return None
    schema, table = table_ref.split(".", 1)
    if schema not in RELEVANT_SCHEMAS:
        return None

    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT
                column_name,
                data_type,
                is_nullable,
                ordinal_position
            FROM information_schema.columns
            WHERE table_schema = ?
              AND table_name = ?
            ORDER BY ordinal_position
            """,
            (schema, table),
        ).fetchall()

        if not rows:
            return None

        columns = [
            {
                "name": column_name,
                "type": data_type,
                "nullable": is_nullable == "YES",
                "ordinal_position": int(ordinal_position or 0),
            }
            for column_name, data_type, is_nullable, ordinal_position in rows
        ]

        freshness_targets = _discover_freshness_targets(conn)
        freshness_column = None
        freshest_at = None
        for target_schema, target_table, target_col in freshness_targets:
            if target_schema == schema and target_table == table:
                freshness_column = target_col
                q_schema = _quoted_identifier(schema)
                q_table = _quoted_identifier(table)
                q_freshness = _quoted_identifier(target_col)
                freshest_at = _isoformat(
                    conn.execute(
                        f"""
                        SELECT MAX(CAST({q_freshness} AS TIMESTAMP))
                        FROM {q_schema}.{q_table}
                        """
                    ).fetchone()[0]
                )
                break

        return {
            "table": table_ref,
            "table_schema": schema,
            "table_name": table,
            "column_count": len(columns),
            "columns": columns,
            "freshness_column": freshness_column,
            "freshest_at": freshest_at,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }


def get_metrics_catalog() -> dict:
    """Return metrics catalog, preferring certified registry when available."""
    with get_db() as conn:
        try:
            registry_rows = conn.execute(
                """
                SELECT
                    metric_name,
                    certified,
                    business_definition,
                    sql_definition_or_model,
                    grain,
                    owner,
                    freshness_sla,
                    quality_tests,
                    version,
                    effective_date
                FROM core.metric_registry
                ORDER BY metric_name
                """
            ).fetchall()
            metrics = [
                {
                    "metric_name": row[0],
                    "certified": bool(row[1]),
                    "business_definition": row[2],
                    "sql_definition_or_model": row[3],
                    "grain": row[4],
                    "owner": row[5],
                    "freshness_sla": row[6],
                    "quality_tests": row[7],
                    "version": row[8],
                    "effective_date": _isoformat(row[9]),
                    "source": "core.metric_registry",
                }
                for row in registry_rows
            ]
            return {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "metric_count": len(metrics),
                "source": "core.metric_registry",
                "metrics": metrics,
            }
        except Exception:
            rows = conn.execute(
                f"""
                SELECT DISTINCT
                    table_schema,
                    table_name
                FROM information_schema.columns
                WHERE table_schema IN ({_schema_filter_sql()})
                ORDER BY 1, 2
                """
            ).fetchall()

            metric_keywords = ("metric", "kpi", "mrr", "revenue", "retention", "funnel", "snapshot", "daily_kpis")
            metrics = []
            for schema, table in rows:
                lower = table.lower()
                if any(keyword in lower for keyword in metric_keywords):
                    full_name = f"{schema}.{table}"
                    metrics.append(
                        {
                            "metric_object": full_name,
                            "table_schema": schema,
                            "table_name": table,
                            "certified": schema == "core" or "kpi" in lower or "metric" in lower,
                            "source": "heuristic_discovery",
                        }
                    )

            return {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "metric_count": len(metrics),
                "source": "heuristic_discovery",
                "metrics": metrics,
            }


def get_lineage_for_object(object_name: str) -> dict:
    """Return a lightweight lineage hint by matching object token across layers."""
    raw = object_name.strip().lower()
    token = raw.split(".")[-1]
    for prefix in ("stg_", "fct_", "dim_", "v_", "kpi_"):
        if token.startswith(prefix):
            token = token[len(prefix):]
    for suffix in ("_daily", "_monthly", "_snapshot", "_kpis", "_metrics"):
        if token.endswith(suffix):
            token = token[: -len(suffix)]

    with get_db() as conn:
        rows = conn.execute(
            f"""
            SELECT DISTINCT table_schema, table_name
            FROM information_schema.columns
            WHERE table_schema IN ({_schema_filter_sql()})
            ORDER BY 1, 2
            """
        ).fetchall()

        related = []
        for schema, table in rows:
            if token and token in table.lower():
                related.append(f"{schema}.{table}")

        bronze = [name for name in related if name.startswith("bronze_supabase.")]
        silver = [name for name in related if name.startswith("silver.")]
        analytics = [
            name
            for name in related
            if not name.startswith("bronze_supabase.") and not name.startswith("silver.")
        ]

        return {
            "object": object_name,
            "token": token,
            "lineage": {
                "bronze": bronze,
                "silver": silver,
                "analytics": analytics,
            },
            "related_count": len(related),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }


def append_query_audit_event(event: dict[str, Any]) -> None:
    """Append one query-audit event as JSONL for traceability."""
    QUERY_AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(event)
    payload.setdefault("logged_at", datetime.now(timezone.utc).isoformat())
    with QUERY_AUDIT_LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, default=str) + "\n")
