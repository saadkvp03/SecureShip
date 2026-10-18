# SecureShip — Threat Model

> **Status:** Initial STRIDE model, augmented with local-lab T-01 authentication remediation. Earlier sections describe the pre-authentication baseline.
> **Scope:** Local educational laboratory; fictional shipment records; not approved for public production use
> **Source baseline:** `SecureShip-security-review.zip`, exported from commit `1df1d99`
> **Working branch:** `feature/security-hardening`

## 1. Purpose and method

Identify what must be protected in SecureShip, how information crosses trust boundaries, and which realistic threats warrant investigation. This document is a **model of the current system**, not a claim that the application has passed a security assessment.

Method:
1. Establish the deployed and development scope from source code and configuration.
2. Inventory assets, actors, entry points, data flows, and trust boundaries.
3. In the next revision, examine each boundary with **STRIDE** (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).
4. Record testable hypotheses and prioritize them by plausible impact and exposure.
5. Reproduce relevant findings in the authorized laboratory, remediate, and retain regression tests and evidence.

Do not label a static-analysis finding as exploitable without assessing data provenance and reachable execution paths.

## 2. Scope and operating assumptions

### 2.1 In scope — implemented today

- React + TypeScript user interface, served from `/app` by FastAPI after build.
- FastAPI HTTP endpoints: `/`, `/health`, `/shipments`, `/shipments/{shipment_id}`, `/shipments/{shipment_id}/status`, `/stats`, and framework-provided `/docs`.
- Input validation implemented with Pydantic, including allowed shipment statuses.
- SQLite data access and non-destructive schema migration; `shipments` and `shipment_events` tables.
- Docker multi-stage image (Node build stage; Python runtime stage), Compose configuration, non-root runtime account, and SQLite named volume.
- GitHub repository, contributions, Python/React test and build jobs, Docker smoke tests, and Semgrep OSS job in GitHub Actions.
- Local Python and Node dependency manifests (`requirements.txt`, `frontend/package-lock.json`).

### 2.2 Outside current scope / not implemented

- Internet-facing production deployment, TLS termination, domain configuration, and cloud hosting.
- Multi-user identity management, authorization roles, and tenant separation. A **single local operator session** was introduced after the initial baseline for T-01 (see `docs/06-authentication.md`).
- Real customer information, production credentials, payment processing, and integrations with external logistics services.
- Active Terraform infrastructure: `infra/terraform/` currently contains only `.gitkeep`.

### 2.3 Critical assumptions and limitations

- All shipment records used for the demonstration are fictional.
- `docker-compose.yml` publishes the application on the **host loopback** address `127.0.0.1:8000`. This limits direct network exposure in the documented Compose deployment; it is **not** authentication and does not protect against other local processes or a changed deployment configuration.
- The Docker image's Uvicorn process binds to `0.0.0.0:8000` **inside the container**. The host-side port binding is a separate control.
- The system is reviewed statically from an exported Git snapshot. Runtime controls and behavioral claims require independent tests; no new dynamic attack tests have been executed for this document.
- The existing Semgrep job runs without `--error`: a green CI job does not imply zero findings.

## 3. System and data flows

### 3.1 Application path

```text
Local browser (React) / Swagger / local HTTP client
                         |
                HTTP requests / responses
                         |
                127.0.0.1:8000 on host
                         |
                Docker published port
                         v
             FastAPI + Pydantic + Uvicorn
                         |
                   sqlite3 queries
                         v
           SQLite: shipments, shipment_events
                         |
            /app/data/secureship.db in container
                         |
           Compose named volume (persistent)
```

The local non-container deployment instead uses `secureship.db` in the project directory by default, or the path configured through `SECURESHIP_DB_PATH`.

### 3.2 Software-delivery path

```text
Developer workstation -> Git commit/push -> GitHub repository
                                             |
                                      GitHub Actions
                                             |
                             +---------------+---------------+
                             |               |               |
                          Pytest         React build      Semgrep OSS
                             |               |            (reporting)
                             +-------+-------+
                                     |
                            Docker build + smoke test
```

The diagram reflects the reviewed workflow's dependencies: `docker` waits for `test` and `frontend`; Semgrep is an independent job. No deployment to a public environment is configured.

### 3.3 Relevant information flows

| ID | Source -> destination | Information / operation | Current mechanism |
|---|---|---|---|
| DF-01 | Browser or HTTP client -> FastAPI | Create, list, read, or change a shipment; query statistics | JSON over HTTP; Pydantic validation on relevant inputs |
| DF-02 | FastAPI -> SQLite | Reads, inserts, updates; migration on startup | Python `sqlite3`; bound parameters for user values |
| DF-03 | FastAPI -> Browser | Shipment fields, tracking references, event history, counts | JSON responses, no authentication gate |
| DF-04 | Runtime container -> named volume | Read/write database file | `/app/data` mount; non-root application account |
| DF-05 | Developer -> GitHub | Source, workflow, dependency-lockfile changes | Git commits, branches, PRs |
| DF-06 | GitHub Actions -> package registries / container base images | Acquire dependencies and build inputs | `pip`, `npm ci`, Docker base images |

## 4. Assets and security properties

| ID | Asset | Primary properties | Why it matters |
|---|---|---|---|
| A-01 | Shipment records: recipient, destination, origin, notes, tracking reference | **Confidentiality, Integrity** | Exposes shipment details and could be altered by an unauthorized caller if the API becomes reachable. Fictional data today; potentially personal data in a real system. |
| A-02 | Shipment status and `shipment_events` history | **Integrity, Accountability** | Status changes should reflect authorized business operations; the existing event schema does not identify an actor. |
| A-03 | SQLite database file and Docker volume | **Integrity, Availability** | Loss or corruption would remove operational shipment records; persistent storage is not itself a backup. |
| A-04 | FastAPI service and frontend availability | **Availability** | Unbounded or excessive requests may exhaust resources; resilience is not yet demonstrated. |
| A-05 | Source code, workflow, test definitions, dependency manifests | **Integrity** | Malicious or accidental changes can alter behavior or disable security checks. |
| A-06 | Build artifacts, Docker image, dependency inputs | **Integrity, Provenance** | A compromised dependency or build step can affect the shipped runtime. |
| A-07 | CI permissions and any future credentials/tokens | **Confidentiality, Integrity** | Workflow permissions should be minimized; do not assume application secrets already exist. |

## 5. Actors and entry points

| Actor | Access assumed | Relevant entry points |
|---|---|---|
| Local demonstration user | Uses the browser on the same workstation | React UI `/app`, documented API `/docs` |
| Any local process / HTTP client | Can potentially access the loopback-bound service | API endpoints on `127.0.0.1:8000` |
| Repository contributor with write/PR capabilities | Can propose or push code and workflow changes, subject to repository settings | GitHub branches, Pull Requests, Actions workflow |
| Dependency or base-image publisher | Supplies third-party build inputs; not inherently trusted | Python/Node package installation and Docker base-image retrieval |
| Hypothetical remote attacker | **Not directly reachable in the reviewed Compose configuration**; relevance changes if port binding or hosting changes | Internet-facing API only under a different deployment assumption |

The React interface is **not a security boundary**: callers can send HTTP requests to FastAPI without using the browser interface. Tracking references are identifiers, not authentication credentials.

## 6. Trust boundaries

| Boundary | Crossing | Security question for the next STRIDE pass |
|---|---|---|
| TB-01 | Untrusted browser/HTTP inputs -> FastAPI | Who may read/create/modify records? Are values validated and requests constrained? |
| TB-02 | FastAPI application logic -> SQLite | Do query construction, status rules, schema changes, and file permissions preserve data integrity? |
| TB-03 | Container process -> host network and persistent volume | Are network exposure, runtime privileges, mount permissions, and data retention appropriate? |
| TB-04 | Contributors and source changes -> GitHub Actions | Can unsafe changes bypass review or disable security controls? What permissions does CI need? |
| TB-05 | Third-party registries/build stages -> deployed artifact | Can vulnerable or malicious dependencies/base images enter the final runtime unnoticed? |

## 7. Existing controls observed in code (not a security certification)

- `app/main.py`: Pydantic length constraints and a fixed set of permitted status values.
- `app/database.py`: user-supplied SQL values bound as parameters; SQL identifiers and sort expressions derived from code-defined allowlists. Semgrep's three reported SQL findings still require documented disposition.
- `app/main.py`: static frontend file serving checks that candidate file paths remain under the resolved build directory.
- `docker-compose.yml`: localhost-only published port and named volume for SQLite.
- `Dockerfile`: runtime user `appuser` (UID 10001); healthcheck; separate frontend build stage.
- `.github/workflows/ci.yml`: `contents: read` default permissions, Pytest, frontend build, Docker smoke tests, and non-blocking Semgrep scan.

**Known gaps / questions to investigate next:** absent authentication and authorization; no recorded actor identity for shipment status events; pagination optional on shipment listing; no demonstrated HTTP request rate limiting; no proven incident-grade logging or tested backup/restore procedure. These are observations or hypotheses, not automatically confirmed exploitable vulnerabilities.

## 8. Previously recorded tool-oriented hypotheses (preserved)

The original threat-model draft contained these security concerns. They remain useful, but tools are **validation mechanisms**, not the starting point for STRIDE.

| Original ID | Concern | Candidate check | Current scope note |
|---|---|---|---|
| T01 | Insecure application code | Semgrep + manual review + targeted tests | Semgrep integrated; findings need triage |
| T02 | Vulnerable application dependencies | Trivy or equivalent SCA | Planned; Python and npm manifests both relevant |
| T03 | Accidental secret exposure | Gitleaks | Planned; do not use genuine credentials for demonstrations |
| T04 | Vulnerable container components | Trivy | Planned; inspect final runtime image |
| T05 | Insecure Infrastructure as Code | Checkov | Planned; no active Terraform resources in this snapshot |

## 9. Next revision — STRIDE scenarios and verification criteria

For each important boundary, create a threat record with:

`ID | Boundary | STRIDE category | Threat actor/preconditions | Attack path | Asset/impact | Existing control | Proposed test | Outcome | Remediation/acceptance`

Start with TB-01 and TB-02. Prioritize scenarios that are reproducible without exposing the application publicly. Preserve before/after evidence and include regression tests for remediated weaknesses. Risk ratings will be assigned after likelihood, impact, and actual exposure are examined; do not label an issue 'critical' solely because a scanner flags it.

### STRIDE T-01 — Unauthorized shipment status modification

- Boundary: TB-01 (HTTP client → FastAPI)
- Category: Tampering
- Asset: A-02 (shipment status and event history)
- Entry point: PATCH /shipments/{shipment_id}/status
- Threat actor: Any client able to reach the API
- Preconditions: API reachable; valid shipment ID known
- Weakness: No authentication or authorization checks
- Impact: Unauthorized changes to shipment status
- Existing controls: Status values validated by Pydantic;
  Docker Compose limits host exposure to 127.0.0.1

Evidence:
- Test: test_status_change_is_recorded_once
- Result: 1 passed in 0.07s
- HTTP PATCH requests without credentials return 200
  in the isolated test environment.

Risk assessment:
- Current local laboratory: limited exposure
- Public deployment: high-priority security risk

Treatment:
- Accept temporarily for the local educational laboratory.
- Do not expose publicly in the current configuration.
- Require authentication and authorization before
  any public or multi-user deployment.

Status: Remediated for the single-operator LOCAL lab in the authentication update.

Post-remediation controls (see `docs/06-authentication.md`):
- API shipment reads/updates and statistics now require an authenticated session.
- Writes require an anti-CSRF token, including logout.
- Stored password is a salted scrypt hash; opaque sessions are revocable in SQLite.
- Existing shipment data are migrated non-destructively.
- Tests: HTTP 401 without a cookie; HTTP 403 when CSRF is absent or invalid;
  an authenticated operator can use existing shipment workflows.
- This is NOT production IAM: no roles, MFA, IP-based rate limiting, TLS, or multi-user isolation.
- Original T-01 evidence screenshots document the **pre-fix** state.



### STRIDE T-02 — Shipment status transition integrity

**Category:** Tampering — Business Logic Security
**Asset:** Shipment status and event history
**Entry point:** `PATCH /shipments/{shipment_id}/status`

**Security finding**

The original implementation accepted any status change as long as the destination status was valid. This allowed inconsistent transitions, such as `delivered → created`.

**Security requirement**

Only the following transitions are authorized:

- `created → in_transit`
- `in_transit → delivered`

The `delivered` status is terminal. Repeating the current status does not create an additional history event.

**Remediation**

- Added a server-side transition allowlist in `app/database.py`.
- Added the `InvalidStatusTransition` exception.
- Updated `app/main.py` to return `HTTP 409 Conflict` for forbidden transitions.
- Preserved shipment records and history when a transition is rejected.

**Verification evidence**

- Before remediation: `delivered → created` returned HTTP 200.
- After remediation: the same transition returns HTTP 409.
- Added automated tests for all four forbidden transitions.
- Verified that rejected transitions do not modify shipment data or event history.
- Full regression suite: **40/40 Pytest tests passed**.

**Residual risk**

Status transitions are now restricted, but the application does not yet authenticate or authorize API clients. Any client able to reach the API can still request permitted transitions.

**Status:** Remediated and verified by automated tests. Runtime validation pending.


## 10. Review status

- [x] Baseline code and configuration inventoried.
- [x] Scope, assumptions, actors, assets, data flows, and trust boundaries drafted.
- [ ] STRIDE threat scenarios documented and prioritized.
- [ ] Security hypotheses exercised in the authorized lab.
- [ ] Findings triaged and documented with reproducible evidence.
- [ ] Remediations and regression tests validated.
- [ ] CI security gates defined and demonstrated.
