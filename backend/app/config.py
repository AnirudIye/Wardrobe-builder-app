from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Core
    database_url: str = "sqlite:///./wardrobe.db"
    jwt_secret: str = "dev-insecure-secret-change-me"
    jwt_expire_minutes: int = 10080  # 7 days
    jwt_algorithm: str = "HS256"

    # Media / storage
    media_dir: str = "./media"
    public_base_url: str = "http://localhost:8000"

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

    # AI (Google Gemini — TryOn image generation, and all text AI when no
    # Anthropic key is configured)
    google_api_key: str = ""
    google_image_model: str = "gemini-2.5-flash-image"
    # Auto-updating alias for the cheapest capable text model. Newer AI Studio
    # keys can't use 2.x text models, and full flash models spend heavily on
    # "thinking" tokens; lite is fast and fits the app's cheapest-model policy.
    google_text_model: str = "gemini-flash-lite-latest"

    # Quota
    free_weekly_recommendation_limit: int = 5
    free_weekly_chat_limit: int = 20
    free_weekly_tryon_limit: int = 5

    # Email (SMTP — signup confirmation). All optional; when unset, email
    # verification is skipped and new users are auto-verified (best-effort,
    # like every other integration).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_starttls: bool = True
    email_verify_expire_minutes: int = 1440  # 24h


@lru_cache
def get_settings() -> Settings:
    return Settings()
