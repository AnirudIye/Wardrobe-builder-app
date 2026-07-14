from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.services import billing, quota
from app.services.billing import BillingError

router = APIRouter(prefix="/billing", tags=["billing"])


class BillingStatus(BaseModel):
    plan: str
    subscription_status: Optional[str] = None
    remaining_this_week: Optional[int] = None  # None = unlimited (paid); buy-next
    weekly_limit: int
    chat_remaining_this_week: Optional[int] = None  # None = unlimited (paid)
    chat_weekly_limit: int
    tryon_remaining_this_week: Optional[int] = None  # None = unlimited (paid)
    tryon_weekly_limit: int


class CheckoutOut(BaseModel):
    url: str


@router.get("/status", response_model=BillingStatus)
def billing_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BillingStatus:
    from app.config import get_settings

    settings = get_settings()
    return BillingStatus(
        plan=current_user.plan,
        subscription_status=current_user.subscription_status,
        remaining_this_week=quota.remaining(
            db, current_user, "buy-next", settings.free_weekly_recommendation_limit
        ),
        weekly_limit=settings.free_weekly_recommendation_limit,
        chat_remaining_this_week=quota.remaining(
            db, current_user, "dresser-ai", settings.free_weekly_chat_limit
        ),
        chat_weekly_limit=settings.free_weekly_chat_limit,
        tryon_remaining_this_week=quota.remaining(
            db, current_user, "tryon", settings.free_weekly_tryon_limit
        ),
        tryon_weekly_limit=settings.free_weekly_tryon_limit,
    )


@router.post("/checkout", response_model=CheckoutOut)
def checkout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CheckoutOut:
    try:
        return CheckoutOut(url=billing.create_checkout_session(db, current_user))
    except BillingError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc


@router.post("/portal", response_model=CheckoutOut)
def portal(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CheckoutOut:
    try:
        return CheckoutOut(url=billing.create_portal_session(db, current_user))
    except BillingError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def webhook(
    request: Request,
    stripe_signature: str = Header(default="", alias="Stripe-Signature"),
    db: Session = Depends(get_db),
) -> dict:
    payload = await request.body()
    try:
        event = billing.verify_and_parse_webhook(payload, stripe_signature)
    except BillingError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    billing.apply_subscription_event(db, event)
    return {"received": True}
