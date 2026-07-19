from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import User

logger = logging.getLogger(__name__)

# Subscription statuses Stripe considers "active enough" to grant the paid plan.
_ACTIVE_STATUSES = {"active", "trialing"}


class BillingError(RuntimeError):
    """Raised when a billing operation cannot be completed."""


def _stripe():
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise BillingError("Stripe is not configured")
    import stripe

    stripe.api_key = settings.stripe_secret_key
    return stripe


def ensure_customer(db: Session, user: User) -> str:
    """Return the user's Stripe customer id, creating the customer if needed."""
    if user.stripe_customer_id:
        return user.stripe_customer_id
    stripe = _stripe()
    customer = stripe.Customer.create(email=user.email, metadata={"user_id": str(user.id)})
    user.stripe_customer_id = customer["id"]
    db.commit()
    return customer["id"]


def create_checkout_session(db: Session, user: User) -> str:
    """Create a Stripe Checkout session for the $5/mo plan; return its URL."""
    settings = get_settings()
    if not settings.stripe_price_id:
        raise BillingError("Stripe price id is not configured")
    stripe = _stripe()
    customer_id = ensure_customer(db, user)
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        client_reference_id=str(user.id),
        line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
        success_url=f"{settings.frontend_base_url}/billing/success",
        cancel_url=f"{settings.frontend_base_url}/billing/cancel",
    )
    return session["url"]


def create_portal_session(db: Session, user: User) -> str:
    """Create a Stripe Customer Portal session; return its URL."""
    settings = get_settings()
    stripe = _stripe()
    if not user.stripe_customer_id:
        raise BillingError("No Stripe customer for this user")
    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=f"{settings.frontend_base_url}/billing",
    )
    return session["url"]


def _find_user(db: Session, customer_id: Optional[str], user_id: Optional[str]) -> Optional[User]:
    if customer_id:
        user = db.execute(
            select(User).where(User.stripe_customer_id == customer_id)
        ).scalar_one_or_none()
        if user is not None:
            return user
    if user_id:
        try:
            return db.get(User, int(user_id))
        except (ValueError, TypeError):
            return None
    return None


def apply_subscription_event(db: Session, event: dict) -> Optional[User]:
    """Update a user's plan from a Stripe event object. Returns the affected user.

    This is the testable core of webhook handling - it takes a parsed Stripe
    event dict and is independent of signature verification / transport.
    """
    event_type = event.get("type", "")
    obj = (event.get("data") or {}).get("object") or {}

    customer_id = obj.get("customer")
    user_id = obj.get("client_reference_id") or (obj.get("metadata") or {}).get("user_id")
    user = _find_user(db, customer_id, user_id)
    if user is None:
        logger.warning("Stripe event %s references unknown user", event_type)
        return None

    # Newly-created customer id (e.g. from checkout.session.completed).
    if customer_id and not user.stripe_customer_id:
        user.stripe_customer_id = customer_id

    if event_type in ("customer.subscription.deleted",):
        user.plan = "free"
        user.subscription_status = obj.get("status", "canceled")
    elif event_type in (
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
    ):
        status_value = obj.get("status")
        # checkout.session.completed doesn't carry a subscription status; treat as active.
        if event_type == "checkout.session.completed":
            status_value = status_value or "active"
        user.subscription_status = status_value
        user.plan = "paid" if status_value in _ACTIVE_STATUSES else "free"
        period_end = obj.get("current_period_end")
        if isinstance(period_end, (int, float)):
            user.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)

    db.commit()
    db.refresh(user)
    return user


def verify_and_parse_webhook(payload: bytes, signature: str) -> dict:
    """Verify the Stripe signature and return the parsed event dict."""
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise BillingError("Stripe webhook secret is not configured")
    stripe = _stripe()
    try:
        return stripe.Webhook.construct_event(
            payload, signature, settings.stripe_webhook_secret
        )
    except Exception as exc:  # signature or parse failure
        raise BillingError(f"Invalid webhook: {exc}") from exc
