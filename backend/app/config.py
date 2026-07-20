from __future__ import annotations

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Values that must never sign production JWTs (defaults and .env.example copy).
_PLACEHOLDER_SECRETS = {
    "dev-insecure-secret-change-me",
    "change-me-to-a-long-random-string",
}


class Settings(BaseSettings):
    """Application settings, loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Core
    environment: str = "dev"  # "dev" | "production" - gates docs, HSTS, create_all
    database_url: str = "sqlite:///./wardrobe.db"
    jwt_secret: str = "dev-insecure-secret-change-me"
    jwt_expire_minutes: int = 10080  # 7 days
    jwt_algorithm: str = "HS256"

    # Media / storage
    media_dir: str = "./media"
    public_base_url: str = "http://localhost:8000"
    storage_backend: str = "local"  # "local" | "s3" (S3-compatible, incl. Cloudflare R2)
    s3_bucket: str = ""
    s3_endpoint_url: str = ""  # R2: https://<account_id>.r2.cloudflarestorage.com
    s3_region: str = "auto"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_public_base_url: str = ""  # e.g. https://pub-xxxx.r2.dev or a CDN domain

    # Security
    # Comma-separated string, NOT a list - pydantic-settings JSON-parses list
    # fields from env vars, which is a footgun for simple comma values.
    cors_origins: str = ""
    rate_limit_enabled: bool = True
    # Per-account login lockout (core/lockout.py); shares the switch above.
    login_lockout_attempts: int = 8
    login_lockout_minutes: int = 15

    # AI (Anthropic Claude)
    anthropic_api_key: str = ""
    # Cheapest capable model per call site (alias resolves to the current Haiku 4.5).
    anthropic_model: str = "claude-haiku-4-5"

    # Weather
    openweather_api_key: str = ""

    # Shopping
    serpapi_key: str = ""

    # Billing (Stripe)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""
    frontend_base_url: str = "http://localhost:5173"
    # OAuth client id for "Sign in with Google" (Google Cloud console ->
    # Credentials -> OAuth client ID, type Web). Unset = button hidden.
    google_oauth_client_id: str = ""

    # AI (Google Gemini - TryOn image generation, and all text AI when no
    # Anthropic key is configured)
    google_api_key: str = ""
    google_image_model: str = "gemini-2.5-flash-image"
    # Auto-updating alias for the cheapest capable text model. Newer AI Studio
    # keys can't use 2.x text models, and full flash models spend heavily on
    # "thinking" tokens; lite is fast and fits the app's cheapest-model policy.
    google_text_model: str = "gemini-flash-lite-latest"

    # Quota (buy-next is metered per DAY; chat and tryon per trailing week)
    free_daily_recommendation_limit: int = 5
    free_weekly_chat_limit: int = 20
    free_weekly_tryon_limit: int = 5

    # Email (signup confirmation + password reset). All optional; when unset,
    # email features degrade gracefully (signups auto-verify).
    # Brevo HTTP API is preferred when its key is set - required on hosts that
    # block outbound SMTP entirely (e.g. Render's free tier). The sender
    # address is still SMTP_FROM (must be a verified sender in Brevo).
    brevo_api_key: str = ""
    # Email (SMTP - signup confirmation). All optional; when unset, email
    # verification is skipped and new users are auto-verified (best-effort,
    # like every other integration).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_starttls: bool = True
    email_verify_expire_minutes: int = 1440  # 24h
    password_reset_expire_minutes: int = 60

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origin_list(self) -> list:
        if self.cors_origins:
            return [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return [self.frontend_base_url]

    @model_validator(mode="after")
    def _enforce_production_posture(self) -> "Settings":
        """Refuse to start in production with an insecure or incomplete config."""
        if self.is_production:
            if self.jwt_secret in _PLACEHOLDER_SECRETS or len(self.jwt_secret) < 32:
                raise ValueError(
                    "ENVIRONMENT=production requires a strong JWT_SECRET "
                    "(>= 32 chars, not a placeholder). Generate one with: "
                    'python -c "import secrets; print(secrets.token_urlsafe(32))"'
                )
            if not self.cors_origins:
                raise ValueError(
                    "ENVIRONMENT=production requires explicit CORS_ORIGINS "
                    "(comma-separated allowed origins)."
                )
        if self.storage_backend == "s3" and not (self.s3_bucket and self.s3_public_base_url):
            raise ValueError(
                "STORAGE_BACKEND=s3 requires S3_BUCKET and S3_PUBLIC_BASE_URL."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
