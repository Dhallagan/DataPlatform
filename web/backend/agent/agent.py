"""LangChain agent setup with Claude for BrowserBase data warehouse exploration."""

import os
import json
from typing import Any, AsyncGenerator
from dotenv import load_dotenv
import anthropic
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from agent.tools.schema import introspect_schema
from agent.tools.query import execute_query
from agent.tools.catalog import search_catalog, describe_table, list_metrics, llm_context

load_dotenv()

# System prompt for the BrowserBase data warehouse assistant
SYSTEM_PROMPT = """You are a helpful data analyst assistant for BasedHoc, a reporting portal for BrowserBase operational data stored in a MotherDuck (DuckDB) warehouse.

## Data Warehouse Architecture

The warehouse follows a **medallion architecture** with these schemas:

### Bronze Layer (Raw Data) — `bronze_supabase`
Raw tables ingested from Supabase:
- `api_keys`, `browser_sessions`, `invoices`, `organizations`, `plans`, `projects`
- `session_events`, `subscriptions`, `usage_records`, `users`

### Silver Layer (Cleaned/Staged + Core) — `silver`
Canonical entities and semantic facts:
- `organizations` — Organization entity
- `users` — User entity
- `sessions` — Browser session entity
- `dim_organizations` — Organization dimension
- `dim_users` — User dimension
- `fct_runs` — Browser run facts
- `fct_events` — Session event facts
- `fct_subscriptions` — Subscription facts

### Analytics Domain Schemas
Team-facing aggregates and KPI models:
- `core.daily_kpis`, `core.metric_spine`
- `finance.mrr`, `finance.monthly_revenue`
- `growth.growth_daily`, `growth.growth_kpis`, `growth.cohort_retention`, `growth.active_organizations`
- `eng.engineering_daily`, `eng.engineering_kpis`
- `ops.ops_daily`, `ops.ops_kpis`
- `product.product_daily`, `product.product_kpis`

## SQL Dialect
- This is **DuckDB** (via MotherDuck), not SQLite or Postgres.
- Use fully qualified table names: `schema_name.table_name` (e.g. `core.daily_kpis`).
- DuckDB supports modern SQL: `DATE_TRUNC`, `INTERVAL`, window functions, CTEs, `QUALIFY`, list/struct types, etc.

## Tools
- **introspect_schema**: Discover all tables and columns across the warehouse schemas
- **search_catalog**: Search central catalog for tables/metrics/owners
- **describe_table**: Get detailed table metadata (columns, owner, certification)
- **list_metrics**: List metric definitions from central metric catalog
- **llm_context**: Fetch compact table/metric/column context for agent planning
- **execute_query**: Run read-only SQL queries (SELECT only)

## Guidelines
- Start with `search_catalog` for discovery before writing SQL.
- Use `llm_context` when a user asks broad discovery questions across many objects.
- Use `describe_table` to verify columns/types before query execution.
- Use `list_metrics` for KPI/definition questions.
- Start with `core`, `finance`, `growth`, `eng`, `ops`, or `product` tables for KPI questions.
- Use `silver` tables for canonical entity/fact analysis.
- Drop to `bronze_supabase` only when detailed raw source data is needed.
- When users ask about data structure, use introspect_schema first.
- If a query fails, explain why and suggest alternatives.
- Be concise but thorough in explanations.

## Table-specific rules
- For `finance.mrr`, use `as_of_date` as the time column.
- Never reference a `date` column in `finance.mrr` (it does not exist).
- Prefer these `finance.mrr` fields for MRR analysis:
  `as_of_date`, `total_mrr_usd`, `starter_mrr_usd`, `pro_mrr_usd`,
  `enterprise_mrr_usd`, `total_paying_customers`, `starter_customers`,
  `pro_customers`, `enterprise_customers`, `arpu_usd`.

## IMPORTANT: Response Format
- Tool results are automatically displayed as interactive data cards in the UI.
- DO NOT repeat raw data or tables in your response text — the data is already shown.
- Instead, provide a brief summary or insights about the data.
- Keep responses concise — focus on analysis and next steps, not data listing.
"""


def get_tools() -> list:
    """Get all available tools."""
    return [
        introspect_schema,
        search_catalog,
        describe_table,
        list_metrics,
        llm_context,
        execute_query,
    ]


def create_agent():
    """Create the LangChain agent with Claude."""
    model = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        temperature=0,
        max_tokens=4096,
    )

    # Bind tools to the model
    model_with_tools = model.bind_tools(get_tools())

    return model_with_tools


def convert_messages(history: list[dict]) -> list:
    """Convert message history to LangChain message format."""
    messages = [SystemMessage(content=SYSTEM_PROMPT)]

    for msg in history:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    return messages


async def run_agent(
    message: str,
    history: list[dict] | None = None,
) -> dict[str, Any]:
    """Run the agent with a user message.

    Args:
        message: The user's message
        history: Previous messages in the conversation

    Returns:
        Dictionary with response, tool calls, and results
    """
    agent = create_agent()
    tools = {tool.name: tool for tool in get_tools()}

    # Build message list
    messages = convert_messages(history or [])
    messages.append(HumanMessage(content=message))

    # Run initial response
    response = await agent.ainvoke(messages)

    tool_calls = []
    tool_results = []

    # Process tool calls if any
    while response.tool_calls:
        messages.append(response)

        for tool_call in response.tool_calls:
            tool_name = tool_call["name"]
            tool_args = tool_call["args"]

            tool_calls.append({
                "name": tool_name,
                "args": tool_args,
            })

            # Execute the tool
            tool = tools.get(tool_name)
            if tool:
                result = tool.invoke(tool_args)
                tool_results.append({
                    "tool": tool_name,
                    "result": result,
                })

                # Add tool result to messages
                from langchain_core.messages import ToolMessage
                messages.append(ToolMessage(
                    content=str(result),
                    tool_call_id=tool_call["id"],
                ))

        # Get next response
        response = await agent.ainvoke(messages)

    return {
        "response": response.content,
        "tool_calls": tool_calls if tool_calls else None,
        "tool_results": tool_results if tool_results else None,
    }


def get_tools_schema() -> list[dict]:
    """Get tool schemas in Anthropic format."""
    tools = get_tools()
    schemas = []
    for tool in tools:
        schema = {
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.args_schema.schema() if hasattr(tool, 'args_schema') and tool.args_schema else {"type": "object", "properties": {}},
        }
        schemas.append(schema)
    return schemas


async def run_agent_streaming(
    message: str,
    history: list[dict] | None = None,
) -> AsyncGenerator[dict, None]:
    """Run the agent with streaming and extended thinking.

    Yields SSE events:
    - {"type": "thinking", "content": "..."} - Thinking content
    - {"type": "tool_call", "name": "...", "args": {...}} - Tool being called
    - {"type": "tool_result", "name": "...", "result": {...}} - Tool result
    - {"type": "text", "content": "..."} - Response text chunk
    - {"type": "done", "tool_calls": [...], "tool_results": [...]} - Final event
    """
    client = anthropic.Anthropic()
    tools_map = {tool.name: tool for tool in get_tools()}
    tools_schema = get_tools_schema()

    # Build messages
    messages = []
    for msg in (history or []):
        role = msg.get("role", "user")
        content = msg.get("content", "")
        messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message})

    all_tool_calls = []
    all_tool_results = []

    # Agentic loop with streaming
    while True:
        # Stream response with extended thinking
        thinking_content = ""
        thinking_signature = ""
        text_content = ""
        current_tool_calls = []

        with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=16000,
            thinking={
                "type": "enabled",
                "budget_tokens": 10000,
            },
            system=SYSTEM_PROMPT,
            tools=tools_schema,
            messages=messages,
        ) as stream:
            for event in stream:
                # Handle different event types
                if event.type == "content_block_start":
                    if hasattr(event, 'content_block'):
                        block = event.content_block
                        if block.type == "thinking":
                            thinking_content = ""
                        elif block.type == "tool_use":
                            current_tool_calls.append({
                                "id": block.id,
                                "name": block.name,
                                "args_json": "",
                            })
                            yield {"type": "tool_start", "name": block.name}

                elif event.type == "content_block_delta":
                    if hasattr(event, 'delta'):
                        delta = event.delta
                        if delta.type == "thinking_delta":
                            thinking_content += delta.thinking
                            yield {"type": "thinking", "content": delta.thinking}
                        elif delta.type == "text_delta":
                            text_content += delta.text
                            yield {"type": "text", "content": delta.text}
                        elif delta.type == "input_json_delta":
                            if current_tool_calls:
                                current_tool_calls[-1]["args_json"] += delta.partial_json

                elif event.type == "content_block_stop":
                    pass

            # Get the final message to extract thinking signature
            final_message = stream.get_final_message()
            for block in final_message.content:
                if block.type == "thinking":
                    thinking_signature = block.signature

        # Process tool calls if any
        if current_tool_calls:
            # Parse tool args and execute
            tool_use_blocks = []
            for tc in current_tool_calls:
                try:
                    args = json.loads(tc["args_json"]) if tc["args_json"] else {}
                except json.JSONDecodeError:
                    args = {}

                tc["args"] = args
                all_tool_calls.append({"name": tc["name"], "args": args})

                yield {"type": "tool_call", "name": tc["name"], "args": args}

                # Execute tool
                tool = tools_map.get(tc["name"])
                if tool:
                    try:
                        result = tool.invoke(args)
                    except Exception as e:
                        result = {"error": str(e)}
                else:
                    result = {"error": f"Unknown tool: {tc['name']}"}

                all_tool_results.append({"tool": tc["name"], "result": result})
                yield {"type": "tool_result", "tool": tc["name"], "result": result}

                tool_use_blocks.append({
                    "type": "tool_use",
                    "id": tc["id"],
                    "name": tc["name"],
                    "input": args,
                })

            # Add assistant message with tool use and tool results
            assistant_content = []
            if thinking_content and thinking_signature:
                assistant_content.append({
                    "type": "thinking",
                    "thinking": thinking_content,
                    "signature": thinking_signature,
                })
            if text_content:
                assistant_content.append({"type": "text", "text": text_content})
            assistant_content.extend(tool_use_blocks)

            messages.append({"role": "assistant", "content": assistant_content})

            # Add tool results
            tool_result_content = []
            for i, tc in enumerate(current_tool_calls):
                tool_result_content.append({
                    "type": "tool_result",
                    "tool_use_id": tc["id"],
                    "content": json.dumps(all_tool_results[-(len(current_tool_calls)-i)]["result"]),
                })
            messages.append({"role": "user", "content": tool_result_content})

        else:
            # No more tool calls, we're done
            break

    yield {
        "type": "done",
        "content": text_content,
        "tool_calls": all_tool_calls if all_tool_calls else None,
        "tool_results": all_tool_results if all_tool_results else None,
    }


# For testing
if __name__ == "__main__":
    import asyncio

    async def test():
        result = await run_agent("What tables are available in the database?")
        print(result)

    asyncio.run(test())
