from __future__ import annotations

import base64
import json
import logging
import re
from typing import List, Optional

from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.schemas.garment import GarmentTags

logger = logging.getLogger(__name__)

_PROMPT = """You are a fashion cataloguing assistant. This image shows a single \
clothing item. Reply with ONLY a JSON object (no prose, no markdown fences) using \
exactly these keys:
- "category": one of "top","bottom","outerwear","dress","footwear","accessory","underwear","other"
- "subcategory": short label like "t-shirt","chinos","trench coat", or null
- "colors": array of 1-3 dominant colour names, lowercase
- "pattern": e.g. "solid","striped","plaid","floral","graphic", or null
- "material": best-guess fabric like "cotton","denim","wool","leather", or null
- "formality": one of "athletic","casual","smart-casual","business","formal"
- "warmth_rating": integer 1 (very light, hot weather) to 5 (very warm, freezing weather)
- "seasons": array drawn from "spring","summer","fall","winter"
Return only the JSON object."""


class _VisionTags(BaseModel):
    category: Optional[str] = None
    subcategory: Optional[str] = None
    colors: List[str] = []
    pattern: Optional[str] = None
    material: Optional[str] = None
    formality: Optional[str] = None
    warmth_rating: Optional[int] = None
    seasons: List[str] = []


def _extract_json(text: str) -> Optional[dict]:
    """Pull the first JSON object out of model text, tolerating ``` fences."""
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else text
    brace = candidate.find("{")
    if brace == -1:
        return None
    try:
        return json.loads(candidate[brace:])
    except json.JSONDecodeError:
        return None


def auto_tag(image_bytes: bytes) -> GarmentTags:
    """Best-effort AI tagging of a garment image.

    Returns empty tags (never raises) when no API key is configured or the call
    fails, so uploads keep working without an Anthropic key.
    """
    settings = get_settings()
    if not settings.anthropic_api_key:
        return GarmentTags()

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": b64,
                            },
                        },
                        {"type": "text", "text": _PROMPT},
                    ],
                }
            ],
        )
        text = "".join(
            block.text for block in response.content if getattr(block, "type", None) == "text"
        )
        data = _extract_json(text)
        if data is None:
            logger.warning("Vision tagging returned unparseable output")
            return GarmentTags()
        parsed = _VisionTags.model_validate(data)
    except ValidationError as exc:
        logger.warning("Vision tagging failed schema validation: %s", exc)
        return GarmentTags()
    except Exception as exc:  # network/auth/SDK errors — degrade gracefully
        logger.warning("Vision tagging call failed: %s", exc)
        return GarmentTags()

    warmth = parsed.warmth_rating
    if warmth is not None:
        warmth = max(1, min(5, warmth))
    return GarmentTags(
        category=parsed.category,
        subcategory=parsed.subcategory,
        colors=parsed.colors or [],
        pattern=parsed.pattern,
        material=parsed.material,
        formality=parsed.formality,
        warmth_rating=warmth,
        seasons=parsed.seasons or [],
    )
