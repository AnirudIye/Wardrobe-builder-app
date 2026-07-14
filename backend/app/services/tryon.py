from __future__ import annotations

import logging
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

_PROMPT = (
    "Show the person from the first image wearing the exact clothing item from the "
    "second image. Keep their face, body shape, pose, and background unchanged — only "
    "replace the relevant garment. Photorealistic, natural lighting, high quality."
)


def generate_tryon(person_image_bytes: bytes, garment_image_bytes: bytes) -> Optional[bytes]:
    """Composite a garment onto a person's photo via Gemini image generation.

    Best-effort: returns None (never raises) when no API key is configured or
    the call fails, so the router can respond with a friendly message.
    """
    settings = get_settings()
    if not settings.google_api_key:
        return None
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.google_api_key)
        response = client.models.generate_content(
            model=settings.google_image_model,
            contents=[
                types.Part.from_bytes(data=person_image_bytes, mime_type="image/jpeg"),
                types.Part.from_bytes(data=garment_image_bytes, mime_type="image/jpeg"),
                _PROMPT,
            ],
        )
        for candidate in response.candidates or []:
            for part in candidate.content.parts or []:
                inline = getattr(part, "inline_data", None)
                if inline is not None and inline.data:
                    return inline.data
        return None
    except Exception as exc:  # network/SDK/no-image-in-response errors
        logger.warning("TryOn generation failed: %s", exc)
        return None
