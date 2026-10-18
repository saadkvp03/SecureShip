# SecureShip — Project Scope & Architecture

**Architecture baseline:** 18 October 2026\
**Project:** [SecureShip](https://github.com/saadkvp03/SecureShip)\
**Scope:** Authorized, localhost-only DevSecOps laboratory using fictional shipment data.\
**Status:** Application and initial security-hardening CI pipeline implemented; documentation and dynamic security testing are continuing.

## 1. Project Purpose

SecureShip is a hands-on cybersecurity engineering and DevSecOps project. It uses a small but functional shipment management application to demonstrate how software can be **built, tested, secured, packaged, and validated** through a repeatable development workflow.

The project combines:

- A REST API and a web interface used to manage fictional shipments.
- Persistent storage and automated application/security regression testing.
- A multi-stage Docker image and local Docker Compose environment.
- Git/GitHub version control and automated GitHub Actions checks.
- Application code, dependency, container, secret, and configuration security analysis.
- Findings triage, security remediation, risk acceptance/tracking, and validation evidence.

The working principle is **Build → Test → Analyze → Remediate → Validate**. These activities are iterative rather than a one-way pipeline: a failed check or a new finding leads back to investigation and correction.

> **Boundary:** SecureShip is not a publicly hosted logistics service, a production security certification, or a complete CI/CD deployment platform. All application data is fictional, and Docker Compose binds the service to `127.0.0.1`.

## 2. Business Scenario and Scope

SecureShip models a fictional logistics operator who needs to register shipments, review their progress, and consult historical status events. The application is the realistic target for a DevSecOps learning and portfolio exercise.

**In scope (implemented):**

- The FastAPI shipment management backend and React/TypeScript frontend.
- A single local operator, authenticated sessions, anti-CSRF protection, and server-enforced shipment transitions.
- SQLite persistence, automated tests, and containerization.
- Seven GitHub Actions jobs for quality and security checks.
- Static analysis, secret scanning, software composition analysis, configuration checks, and container vulnerability reporting with a defined blocking policy.
- Documentation of findings, mitigations, and residual risks.

**Out of scope / not yet implemented:**

- Public Internet hosting, cloud deployment, production customer records, or production-grade IAM.
- Multi-tenant access control, user provisioning, MFA, and centralized identity management.
- Kubernetes or deployed Terraform infrastructure.
- Automated delivery/deployment to a production environment (the current workflow is **CI**, not automated deployment).
- OWASP ZAP DAST, which is planned as a separate authorized local assessment.

## 3. Implemented Application Features

### 3.1 Web interface

The French-language, responsive React + TypeScript interface is available at `/app` when built and served by FastAPI, or through the Vite development server during frontend development. It includes:

- Operator login and logout.
- A dashboard with shipment totals, status distribution, and recent activity from SQLite.
- Shipment creation with validated inputs and generated tracking references.
- Search, status filtering, sorting, and pagination.
- Shipment details, status tracking, and a timestamped event history.
- Light/dark themes and interface feedback for loading and errors.

See the [README application preview](../README.md#application-preview--local-deployment) for screenshots of the actual localhost interface.

### 3.2 API and authorization boundary

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| `GET` | `/` | Application metadata | Public |
| `GET` | `/health` | Health check | Public |
| `GET` | `/docs` | API documentation | Public; protected data routes still enforce authentication |
| `GET` | `/app` | Frontend interface / login shell | Public shell; protected data is server-gated |
| `POST` | `/auth/login` | Authenticate the configured local operator | Public login operation |
| `GET` | `/auth/me` | Validate session and retrieve CSRF token | Authenticated |
| `POST` | `/auth/logout` | Revoke the current session | Authenticated + CSRF |
| `POST` | `/shipments` | Create a shipment | Authenticated + CSRF |
| `GET` | `/shipments` | List/search/filter shipments | Authenticated |
| `GET` | `/shipments/{shipment_id}` | Shipment details and event history | Authenticated |
| `PATCH` | `/shipments/{shipment_id}/status` | Change shipment status | Authenticated + CSRF |
| `GET` | `/stats` | Aggregated statistics and recent activity | Authenticated |

The backend only permits the progression `created → in_transit → delivered`. Invalid transitions return HTTP **409**; authentication failures return **401**, and missing/invalid anti-CSRF tokens on protected writes return **403**. The state machine is enforced server-side, independently of frontend controls.

### 3.3 Local operator authentication

- `scripts/setup_auth.py` configures one local operator. It writes the username and a **salted scrypt password hash** to a Git-ignored `.env`; it does not save the clear-text password.
- On login, the API issues a cryptographically random, opaque session cookie with `HttpOnly`, `SameSite=Strict`, and an eight-hour maximum age.
- SQLite stores a **SHA-256 digest** of each session token, a CSRF token, and session expiry; server-side logout revokes the session.
- Protected state-changing operations require `X-CSRF-Token` in addition to the session cookie.
- Because this authorized lab runs on loopback HTTP, the cookie is intentionally **not** marked `Secure`; Internet deployment would require HTTPS, Secure cookies, stronger operational controls, and an independent security review.

See [`06-authentication.md`](06-authentication.md) for authentication decisions and remaining limitations.

### 3.4 Persistence and regression tests

- SQLite tables store shipments, shipment status events, and active authentication sessions.
- Startup creates or upgrades the schema without replacing existing shipment records; user-supplied SQL values are passed through bound parameters.
- `SECURESHIP_DB_PATH` selects a database path, allowing each Pytest case to use an isolated temporary database.
- The **18 October 2026 validation baseline passed 53/53 Pytest tests**, including access control, CSRF, session expiry/logout, shipment state transitions, and a targeted SQL-injection regression.
- Frontend validation includes TypeScript checking and a Vite production build.

## 4. System Architecture — Implemented

### 4.1 Application and data flow

```text
                         Local developer / operator
                                     |
                     Browser on the local machine
                                     |
                 +-------------------+-------------------+
                 |                                       |
                 v                                       v
        Development mode                         Built/Docker mode
        Vite /app (port 5173)                     /app (127.0.0.1:8000)
        Proxies API requests                      Static React assets
                 |                                       |
                 +-------------------+-------------------+
                                     |
                                     v
                      FastAPI / Uvicorn (Python 3.11)
                         - Operator authentication
                         - HttpOnly session cookie
                         - Session + CSRF enforcement
                         - Shipment status state machine
                         - Input validation / API routes
                                     |
                                     v
                          Python SQLite data layer
                         - Parameterized user values
                         - Shipment / event records
                         - Session token digests
                                     |
                                     v
                               SQLite database
                        (local file or Docker volume)
```

The API and built frontend share one application port in the Docker configuration. Publicly reachable shell/documentation endpoints do **not** bypass protection on shipment/statistics API routes.

### 4.2 Docker packaging and local execution

```text
          Docker multi-stage build
          +-----------------------------------------+
          | 1. node:20-alpine                       |
          |    Install frontend dependencies       |
          |    Compile React/TypeScript with Vite  |
          +---------------------+-------------------+
                                | frontend/dist
                                v
          +-----------------------------------------+
          | 2. python:3.11-slim runtime            |
          |    FastAPI + Uvicorn + built frontend   |
          |    requirements-runtime.txt only       |
          |    Non-root UID 10001; HEALTHCHECK     |
          +---------------------+-------------------+
                                |
                Docker Compose: 127.0.0.1:8000
                                |
                                v
                   Named volume: secureship-data
                    SQLite at /app/data/secureship.db
```

Docker Compose reads the **local, ignored** `.env` and retains shipment data through the named volume. The image installs only the intended runtime requirements, removes unnecessary Python packaging tools after installation, and includes the recorded Debian `liblzma5` update.

**Data safety:** Do not run `docker compose down -v` against the existing persisted database volume. Ordinary container rebuilds do not require deleting the volume.

## 5. Source-Control and DevSecOps Architecture — Implemented

The source repository is [`saadkvp03/SecureShip`](https://github.com/saadkvp03/SecureShip). GitHub Actions is configured in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and is triggered by pushes to `main` or `feature/**` and pull requests targeting `main`.

```text
                Developer changes application or configuration
                                     |
                            Local checks / review
                                     |
                               Git commit / push
                                     |
                               GitHub repository
                                     |
                              GitHub Actions CI
                                     |
         +---------------------------+-------------------------+
         |                           |                         |
         v                           v                         v
  test (Pytest)             frontend (Vite build)      Independent gates:
         |                           |                  - semgrep (SAST)
         +--------------+------------+                  - gitleaks (Git history)
                        |                               - sca (pip/npm audit)
                        v                               - checkov (Docker/CI)
                 docker job
                 - Build runtime image
                 - Local container smoke tests
                 - Trivy full JSON vulnerability report
                 - Trivy fixable HIGH/CRITICAL gate
                        |                               |
                        +-------------------------------+
                                     |
                         CI validation outcome
                          /                  \
                       Failure              Success
                         |                     |
                Review and correct       Review / merge as
                then push changes        appropriate
```

**Important dependency detail:** `docker` runs **after** `test` and `frontend` (`needs: [test, frontend]`). The `semgrep`, `gitleaks`, `sca`, and `checkov` jobs have no such dependency and may execute in parallel. A CI success means the **configured checks passed on that revision**, not that an image was automatically deployed or every possible vulnerability was excluded.

### 5.1 Seven CI jobs and their roles

| Job | Implemented check | Security/quality outcome |
| --- | --- | --- |
| `test` | Install pinned Python dependencies; execute Pytest | Blocks test failures |
| `frontend` | Compile/type-check frontend and build production assets | Blocks build/type errors |
| `docker` | Docker image build; health/login/authorization/CSRF/shipment smoke test; Trivy | Blocks smoke-test failures and **fixable HIGH/CRITICAL** image findings; uploads full JSON Trivy report |
| `semgrep` | `semgrep scan --config auto --error app/ frontend/src/` | Blocking SAST after documented, narrow findings triage |
| `gitleaks` | Scan accessible Git history (`fetch-depth: 0`) | Blocks detected secret leaks |
| `sca` | `pip-audit -r requirements.txt` and `npm --prefix frontend audit --omit=dev` | Blocks vulnerabilities reported in the checked Python and production npm dependency scopes |
| `checkov` | Scan Dockerfile and GitHub Actions workflow configurations | Blocks violations of the configured checks |

**Local supplemental check:** Actionlint and ShellCheck were used to validate the CI workflow locally. They are **not** an eighth GitHub Actions job.

**Trivy risk policy:** The full report includes findings regardless of fix availability. The separate CI gate checks HIGH/CRITICAL vulnerabilities **with an available fix** (`ignore-unfixed: true`), so the gate can pass while residual findings remain in the complete report. The artifact is retained for 14 days.

### 5.2 Validated milestone

The recorded 18 October 2026 baseline includes:

- **53/53** backend tests passing locally.
- A successful frontend build and Docker smoke-test pipeline.
- **7/7** CI jobs passing on the verified `main` workflow run.
- A merged [security-hardening Pull Request #2](https://github.com/saadkvp03/SecureShip/pull/2).
- Investigation of Semgrep's three initial SQL-construction alerts, specific in-code suppressions, and an SQL-injection regression test.
- A Trivy image report reduced from **175** to **164** recorded findings following the documented hardening work; remaining findings are **not** described as fixed.
- Repository Gitleaks scanning with no detected SecureShip leaks; a separate disposable repository was used for a synthetic-token history-detection demonstration.

These are **dated validation results**, not permanent assurances; scanner rules, dependencies, and vulnerability intelligence can change.

For a visual overview see [the overall workflow diagram](assets/workflow-global.png), [the code-change workflow](assets/workflow-code-change.png), and [the recorded GitHub Actions job graph](assets/github-actions-job-graph.png).

## 6. Security Objectives and Trust Boundaries

| Boundary | Protected asset / concern | Implemented measure | Remaining limitation |
| --- | --- | --- | --- |
| Browser → API | Shipment data and updates | Server-side session checks, CSRF for writes, validated models | Single local operator; no complete IAM |
| Application → SQLite | Data integrity and query safety | Bound parameter values, fixed SQL fragments/allowlists, regression tests | Scoped testing cannot prove all injection paths absent |
| Local filesystem / container | Operator secrets and stored records | Git-ignored `.env`, session-token hashing, localhost binding, persistent volume | No TLS on localhost; local filesystem compromise out of scope |
| Source → CI | Code, build, dependencies and history | Pytest, frontend build, Semgrep, Gitleaks, pip/npm audit, Checkov | Rules and scanner coverage are incomplete by design |
| Container image → runtime | Base image and installed packages | Minimal runtime dependencies, non-root user, Trivy report and blocking fixable-severity gate | Unfixed OS vulnerabilities remain visible in the full report |

Security analysis is confined to the authorized local environment and the repository's own code/configuration. See [`02-threat-model.md`](02-threat-model.md) for the STRIDE assessment (being refreshed for the latest baseline), [`03-security-findings.md`](03-security-findings.md) for current findings, and [`04-remediation-validation.md`](04-remediation-validation.md) for remediation evidence.

## 7. Deliverables and Progress

### Implemented and validated

- [x] FastAPI API and React/TypeScript interface.
- [x] SQLite persistence and shipment status/event history.
- [x] Single-operator session authentication, CSRF protection, and server-side transition enforcement.
- [x] Pytest security/functional regressions and frontend production build.
- [x] Multi-stage non-root Docker image, health check, localhost Docker Compose and persistent volume.
- [x] GitHub repository and seven-job GitHub Actions CI pipeline.
- [x] Blocking Semgrep, Gitleaks, SCA, Checkov and fixable HIGH/CRITICAL Trivy checks.
- [x] Recorded findings triage, container/dependency investigation and local validation baseline.

### In progress or future work

- [ ] Keep architecture, threat model, findings, validation, authentication and final-report documents consistent with the completed baseline.
- [ ] Reassess residual Debian-image vulnerabilities and development-toolchain dependency advisories as fixes become available.
- [ ] Conduct authorized OWASP ZAP DAST against the local application and document its findings separately.
- [ ] Consider expanding CI governance (for example, automated Actionlint and more robust tool pinning) and collecting additional redacted evidence.
- [ ] Any public or production deployment would require a separate design, threat model, HTTPS/IAM hardening and deployment controls; **none is implied here**.

## 8. Success Criteria and Assessment

| Criterion | October 2026 status |
| --- | --- |
| Functional shipment application and database persistence | Implemented and tested |
| Authentication, CSRF and shipment-state integrity | Implemented and regression-tested |
| Non-root Docker operation and persistent local data | Implemented and validated |
| Git/GitHub revision history and automated CI | Implemented |
| Seven configured quality/security jobs | Verified passing in the recorded baseline |
| Findings investigation and documented remediation | Implemented for the reviewed Semgrep and Docker/security-control work |
| Demonstration of security detection | Locally demonstrated in a separate synthetic-secret test and recorded Semgrep examples; not evidence of live production exposure |
| Complete risk elimination or production certification | **Not claimed** |
| OWASP ZAP DAST and a public deployment | **Not implemented** |

## 9. Current Status and Next Steps

**Current milestone:** The initial application-security and DevSecOps CI implementation was merged into `main` with [PR #2](https://github.com/saadkvp03/SecureShip/pull/2), and the recorded seven-job pipeline succeeded. The project remains a **localhost-only educational security laboratory**.

**Immediate documentation sequence:** Refresh this architecture document, update the STRIDE threat model to reflect implemented safeguards, reconcile the authentication and findings reports, and complete the report for the **current phase**. The next security-testing milestone is a separately planned OWASP ZAP local DAST exercise; it is not part of the completed CI baseline.

### Related project documents

- [README](../README.md) — setup, application preview, CI workflow, and evidence images.
- [Threat model](02-threat-model.md) — STRIDE threats, assets, boundaries, mitigations.
- [Security findings](03-security-findings.md) — observed findings and risk disposition.
- [Remediation and validation](04-remediation-validation.md) — implemented changes and supporting checks.
- [Authentication design](06-authentication.md) — local account/session/CSRF model.
- [Semgrep triage](07-semgrep-triage.md) — reviewed SQL alerts and blocking SAST gate.

---

*SecureShip — Educational Cybersecurity Engineering & DevSecOps Project. No real user or customer data is required for these demonstrations.*
