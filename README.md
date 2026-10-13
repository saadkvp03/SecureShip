# SecureShip

### Automated Application Security & DevSecOps Pipeline

## 1. Project Overview

SecureShip is a hands-on cybersecurity and DevSecOps portfolio project focused on building a small application and progressively securing its software delivery lifecycle.

The project simulates a fictional logistics company that manages shipments. Its REST API serves as a practical target for functional testing, containerization, and future automated security checks.

**Project status:** In development. The FastAPI application, SQLite persistence, nine automated tests, and Docker containerization have been implemented. Git version control and GitHub Actions integration are next.

> **Scope:** Educational laboratory using fictional data. This is not a production-ready logistics platform.

## 2. Project Objectives

- Build a REST API with Python and FastAPI.
- Persist shipment information in SQLite.
- Write repeatable automated tests with Pytest.
- Package and run the application with Docker.
- Manage source code and history using Git and GitHub.
- Create a CI/CD pipeline using GitHub Actions.
- Integrate automated code, dependency, container, secret, and Infrastructure as Code security checks.
- Investigate findings, apply fixes, and verify their effectiveness.
- Document technical decisions, evidence, and remediation results.

## 3. Implemented Features

- `GET /` — application information.
- `GET /health` — health-check endpoint.
- `POST /shipments` — create a shipment.
- `GET /shipments` — list stored shipments.
- `PATCH /shipments/{shipment_id}/status` — update shipment status.
- SQLite database initialized when the application starts.
- Input validation with Pydantic; allowed statuses: `created`, `in_transit`, `delivered`.
- Nine automated API tests with isolated temporary databases.
- Docker image configured to run the API as a non-root user.
- Named Docker volume support for database persistence across container recreation.

### API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | Display application information |
| `GET` | `/health` | Check application availability |
| `POST` | `/shipments` | Create a shipment |
| `GET` | `/shipments` | List shipments |
| `PATCH` | `/shipments/{shipment_id}/status` | Update a shipment status |

**Example request body for `POST /shipments`:**

```json
{
  "recipient": "Test Client",
  "destination": "Rabat"
}
```

**Example request body for `PATCH /shipments/1/status`:**

```json
{
  "status": "in_transit"
}
```

## 4. Technology Stack

**Implemented:**

- Python 3.11, FastAPI, Pydantic
- SQLite
- Pytest and FastAPI TestClient
- Docker

**Planned:**

- Git and GitHub — version control and remote repository
- GitHub Actions — continuous integration and automated checks
- Semgrep — static application security testing (SAST)
- Trivy — dependency and container image scanning
- Gitleaks — secret detection
- Checkov — Infrastructure as Code scanning
- Terraform — example infrastructure configurations

## 5. Project Structure

```text
SecureShip/
├── .github/
│   └── workflows/          # GitHub Actions workflows (planned)
├── app/
│   ├── main.py             # FastAPI routes and models
│   └── database.py         # SQLite database operations
├── docs/                   # Project and security documentation
├── infra/
│   └── terraform/          # Infrastructure as Code (planned)
├── scripts/                # Supporting scripts (planned)
├── tests/
│   └── test_main.py        # Automated API tests
├── .dockerignore
├── .gitignore
├── Dockerfile
├── README.md
└── requirements.txt
```

The local `.venv/`, `.pytest_cache/`, and `secureship.db` are excluded from Git through `.gitignore`.

## 6. Run Locally

**Requirements:** Python 3.11 and `pip`.

From the project directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Open:

- API documentation (Swagger UI): http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

The SQLite database is created automatically at `secureship.db` by default. Its location can be changed using the `SECURESHIP_DB_PATH` environment variable.

## 7. Run Automated Tests

With the virtual environment activated:

```bash
python -m pytest -q
```

**Current test suite:** 9 tests covering application endpoints, shipment creation and listing, status updates, invalid requests, unknown resources, and SQLite persistence.

## 8. Run with Docker

**Requirement:** Docker installed and running.

Build the image:

```bash
docker build -t secureship:dev .
```

Start the container with a named volume:

```bash
docker run -d --rm \
  --name secureship-dev \
  -p 127.0.0.1:8000:8000 \
  -v secureship-data:/app/data \
  secureship:dev
```

Check application health:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

Stop the container:

```bash
docker stop secureship-dev
```

The container runs as a non-root user. The `secureship-data` volume stores SQLite data separately from the container, so data can survive stopping and recreating the container with the same volume.

## 9. DevSecOps & Security Roadmap

- [x] Define project scope and architecture.
- [x] Implement the FastAPI shipment management API.
- [x] Add SQLite persistence.
- [x] Create and run nine automated tests.
- [x] Containerize the application with Docker.
- [x] Verify non-root execution and persistent Docker volume behavior.
- [ ] Initialize Git and publish the repository on GitHub.
- [ ] Automate tests with GitHub Actions.
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
- The API currently has **no authentication or authorization**; it must not be exposed as a production service.
- No production environment or real customer data is used.
- Security scans and GitHub Actions workflows have **not yet been implemented**.
- Deliberately vulnerable scenarios, if introduced later, will be limited to controlled laboratory work.
- Local databases, Python environments, and secrets must not be committed to the repository.

## 12. Project Status

**Current phase:** Preparing Git version control and subsequent CI/CD integration.

**Completed:** Application development, SQLite persistence, Pytest tests, and Docker containerization.

**Next:** Review repository contents, initialize Git, create the initial commit, then configure GitHub and GitHub Actions.

---

*SecureShip is developed as an educational cybersecurity engineering and DevSecOps portfolio project.*
