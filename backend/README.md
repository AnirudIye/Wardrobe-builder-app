# Wardrobe Builder — Backend (FastAPI)

Python API for the Wardrobe Builder app: auth, wardrobe (photo upload + AI tagging),
weather-aware outfit recommendations, buy-next shopping suggestions, and Stripe billing.

## Requirements

- Python 3.9+ (developed on 3.9)
- No native compiler needed — all deps install from prebuilt wheels.

> **Windows + Anaconda note:** if `pip`/SSL fails inside the venv, prepend Anaconda's
> `Library\bin` to `PATH` before running pip/python:
> `Library\bin` contains the OpenSSL DLLs the venv doesn't copy.

## Setup

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    |    macOS/Linux: source .venv/bin/activate
pip install --only-binary :all: -r requirements.txt   # prebuilt wheels only
cp .env.example .env                                  # then fill in keys
```

Generate a JWT secret: `python -c "import secrets; print(secrets.token_urlsafe(32))"`

## Run

```bash
uvicorn app.main:app --reload
```

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Test

```bash
pytest -q
```

## Database

- **Dev:** SQLite (`DATABASE_URL=sqlite:///./wardrobe.db`). Tables are auto-created on
  startup via `Base.metadata.create_all` — no migration step needed to get going.
- **Production (Postgres):** switch `DATABASE_URL` and introduce **Alembic** migrations
  (planned; not yet wired). The ORM models are already Postgres-compatible.

## Layout

```
app/
  config.py        # env-driven settings (pydantic-settings)
  database.py      # engine, SessionLocal, Base, get_db
  core/
    security.py    # password hashing + JWT
    deps.py        # get_current_user, oauth2 scheme
  models/          # SQLAlchemy models (User, ...)
  schemas/         # Pydantic request/response models
  routers/         # FastAPI routers (auth, ...)
  main.py          # app factory, CORS, static media, routers
tests/             # pytest (in-memory SQLite per test)
```
