from __future__ import annotations

from starlette.datastructures import MutableHeaders

# Pure-ASGI middleware (not BaseHTTPMiddleware): appending response headers at
# the ASGI layer avoids BaseHTTPMiddleware's streaming pitfalls and also covers
# the mounted /media StaticFiles sub-app.


class SecurityHeadersMiddleware:
    """Attach standard security headers to every HTTP response.

    HSTS is opt-in (production only) — sending it from a plain-HTTP dev server
    would poison localhost for every other project on this machine.
    """

    def __init__(self, app, *, hsts: bool = False) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.setdefault("X-Content-Type-Options", "nosniff")
                headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
                headers.setdefault("X-Frame-Options", "DENY")
                # Camera must stay allowed for same-origin: TryOn uses getUserMedia.
                headers.setdefault(
                    "Permissions-Policy", "camera=(self), microphone=(), geolocation=()"
                )
                if self.hsts:
                    headers.setdefault(
                        "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
                    )
            await send(message)

        await self.app(scope, receive, send_wrapper)
