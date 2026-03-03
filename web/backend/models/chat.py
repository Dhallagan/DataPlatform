"""Chat models for API request/response."""

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Message(BaseModel):
    """A single message in the conversation."""
    role: MessageRole
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    tool_results: list[dict[str, Any]] | None = None


class ChatRequest(BaseModel):
    """Request to send a message to the chat agent."""
    message: str = Field(..., description="The user's message")
    conversation_id: str | None = Field(None, description="Optional conversation ID for multi-turn")
    history: list[Message] | None = Field(None, description="Previous messages in the conversation")


class ChatResponse(BaseModel):
    """Response from the chat agent."""
    message: str = Field(..., description="The assistant's response")
    conversation_id: str = Field(..., description="Conversation ID for follow-up messages")
    tool_calls: list[dict[str, Any]] | None = Field(None, description="Tools that were called")
    tool_results: list[dict[str, Any]] | None = Field(None, description="Results from tool calls")
    data: dict[str, Any] | None = Field(None, description="Structured data (e.g., report results)")
