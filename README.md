# SecureShip

### Automated Application Security & DevSecOps Pipeline

## 1. Project Overview

SecureShip is a hands-on cybersecurity and DevSecOps portfolio project focused on building a small application and progressively securing its software delivery lifecycle.

The project simulates a fictional logistics company that manages shipments. It is made of a REST API (FastAPI + SQLite) and a modern web interface (React + TypeScript), which together serve as a practical target for functional testing, containerization, and future automated security checks.

**Project status:** In development. The API, the web interface, SQLite persistence, automated tests, Docker packaging, and a GitHub Actions CI pipeline are implemented. Security scanning tools are the next phase.

> **Scope:** Educational laboratory using fictional data. This is not a production-ready logistics platform.

## 2. Project Objectives

- Build a REST API with Python and FastAPI.
- Provide a real web interface for end users (not only Swagger).
- Persist shipment information in SQLite.
- Write repeatable automated tests with Pytest.
- Package and run the application with Docker.
- Manage source code and history using Git and GitHub.
- Create a CI/CD pipeline using GitHub Actions.
- Integrate automated code, dependency, container, secret, and Infrastructure as Code security checks.
- Investigate findings, apply fixes, and verify their effectiveness.
- Document technical decisions, evidence, and remediation results.

## 3. Implemented Features

### Web interface (`/app`)

- **Dashboard:** shipment totals per status, a status distribution chart, and recent activity. Everything is computed from SQLite; nothing is simulated. A dedicated empty state invites you to create the first shipment.
- **Shipments:** searchable (recipient, destination, origin, tracking reference; case and accent insensitive), filterable by status, sortable, paginated. Quick action to move a shipment to its next status.
- **Create a shipment:** validated form (recipient, destination, optional origin and notes). A readable tracking reference such as `SS-7K4Q9M` is generated.
- **Shipment details:** information, tracker (created → in transit → delivered) and the real history of status changes with timestamps.
- Light and dark themes, responsive layout (desktop, tablet, phone), toast notifications, loading and error states, keyboard-accessible controls.
- The interface is in French. A **single local operator login** now protects the shipment API. It remains a local-only security laboratory, not a production application.

### API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | Application information (JSON, unchanged) |
| `GET` | `/health` | Check application availability (public) |
| `POST` | `/auth/login` | Local operator login; sets HttpOnly session cookie |
| `GET` | `/auth/me` | Check current session and obtain anti-CSRF token |
| `POST` | `/auth/logout` | Revoke current session (requires CSRF token) |
| `POST` | `/shipments` | Create a shipment |
| `GET` | `/shipments` | List shipments (optional search, filter, sort, pagination) |
| `GET` | `/shipments/{shipment_id}` | Shipment details with status history |
| `PATCH` | `/shipments/{shipment_id}/status` | Update a shipment status |
| `GET` | `/stats` | Totals per status and recent activity |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/app` | Web interface (after `npm run build`, or in Docker) |

Statuses: `created`, `in_transit`, `delivered`.

`GET /shipments` still returns a plain JSON list. Query parameters are optional: `q`, `status`, `sort` (`id`, `recipient`, `destination`, `status`), `order` (`asc`, `desc`), `limit` (1–200), `offset`. The number of matching shipments is returned in the `X-Total-Count` header.

**Example request body for `POST /shipments`** (`origin` and `notes` are optional):

```json
{
  "recipient": "Test Client",
  "destination": "Rabat",
  "origin": "Casablanca",
  "notes": "Fragile"
}
```

**Example request body for `PATCH /shipments/1/status`:**

```json
{
  "status": "in_transit"
}
```

### Authentication (local security lab)

- One operator configured **on the local machine only**; no registration, user database, or public hosting.
- Password stored only as a salted **scrypt hash** in `.env` (the plain password is never stored).
- Cryptographically random, opaque session cookie with `HttpOnly` and `SameSite=Strict`;
  its SHA-256 digest and expiration are stored in the existing SQLite database.
- HTTP APIs `/shipments`, `/shipments/{id}`, `/shipments/{id}/status` and `/stats` require a valid session.
  HTTP POST/PATCH/`/auth/logout` also require a valid `X-CSRF-Token` header.
- Public: `/`, `/health`, `/docs`, static `/app` login shell (data APIs remain protected).
- The cookie uses `Secure=False` solely because this lab is hosted on `127.0.0.1` over HTTP.
  Never reuse this configuration on the public Internet: a hosted application would need HTTPS,
  `Secure` cookies, brute-force throttling, a full IAM/privacy review, and additional hardening.
- **Important:** this changes the original unauthenticated API contract; old anonymous
  curl requests now deliberately return HTTP 401.

### Database

SQLite with shipment tables `shipments` and `shipment_events` (the status history), plus a small `auth_sessions` table for login sessions. Older databases are upgraded automatically and non-destructively at startup: new columns are added, existing rows are kept and receive a tracking reference. For shipments created before this upgrade, the creation date and history were never recorded, so they stay empty instead of being invented. All SQL values are bound parameters.

## 4. Technology Stack

**Implemented:**

- Python 3.11, FastAPI, Pydantic
- SQLite
- React 18, TypeScript, Vite, Tailwind CSS, Lucide icons (no charting library: the chart is plain SVG)
- Pytest and FastAPI TestClient
- Docker (multi-stage build) and Docker Compose
- GitHub Actions (tests, frontend build, Docker build and smoke test)

**Planned:**

- Semgrep — static application security testing (SAST)
- Trivy — dependency and container image scanning
- Gitleaks — secret detection
- Checkov — Infrastructure as Code scanning
- Terraform — example infrastructure configurations

## 5. Project Structure

```text
SecureShip/
├── .github/
│   └── workflows/ci.yml    # Pytest, frontend build, Docker build + smoke test
├── app/
│   ├── auth.py             # Scrypt, revocable server sessions, CSRF
│   ├── main.py             # FastAPI routes, models, serves the interface at /app
│   └── database.py         # SQLite schema, migration and queries
├── frontend/               # React + TypeScript + Vite + Tailwind interface
│   ├── src/
│   │   ├── pages/          # Dashboard, Shipments, Detail
│   │   ├── components/     # Layout, dialog, tracker rail, chart, toasts…
│   │   └── lib/            # API client, router, hooks, formatting
│   └── package.json
├── docs/                   # Project and security documentation
├── infra/
│   └── terraform/          # Infrastructure as Code (planned)
├── scripts/
│   ├── setup_auth.py       # Interactive secret-free-in-Git setup
│   └── seed_demo.py        # Optional fictional demo data (separate database)
├── tests/
│   ├── test_auth.py        # Authentication security regressions
│   ├── test_main.py        # Original 9 API tests
│   ├── test_features.py    # Tests for the new features
│   └── conftest.py
├── Dockerfile              # Multi-stage: builds the interface, runs the API
├── docker-compose.yml
├── Makefile                # Shortcuts for the commands below
└── requirements.txt
```

`.venv/`, `node_modules/`, `frontend/dist/`, `.pytest_cache/` and every `*.db` file are excluded from Git.

## 6. Run Locally

**Requirements:** Python 3.11, `pip`, and Node.js 20 or newer (only for the interface).

One-time setup, from the project directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/setup_auth.py   # interactive; choose YOUR OWN login + strong password
cd frontend && npm install && cd ..
```

### Development (two terminals)

Terminal 1 — API with auto-reload on http://127.0.0.1:8000:

```bash
source .venv/bin/activate
python -m uvicorn app.main:app --reload --env-file .env
```

Terminal 2 — interface with hot reload:

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173/app/**. Vite forwards `/shipments`, `/stats` and `/health` to FastAPI on port 8000 (set `VITE_API_TARGET` to change the target), so no CORS configuration is needed.

### Single port, production-like

```bash
cd frontend && npm install && npm run build && cd ..
python -m uvicorn app.main:app --env-file .env
```

Open:

- Web interface: http://127.0.0.1:8000/app
- API documentation (Swagger UI): http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

If the interface has not been built, `/app` shows an explanatory page (HTTP 503) and the API keeps working.

The SQLite database is created automatically at `secureship.db` by default. Credentials live in the ignored `.env` file created by `scripts/setup_auth.py`; never commit or share that file. Its location can be changed using the `SECURESHIP_DB_PATH` environment variable.

### Optional demo data

To try the interface with ten fictional shipments **without touching your real database**:

```bash
python scripts/seed_demo.py                       # writes ./demo.db
SECURESHIP_DB_PATH=demo.db python -m uvicorn app.main:app --reload --env-file .env
```

The script refuses to write to `secureship.db` or to any database that already contains shipments.

## 7. Run Automated Tests

With the virtual environment activated:

```bash
python -m pytest -q
```

The suite includes authentication regressions in `tests/test_auth.py` as well as the original 9 tests (`tests/test_main.py`) plus tests for details, history, tracking references, search, filters, sorting, pagination, statistics, the upgrade of a legacy database, and the `/app` route. Each test uses its own temporary database.

Frontend checks:

```bash
cd frontend
npm run typecheck   # TypeScript only
npm run build       # TypeScript + production build into frontend/dist
```

## 8. Run with Docker

**Requirement:** Docker installed and running (Apple Silicon is supported; the images are multi-architecture).

First configure the account in the repository root (**once**):

```bash
python scripts/setup_auth.py
```

The generated `.env` is ignored by Git. Compose loads it automatically.
**Do not remove the existing named volume, or your shipments will be lost.**

Everything on one port with a persistent volume:

```bash
docker compose up --build
```

Open http://127.0.0.1:8000/app (API docs at `/docs`). Stop with `Ctrl+C`; data stays in the `secureship-data` volume.

Without Compose:

```bash
docker build -t secureship:dev .

docker run -d --rm \
  --name secureship-dev \
  -p 127.0.0.1:8000:8000 \
  -v secureship-data:/app/data \
  secureship:dev

curl http://127.0.0.1:8000/health      # {"status":"ok"}
docker stop secureship-dev
```

The Dockerfile builds the interface in a Node stage, then copies only the compiled files into the Python image. The container runs as a non-root user (uid 10001) and has a health check. The `secureship-data` volume stores SQLite data separately from the container.

## 9. DevSecOps & Security Roadmap

- [x] Define project scope and architecture.
- [x] Implement the FastAPI shipment management API.
- [x] Add SQLite persistence.
- [x] Create and run automated tests.
- [x] Containerize the application with Docker.
- [x] Verify non-root execution and persistent Docker volume behavior.
- [x] Initialize Git and publish the repository on GitHub.
- [x] Automate tests with GitHub Actions.
- [x] Build a web interface on top of the API.
- [x] Introduce Semgrep OSS reporting in CI.
- [ ] Add Trivy, Gitleaks and Checkov checks, plus a blocking policy for relevant findings.
- [ ] Document controlled security findings and remediation.
- [ ] Validate expected pipeline failures and successful fixes.
- [ ] Finalize technical and security reporting.

## 10. Documentation

The `docs/` directory contains:

- `01-scope-architecture.md` — project scope and planned architecture.
- `02-threat-model.md` — identified threats and proposed security controls.
- `03-security-findings.md` — security findings (to be completed).
- `04-remediation-validation.md` — remediation and validation evidence (to be completed).
- `05-final-report.md` — final project report (to be completed).
- `06-authentication.md` — local login/session design, T-01 remediation and security evidence plan.

## 11. Limitations & Security Notes

- This is an educational project using fictional shipment data.
- A single-operator login now gates the shipment API. This is **not a full multi-user IAM system** and is still unsuitable for production. Docker Compose binds to `127.0.0.1` on purpose.
- Status transitions are restricted to `created → in_transit → delivered`; invalid transitions are rejected with HTTP 409 and history is preserved.
- Search ignores case and accents using SQLite and Python; it is a simple scan, adequate for a demo-sized database.
- No production environment or real customer data is used.
- Semgrep is already configured in GitHub Actions (reporting mode); Trivy, Gitleaks and Checkov are pending. The Semgrep CI gate is not yet blocking on findings.
- Deliberately vulnerable scenarios, if introduced later, will be limited to controlled laboratory work.
- Local databases, Python environments, `node_modules`, and secrets must not be committed to the repository.

## 12. Project Status

**Current phase:** Application complete (API + interface); preparing the security tooling phase.

**Next:** Add the DevSecOps scanning steps to the GitHub Actions pipeline, one tool at a time.

---

*SecureShip is developed as an educational cybersecurity engineering and DevSecOps portfolio project.*


## Authentication security verification (local lab)

From `~/Desktop/SecureShip`, after `docker compose up -d --build`:

1. Open <http://127.0.0.1:8000/app>, verify the login form is shown.
2. Log in with the username/password chosen during `scripts/setup_auth.py`.
3. Existing shipments must still be present; create a fictional test shipment.
4. Click **Déconnexion** and confirm you can no longer see the shipments.
5. Run `curl -i http://127.0.0.1:8000/shipments`: **HTTP 401** is expected.
6. Run `python -m pytest -q` locally: the code snapshot passed **52 backend tests** during preparation; rerun on your machine.

Screenshots for the portfolio (redact sensitive content):
`docs/evidence/t01-login-form.png`, `docs/evidence/t01-unauthenticated-401.png`,
`docs/evidence/t01-authenticated-access.png`. Never photograph your real password,
`.env`, cookie values, CSRF token, or credentials.

See `docs/06-authentication.md` for security design and limitations.
