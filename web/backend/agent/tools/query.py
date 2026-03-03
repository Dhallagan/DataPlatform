"""Query execution tool for running governed ad-hoc DuckDB SQL queries."""

import os
import json
import uuid
from datetime import datetime, timezone
from sqlglot import exp, parse
from langchain_core.tools import tool
from db.database import execute_sql, RELEVANT_SCHEMAS, append_query_audit_event


MAX_QUERY_CHARS = int(os.getenv("MAX_QUERY_CHARS", "20000"))
MAX_QUERY_ROWS = int(os.getenv("MAX_QUERY_ROWS", "500"))
MAX_PAYLOAD_BYTES = int(os.getenv("MAX_QUERY_PAYLOAD_BYTES", "1000000"))


def _allowed_schemas() -> set[str]:
    return set(RELEVANT_SCHEMAS)


def _extract_table_references(statement: exp.Expression) -> tuple[list[str], list[str]]:
    cte_names = set()
    for cte in statement.find_all(exp.CTE):
        alias = cte.alias_or_name
        if alias:
            cte_names.add(alias.lower())

    tables: list[str] = []
    violations: list[str] = []
    for table in statement.find_all(exp.Table):
        table_name = (table.name or "").strip()
        table_schema = (table.db or "").strip()
        if table_name.lower() in cte_names:
            continue
        if not table_schema:
            violations.append(table_name or "<unknown>")
            continue
        full_name = f"{table_schema}.{table_name}"
        tables.append(full_name)
        if table_schema not in _allowed_schemas():
            violations.append(full_name)
    return sorted(set(tables)), sorted(set(violations))


def validate_query(sql: str) -> tuple[bool, str, list[str], str]:
    """Validate query with parser-based rules and schema allowlist."""
    raw = (sql or "").strip()
    if not raw:
        return False, "Query is empty.", [], ""
    if len(raw) > MAX_QUERY_CHARS:
        return False, f"Query exceeds max length ({MAX_QUERY_CHARS} chars).", [], ""

    try:
        statements = parse(raw, read="duckdb")
    except Exception as exc:
        return False, f"SQL parse error: {exc}", [], ""

    if len(statements) != 1:
        return False, "Only a single SQL statement is allowed.", [], ""

    statement = statements[0]
    if not isinstance(statement, exp.Select):
        return False, "Only read-only SELECT statements are allowed.", [], ""

    tables, violations = _extract_table_references(statement)
    if violations:
        return (
            False,
            "Use fully qualified table names from allowed schemas only.",
            tables,
            "",
        )

    normalized_sql = raw[:-1].strip() if raw.endswith(";") else raw
    return True, "", tables, normalized_sql


def _apply_row_limit(sql: str) -> str:
    return f"SELECT * FROM ({sql}) AS governed_query LIMIT {MAX_QUERY_ROWS}"


def _trim_payload_to_size(rows: list[dict]) -> tuple[list[dict], bool]:
    if not rows:
        return rows, False
    payload_size = len(json.dumps(rows, default=str).encode("utf-8"))
    if payload_size <= MAX_PAYLOAD_BYTES:
        return rows, False

    trimmed: list[dict] = []
    current_size = 2
    for row in rows:
        encoded_row = json.dumps(row, default=str).encode("utf-8")
        additional = len(encoded_row) + (1 if trimmed else 0)
        if current_size + additional > MAX_PAYLOAD_BYTES:
            break
        trimmed.append(row)
        current_size += additional
    return trimmed, True


def run_governed_query(sql: str, actor: str = "agent.execute_query", request_id: str | None = None) -> dict:
    request_ref = request_id or str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)

    is_valid, validation_error, tables, normalized_sql = validate_query(sql)
    if not is_valid:
        append_query_audit_event(
            {
                "request_id": request_ref,
                "actor": actor,
                "status": "blocked",
                "error": validation_error,
                "tables": tables,
                "started_at": started_at.isoformat(),
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "row_count": 0,
            }
        )
        return {
            "success": False,
            "error": validation_error,
            "data": None,
            "columns": None,
            "row_count": 0,
            "truncated": False,
            "request_id": request_ref,
        }

    limited_sql = _apply_row_limit(normalized_sql)
    try:
        results = execute_sql(limited_sql)
        results, truncated = _trim_payload_to_size(results)
        columns = list(results[0].keys()) if results else []
        append_query_audit_event(
            {
                "request_id": request_ref,
                "actor": actor,
                "status": "success",
                "error": None,
                "tables": tables,
                "started_at": started_at.isoformat(),
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "row_count": len(results),
                "truncated": truncated,
            }
        )
        return {
            "success": True,
            "data": results,
            "columns": columns,
            "row_count": len(results),
            "error": None,
            "truncated": truncated,
            "request_id": request_ref,
        }
    except Exception as exc:
        append_query_audit_event(
            {
                "request_id": request_ref,
                "actor": actor,
                "status": "failed",
                "error": str(exc),
                "tables": tables,
                "started_at": started_at.isoformat(),
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "row_count": 0,
            }
        )
        return {
            "success": False,
            "error": str(exc),
            "data": None,
            "columns": None,
            "row_count": 0,
            "truncated": False,
            "request_id": request_ref,
        }


@tool
def execute_query(sql: str) -> dict:
    """Execute a read-only DuckDB SQL query against the MotherDuck warehouse.

    Use this tool to run custom SQL queries. Only SELECT queries are allowed.
    Use fully qualified table names: schema_name.table_name
    (e.g. core.daily_kpis, silver.dim_organizations).

    This is DuckDB SQL — supports DATE_TRUNC, INTERVAL, window functions,
    CTEs, QUALIFY, list/struct types, etc.
    Table-specific reminder: `finance.mrr` uses `as_of_date` (not `date`).

    Args:
        sql: The SQL query to execute. Must be a SELECT statement.

    Returns:
        A dictionary with:
        - success: boolean indicating if the query succeeded
        - data: list of result rows as dictionaries (if successful)
        - columns: list of column names (if successful)
        - row_count: number of rows returned
        - error: error message (if failed)
    """
    return run_governed_query(sql=sql, actor="agent.execute_query")
