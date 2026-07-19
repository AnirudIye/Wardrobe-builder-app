from __future__ import annotations

from datetime import date as date_type
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.calendar_event import CalendarEvent
from app.models.user import User
from app.schemas.calendar import EventCreate, EventOut, EventUpdate

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _get_owned_event(db: Session, user: User, event_id: int) -> CalendarEvent:
    event = db.get(CalendarEvent, event_id)
    if event is None or event.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalendarEvent:
    event = CalendarEvent(user_id=current_user.id, **payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/events", response_model=List[EventOut])
def list_events(
    from_date: Optional[date_type] = Query(default=None, alias="from"),
    to_date: Optional[date_type] = Query(default=None, alias="to"),
    limit: Optional[int] = Query(default=None, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[CalendarEvent]:
    # No params returns everything (the SPA caches the full list); limit/offset
    # page through the same date order for API consumers at scale.
    query = select(CalendarEvent).where(CalendarEvent.user_id == current_user.id)
    if from_date is not None:
        query = query.where(CalendarEvent.date >= from_date)
    if to_date is not None:
        query = query.where(CalendarEvent.date <= to_date)
    query = query.order_by(CalendarEvent.date, CalendarEvent.id).offset(offset)
    if limit is not None:
        query = query.limit(limit)
    return list(db.execute(query).scalars().all())


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(
    event_id: int,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalendarEvent:
    event = _get_owned_event(db, current_user, event_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete(
    "/events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    event = _get_owned_event(db, current_user, event_id)
    db.delete(event)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
