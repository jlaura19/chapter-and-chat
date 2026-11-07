# Book Club API (FastAPI)

FastAPI backend for the Book Club app. It replaces the earlier Spring Boot service. The frontend in `../frontend` talks to it through the `/api` and `/ws` paths.

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Set `JWT_SECRET` in `.env` before running anywhere but local development:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## Database

- **Development (default):** SQLite at `sqlite:///./bookclub.db`.
- **PostgreSQL:** set `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/bookclub`. The `psycopg[binary]` driver is already in `requirements.txt`.

Tables are created at startup with `Base.metadata.create_all`. Alembic is not set up yet, so schema changes to an existing database need a manual migration until it is added.

## Run

```powershell
uvicorn app.main:app --reload --port 8000
```

Run **one worker only** (do not pass `--workers`). WebSocket fan-out uses an in-process hub (`app/realtime.py`). Multiple workers would split the connections, so scaling out needs a shared broker such as Redis first.

The Vite dev server and preview proxy `/api` and `/ws` to `http://localhost:8000`.

## Tests

```powershell
pytest -q
```

Tests use a temporary SQLite database. They set their own `DATABASE_URL`, `UPLOAD_DIR`, and `JWT_SECRET` in `tests/conftest.py`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy URL (SQLite for dev, PostgreSQL for production) |
| `JWT_SECRET` | Signing key for access tokens. Required in production |
| `CORS_ORIGINS` | JSON list of allowed origins |
| `ADMIN_USERNAMES` | JSON list of usernames that get the admin role on signup |
| `UPLOAD_DIR` | Where book covers and avatars are stored |

## Conventions

- JSON keys are camelCase. Models use snake_case internally, and `CamelModel` converts them.
- Privacy values are lowercase: `public` or `private`.
- Private clubs are listed by name for everyone. Their details, invite codes, and member-only data stay hidden from non-members: the invite code is returned only to owners and admins, joining without an invite code creates a pending request for admins to approve, and boards, messages, and events require membership.
- Account deletion (`DELETE /api/profile`) takes a JSON body with `confirm` (your username) and `password`. A wrong password returns 403, not 401, because 401 means an expired session to the web client.
- Errors use FastAPI's `detail` field.
