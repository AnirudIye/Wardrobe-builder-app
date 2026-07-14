from __future__ import annotations

import logging
from typing import List, Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

# Provider-agnostic text completion used by every text-AI feature (vision
# tagging, outfit/buy-next reasoning, trends, DresserAI chat). Prefers
# Anthropic when its key is configured, otherwise Google Gemini — so either
# key alone lights up all AI features. Best-effort like every other external
# service: returns None on no keys / any failure, never raises.


def _real_key(value: str) -> str:
    """Treat obvious .env.example placeholders (e.g. "sk-ant-...") as unset."""
    v = (value or "").strip()
    if not v or "..." in v or "change-me" in v.lower() or v.lower().startswith("your"):
        return ""
    return v


def anthropic_key() -> str:
    return _real_key(get_settings().anthropic_api_key)


def google_key() -> str:
    return _real_key(get_settings().google_api_key)


def available() -> bool:
    return bool(anthropic_key() or google_key())


def complete(
    *,
    prompt: Optional[str] = None,
    messages: Optional[List[dict]] = None,
    system: Optional[str] = None,
    images: Optional[List[bytes]] = None,
    max_tokens: int = 512,
) -> Optional[str]:
    """Run a text completion on whichever provider has a key.

    Exactly one of `prompt` (single-turn) or `messages` (multi-turn chat with
    {role: "user"|"assistant", content: str} dicts) must be given. `images`
    are JPEG bytes attached before the prompt (single-turn only).

    Tries Anthropic first when both keys are set; if the preferred provider
    fails, falls through to the other before giving up.
    """
    result: Optional[str] = None
    if anthropic_key():
        result = _anthropic_complete(prompt, messages, system, images, max_tokens)
    if result is None and google_key():
        result = _gemini_complete(prompt, messages, system, images, max_tokens)
    return result


def _anthropic_complete(prompt, messages, system, images, max_tokens) -> Optional[str]:
    try:
        import base64

        import anthropic

        settings = get_settings()
        if messages is None:
            content: list = []
            for img in images or []:
                content.append(
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": base64.standard_b64encode(img).decode("utf-8"),
                        },
                    }
                )
            content.append({"type": "text", "text": prompt})
            messages = [{"role": "user", "content": content if images else prompt}]

        client = anthropic.Anthropic(api_key=anthropic_key())
        kwargs = dict(model=settings.anthropic_model, max_tokens=max_tokens, messages=messages)
        if system:
            kwargs["system"] = system
        response = client.messages.create(**kwargs)
        text = "".join(
            b.text for b in response.content if getattr(b, "type", None) == "text"
        ).strip()
        return text or None
    except Exception as exc:
        logger.warning("Anthropic completion failed: %s", exc)
        return None


def _gemini_complete(prompt, messages, system, images, max_tokens) -> Optional[str]:
    try:
        from google import genai
        from google.genai import types

        settings = get_settings()
        client = genai.Client(api_key=google_key())

        if messages is not None:
            # Multi-turn chat: map assistant -> model (Gemini's role name).
            contents = [
                types.Content(
                    role="model" if m["role"] == "assistant" else "user",
                    parts=[types.Part.from_text(text=m["content"])],
                )
                for m in messages
            ]
        else:
            parts = [
                types.Part.from_bytes(data=img, mime_type="image/jpeg")
                for img in (images or [])
            ]
            parts.append(types.Part.from_text(text=prompt))
            contents = [types.Content(role="user", parts=parts)]

        response = client.models.generate_content(
            model=settings.google_text_model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                # Gemini counts internal "thinking" tokens against the output
                # budget, so give generous headroom or replies come back empty.
                max_output_tokens=max(max_tokens, 2048),
            ),
        )
        text = (response.text or "").strip()
        return text or None
    except Exception as exc:
        logger.warning("Gemini completion failed: %s", exc)
        return None
