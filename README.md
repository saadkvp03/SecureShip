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
- The interface is in French. It has **no authentication** and is meant for local demonstration.

### API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | Application information (JSON, unchanged) |
| `GET` | `/health` | Check application availability |
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

### Database

SQLite with two tables: `shipments` and `shipment_events` (the status history). Older databases are upgraded automatically and non-destructively at startup: new columns are added, existing rows are kept and receive a tracking reference. For shipments created before this upgrade, the creation date and history were never recorded, so they stay empty instead of being invented. All SQL values are bound parameters.

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
│   └── seed_demo.py        # Optional fictional demo data (separate database)
├── tests/
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
cd frontend && npm install && cd ..
```

### Development (two terminals)

Terminal 1 — API with auto-reload on http://127.0.0.1:8000:

```bash
source .venv/bin/activate
python -m uvicorn app.main:app --reload
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
python -m uvicorn app.main:app
```

Open:

- Web interface: http://127.0.0.1:8000/app
- API documentation (Swagger UI): http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

If the interface has not been built, `/app` shows an explanatory page (HTTP 503) and the API keeps working.

The SQLite database is created automatically at `secureship.db` by default. Its location can be changed using the `SECURESHIP_DB_PATH` environment variable.

### Optional demo data

To try the interface with ten fictional shipments **without touching your real database**:

```bash
python scripts/seed_demo.py                       # writes ./demo.db
SECURESHIP_DB_PATH=demo.db python -m uvicorn app.main:app --reload
```

The script refuses to write to `secureship.db` or to any database that already contains shipments.

## 7. Run Automated Tests

With the virtual environment activated:

```bash
python -m pytest -q
```

The suite contains the original 9 tests (`tests/test_main.py`) plus tests for details, history, tracking references, search, filters, sorting, pagination, statistics, the upgrade of a legacy database, and the `/app` route. Each test uses its own temporary database.

Frontend checks:

```bash
cd frontend
npm run typecheck   # TypeScript only
npm run build       # TypeScript + production build into frontend/dist
```

## 8. Run with Docker

**Requirement:** Docker installed and running (Apple Silicon is supported; the images are multi-architecture).

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
- [ ] Introduce Semgrep, Trivy, Gitleaks, and Checkov checks.
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

## 11. Limitations & Security Notes

- This is an educational project using fictional shipment data.
- The API and the interface have **no authentication or authorization**; they must not be exposed as a production service. Docker Compose and the examples bind to `127.0.0.1` on purpose.
- Any status can be set from any other status (the original API behavior is kept); the history records every real change.
- Search ignores case and accents using SQLite and Python; it is a simple scan, adequate for a demo-sized database.
- No production environment or real customer data is used.
- Security scanning tools (Semgrep, Trivy, Gitleaks, Checkov) have **not yet been implemented**.
- Deliberately vulnerable scenarios, if introduced later, will be limited to controlled laboratory work.
- Local databases, Python environments, `node_modules`, and secrets must not be committed to the repository.

## 12. Project Status

**Current phase:** Application complete (API + interface); preparing the security tooling phase.

**Next:** Add the DevSecOps scanning steps to the GitHub Actions pipeline, one tool at a time.

---

*SecureShip is developed as an educational cybersecurity engineering and DevSecOps portfolio project.*
