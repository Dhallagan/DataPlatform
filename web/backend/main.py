"""FastAPI application for BasedHoc — BrowserBase data warehouse reporting portal."""

import os
import ssl

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
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from models.chat import ChatRequest, ChatResponse
from agent.agent import run_agent, run_agent_streaming
from agent.tools.schema import introspect_schema
from agent.tools.query import execute_query
from db.database import (
    get_schema_info,
    test_connection,
    get_monitoring_overview,
    get_schema_drift,
    save_schema_baseline,
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


@app.post("/api/reports/query")
async def run_custom_query(params: CustomQueryParams):
    """Execute a custom SQL query directly."""
    try:
        result = execute_query.invoke({"sql": params.sql})
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
