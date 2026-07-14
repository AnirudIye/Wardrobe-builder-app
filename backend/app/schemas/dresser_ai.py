from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatIn(BaseModel):
    # Full running transcript, including the new user message. Not persisted
    # server-side — the client is the sole holder of chat history.
    messages: List[ChatMessage] = Field(min_length=1, max_length=40)


class ChatOut(BaseModel):
    reply: str
