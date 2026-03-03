"""Query execution tool for running ad-hoc DuckDB SQL queries."""

import re
from langchain_core.tools import tool
from db.database import execute_sql


# Patterns that indicate potentially dangerous operations
DANGEROUS_PATTERNS = [
    r"\bDROP\b",
    r"\bDELETE\b",
    r"\bTRUNCATE\b",
    r"\bINSERT\b",
    r"\bUPDATE\b",
    r"\bALTER\b",
    r"\bCREATE\b",
    r"\bGRANT\b",
    r"\bREVOKE\b",
    r"\bATTACH\b",
    r"\bDETACH\b",
    r"\bCOPY\b",
]


def is_safe_query(sql: str) -> tuple[bool, str]:
    """Check if a query is safe to execute (read-only)."""
    sql_upper = sql.upper()
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, sql_upper):
            return False, f"Query contains forbidden operation: {pattern.strip(chr(92)).strip('b')}"
    return True, ""


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
    # Validate the query
    is_safe, error_msg = is_safe_query(sql)
    if not is_safe:
        return {
            "success": False,
            "error": error_msg,
            "data": None,
            "columns": None,
            "row_count": 0,
        }

    try:
        results = execute_sql(sql)
        columns = list(results[0].keys()) if results else []
        return {
            "success": True,
            "data": results,
            "columns": columns,
            "row_count": len(results),
            "error": None,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "data": None,
            "columns": None,
            "row_count": 0,
        }
