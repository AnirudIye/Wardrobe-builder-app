from __future__ import annotations

from pydantic import BaseModel


class TryOnOut(BaseModel):
    image_base64: str  # PNG, ready to render as data:image/png;base64,<...>
