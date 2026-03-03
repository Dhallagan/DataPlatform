"""FastAPI application for BasedHoc — BrowserBase data warehouse reporting portal."""

import os
import ssl
from pathlib import Path

# Fix broken SSL_CERT_FILE before any HTTP clients are created
_ssl_cert = os.environ.get("SSL_CERT_FILE", "")
if _ssl_cert and not os.path.exists(_ssl_cert):
    os.environ.pop("SSL_CERT_FILE", None)
    os.environ.pop("SSL_CERT_DIR", None)

import uuid
from contextlib import asynccontextmanager
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel

from models.chat import ChatRequest, ChatResponse
from agent.agent import run_agent, run_agent_streaming
from agent.tools.schema import introspect_schema
from agent.tools.query import run_governed_query
from db.database import (
    get_schema_info,
    test_connection,
    get_monitoring_overview,
    get_schema_drift,
    save_schema_baseline,
    get_tables_catalog,
    get_table_metadata,
    get_table_preview,
    get_metrics_catalog,
    get_lineage_for_object,
    search_metadata_catalog,
    get_metadata_catalog_health,
    list_metadata_objects,
    get_llm_context,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Test MotherDuck connection on startup."""
    try:
        if test_connection():
            print("MotherDuck connection verified.")
        else:
            print("WARNING: MotherDuck connection test returned unexpected result.")
    except Exception as e:
        print(f"WARNING: MotherDuck connection failed — {e}")
        print("Set MOTHERDUCK_TOKEN in .env to connect.")
    yield


app = FastAPI(
    title="BasedHoc",
    description="BrowserBase data warehouse reporting portal powered by MotherDuck",
    version="0.3.0",
    lifespan=lifespan,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
LLM_TXT_PATH = REPO_ROOT / "LLM.txt"

# CORS origins can be provided either as FRONTEND_ORIGINS (comma-separated)
# or as a single FRONTEND_ORIGIN value.
frontend_origins_raw = os.getenv("FRONTEND_ORIGINS", "").strip()
if frontend_origins_raw:
    allowed_origins = [origin.strip() for origin in frontend_origins_raw.split(",") if origin.strip()]
else:
    single_origin = os.getenv("FRONTEND_ORIGIN", "").strip()
    allowed_origins = [single_origin] if single_origin else []

if not allowed_origins:
    allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/api/schema")
async def get_schema():
    """Get the data warehouse schema for reference."""
    try:
        schema = get_schema_info()
        return {"schema": schema}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/llm.txt", response_class=PlainTextResponse)
@app.get("/LLM.txt", response_class=PlainTextResponse)
@app.get("/llms.txt", response_class=PlainTextResponse)
async def llm_txt():
    """Serve machine-readable LLM instructions for external agents."""
    if not LLM_TXT_PATH.exists():
        raise HTTPException(status_code=404, detail="LLM.txt not found")
    return LLM_TXT_PATH.read_text(encoding="utf-8")


# =============================================================================
# METADATA ENDPOINTS
# =============================================================================

@app.get("/api/metadata/tables")
async def metadata_tables():
    """List discoverable warehouse tables and basic metadata."""
    try:
        return {"success": True, "catalog": get_tables_catalog()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metadata/tables/{table_ref:path}/preview")
async def metadata_table_preview(table_ref: str, limit: int = 20):
    """Get preview rows for one fully qualified table (schema.table)."""
    try:
        preview = get_table_preview(table_ref, limit=limit)
        if preview is None:
            raise HTTPException(status_code=404, detail=f"Table not found or not allowed: {table_ref}")
        return {"success": True, "preview": preview}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metadata/tables/{table_ref:path}")
async def metadata_table_detail(table_ref: str):
    """Get detailed metadata for one fully qualified table (schema.table)."""
    try:
        metadata = get_table_metadata(table_ref)
        if metadata is None:
            raise HTTPException(status_code=404, detail=f"Table not found or not allowed: {table_ref}")
        return {"success": True, "table": metadata}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metadata/metrics")
async def metadata_metrics():
    """List likely metric objects discovered from warehouse models."""
    try:
        return {"success": True, "catalog": get_metrics_catalog()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metadata/lineage/{object_name}")
async def metadata_lineage(object_name: str):
    """Get lightweight lineage hints for a business object/model."""
    try:
        return {"success": True, "lineage": get_lineage_for_object(object_name)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metadata/search")
async def metadata_search(q: str, limit: int = 25):
    """Search tables and metrics in the central metadata catalog."""
    try:
        return {"success": True, "search": search_metadata_catalog(query=q, limit=limit)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metadata/health")
async def metadata_health():
    """Get central catalog health and freshness summary."""
    try:
        return {"success": True, "health": get_metadata_catalog_health()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metadata/objects")
async def metadata_objects(
    search: str = "",
    domain: str | None = None,
    schema: str | None = None,
    kind: str | None = None,
    owner: str | None = None,
    certified_only: bool = False,
    sort_key: str = "table_key",
    sort_dir: str = "asc",
    page: int = 1,
    page_size: int = 50,
):
    """List metadata objects with filtering, sorting, and pagination."""
    try:
        return {
            "success": True,
            "objects": list_metadata_objects(
                search=search,
                domain=domain,
                schema=schema,
                kind=kind,
                owner=owner,
                certified_only=certified_only,
                sort_key=sort_key,
                sort_dir=sort_dir,
                page=page,
                page_size=page_size,
            ),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metadata/llm-context")
async def metadata_llm_context(
    table_limit: int = 200,
    metric_limit: int = 200,
    column_limit: int = 2000,
):
    """Get compact catalog context for LLM and agent workflows."""
    try:
        return {
            "success": True,
            "context": get_llm_context(
                limit_tables=table_limit,
                limit_metrics=metric_limit,
                limit_columns=column_limit,
            ),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# TOOLS ENDPOINTS
# =============================================================================

@app.get("/api/reports/schema")
async def run_schema_introspection():
    """Execute schema introspection directly."""
    try:
        result = introspect_schema.invoke({})
        return {"success": True, "schema": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CustomQueryParams(BaseModel):
    sql: str
    actor: str | None = None
    request_id: str | None = None


@app.post("/api/reports/query")
async def run_custom_query(params: CustomQueryParams):
    """Execute a custom SQL query directly."""
    try:
        result = run_governed_query(
            sql=params.sql,
            actor=params.actor or "api.reports.query",
            request_id=params.request_id,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# MONITORING ENDPOINTS
# =============================================================================

@app.get("/api/monitoring/overview")
async def monitoring_overview():
    """Get pipeline/data freshness and schema drift summary."""
    try:
        return {"success": True, "overview": get_monitoring_overview()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/monitoring/schema-drift")
async def monitoring_schema_drift():
    """Get schema drift details against stored baseline."""
    try:
        return {"success": True, "drift": get_schema_drift()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/monitoring/schema-baseline")
async def monitoring_save_schema_baseline():
    """Capture current schema as baseline for drift monitoring."""
    try:
        baseline = save_schema_baseline()
        return {"success": True, "baseline": baseline}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CHAT ENDPOINT
# =============================================================================

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message to the chat agent."""
    try:
        # Generate conversation ID if not provided
        conversation_id = request.conversation_id or str(uuid.uuid4())

        # Convert history to dict format if provided
        history = None
        if request.history:
            history = [{"role": msg.role.value, "content": msg.content} for msg in request.history]

        # Run the agent
        result = await run_agent(
            message=request.message,
            history=history,
        )

        return ChatResponse(
            message=result["response"],
            conversation_id=conversation_id,
            tool_calls=result.get("tool_calls"),
            tool_results=result.get("tool_results"),
            data=None,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# STREAMING CHAT ENDPOINT (with extended thinking)
# =============================================================================

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """Stream chat responses with extended thinking visible."""

    async def event_generator():
        try:
            # Convert history to dict format if provided
            history = None
            if request.history:
                history = [{"role": msg.role.value, "content": msg.content} for msg in request.history]

            # Stream the agent response
            async for event in run_agent_streaming(
                message=request.message,
                history=history,
            ):
                # Format as SSE
                yield f"data: {json.dumps(event)}\n\n"

        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
