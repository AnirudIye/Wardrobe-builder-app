from __future__ import annotations

from datetime import date as date_type

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import get_current_user
from app.database import get_db
from app.models.calendar_event import CalendarEvent
from app.models.user import User
from app.routers.recommendations import _best_effort_weather, _user_garments, _user_prefs
from app.schemas.dresser_ai import ChatIn, ChatOut
from app.services import dresser_ai, quota

router = APIRouter(prefix="/dresser-ai", tags=["dresser-ai"])


@router.post("/chat", response_model=ChatOut)
def chat(
    payload: ChatIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatOut:
    settings = get_settings()
    quota.enforce(db, current_user, "dresser-ai", settings.free_weekly_chat_limit)  # 402 first

    garments = _user_garments(db, current_user)
    snapshot = _best_effort_weather(current_user, None, None)
    todays_events = list(
        db.execute(
            select(CalendarEvent).where(
                CalendarEvent.user_id == current_user.id,
                CalendarEvent.date == date_type.today(),
            )
        ).scalars().all()
    )

    reply = dresser_ai.chat_reply(
        messages=[m.model_dump() for m in payload.messages],
        garments=garments,
        weather=snapshot,
        events=todays_events,
        prefs=_user_prefs(current_user),
    )
    quota.record(db, current_user, "dresser-ai")
    return ChatOut(reply=reply or dresser_ai.FALLBACK_REPLY)
