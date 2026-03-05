"""Catalog tools for metadata-first exploration."""

from langchain_core.tools import tool
from db.database import search_metadata_catalog, get_table_metadata, get_metrics_catalog, get_llm_context


@tool
def search_catalog(query: str, limit: int = 20) -> dict:
    """Search central metadata catalog for tables and metrics.

    Use this tool first when users ask what data exists, what metrics are available,
    or which table/model to use.

    Args:
        query: Search text (table, metric, owner, schema)
        limit: Max number of results, capped at 100

    Returns:
        Search result payload with typed entries (`table` or `metric`), owner,
        certification flag, and freshness/grain metadata when available.
    """
    return search_metadata_catalog(query=query, limit=limit)


@tool
def describe_table(table: str) -> dict:
    """Describe one fully-qualified table from central catalog (schema.table)."""
    payload = get_table_metadata(table)
    if payload is None:
        return {
            "success": False,
            "error": f"Table not found or not allowed: {table}",
        }
    return {
        "success": True,
        "table": payload,
    }


@tool
def list_metrics() -> dict:
    """List central metric catalog definitions."""
    return get_metrics_catalog()


@tool
def llm_context(table_limit: int = 200, metric_limit: int = 200, column_limit: int = 2000) -> dict:
    """Return compact catalog context optimized for LLM planning and retrieval."""
    return get_llm_context(
        limit_tables=table_limit,
        limit_metrics=metric_limit,
        limit_columns=column_limit,
    )
