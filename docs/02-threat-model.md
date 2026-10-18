# SecureShip — Threat Model (STRIDE)

**Assessment baseline:** 18 October 2026\
**System:** [SecureShip](https://github.com/saadkvp03/SecureShip) — FastAPI, React, SQLite, Docker, GitHub Actions\
**Scope:** Authorized, **localhost-only** security laboratory using fictional shipment data\
**Status:** Updated after security-hardening [PR #2](https://github.com/saadkvp03/SecureShip/pull/2) was merged into `main`\
**Related:** [Architecture](01-scope-architecture.md) · [Security findings](03-security-findings.md) · [Remediation and validation](04-remediation-validation.md) · [Authentication](06-authentication.md)

> **Assessment boundary:** This is a threat model of the implemented October 2026 application and its software-delivery workflow. It distinguishes verified mitigations from open threats and test limitations. Passing CI is **not** proof of complete security, a penetration-test certification, or approval for public deployment. OWASP ZAP DAST has **not** yet been performed.

## 1. Purpose and method

This model identifies important assets, actors, entry points and trust boundaries; then examines plausible threats using **STRIDE**:

| STRIDE category | Security question in SecureShip |
| --- | --- |
| **S — Spoofing** | Can someone impersonate the local operator or reuse a session? |
| **T — Tampering** | Can requests, SQL input, status transitions, code or configuration be modified without authorization? |
| **R — Repudiation** | Can a shipment change be attributed to a specific actor and investigated afterward? |
| **I — Information disclosure** | Can shipment records, credentials, cookies or build secrets be exposed? |
| **D — Denial of service** | Can requests, malformed inputs or resource exhaustion make the local service unavailable? |
| **E — Elevation of privilege** | Can an untrusted caller, dependency or CI step obtain authority beyond its intended boundary? |

For each scenario, this document records the **threat path**, the **implemented control**, **actual validation where available**, and the **remaining risk**. Threat possibilities are not automatically confirmed vulnerabilities; scanner alerts are investigated before being classified.

## 2. Scope and assumptions

### 2.1 In scope: implemented system

- React 18 / TypeScript / Vite frontend, served at `/app` by FastAPI after the production build or through Vite in development.
- FastAPI / Python 3.11 shipment management endpoints, input validation and server-side shipment lifecycle rules.
- **Single local operator** configured in Git-ignored `.env`; salted scrypt password hash, opaque session cookie, server-side sessions, logout and anti-CSRF header validation.
- SQLite `shipments`, `shipment_events` and `auth_sessions` tables, schema migrations, bound SQL values and a persistent Docker volume.
- Multi-stage Docker image: Node frontend builder; reduced Python runtime; non-root user **UID 10001**; health check; host port published on `127.0.0.1:8000` by Compose.
- GitHub source control and **seven GitHub Actions jobs**: `test`, `frontend`, `docker`, `semgrep`, `gitleaks`, `sca`, `checkov`.
- Recorded tests, SAST triage, dependency audits, Trivy vulnerability reporting/gate, secret scanning and configuration checks.

### 2.2 Out of scope or not implemented

- Public Internet exposure, cloud hosting, deployed Terraform, Kubernetes and production deployment automation.
- Multi-user IAM, authorization roles, tenant isolation, MFA, production login throttling, or an incident-grade audit trail.
- Real customer data, payment systems and integration with an actual logistics provider.
- TLS/HTTPS in the loopback-only setup. The session cookie deliberately has `Secure=False` for local HTTP; **this must not be carried into a public deployment**.
- Completed runtime penetration testing / **OWASP ZAP DAST**. This is a planned, separately scoped activity.

### 2.3 Threat-model assumptions

- Shipments are fictional. Sensitive-looking values in demos and screenshots should not be real customer data or credentials.
- Compose binds the **host** to `127.0.0.1:8000`; Uvicorn may listen on `0.0.0.0` **inside** its container. Localhost binding reduces remote exposure but does not stop other local processes.
- The browser interface and tracking references do **not** enforce authorization: FastAPI must check each protected API request.
- Docker persistence protects records across container recreation, **not** against deletion of the named volume, corruption or disk failure. There is no demonstrated backup-and-restore control.
- Repository settings such as mandatory reviews, branch protection and required status checks are **not established by the source files alone**; do not assume they are enforced.

## 3. System and data flows

### 3.1 Application and trust boundaries

```text
 Local operator / browser / local HTTP client
                      |
          [TB-01: client -> API]
                      v
            FastAPI + Uvicorn
       Pydantic request validation
       Session / CSRF verification
       Shipment transition rules
                 |       ^
     [TB-02]     |       | [TB-06: cookie/session]
                 v       |
             SQLite data layer
    Bound parameters; application allowlists
                      |
       shipments / shipment_events /
       auth_sessions (token digests)
                      |
         [TB-03: file / volume]
                      v
      Local database or Docker named volume

 Host access through Docker Compose: 127.0.0.1:8000
```

In frontend development, Vite serves `/app` on port 5173 and proxies API requests; in the built or Docker configuration, FastAPI serves the compiled frontend and API on port 8000. The data API remains protected in either mode.

### 3.2 Software-delivery flow

```text
 Developer edits code / dependencies / configuration
                       |
                 Local validation
                       |
                  Git commit/push
                       |
             [TB-04: code -> CI]
                       v
                   GitHub Actions
                       |
       +---------------+--------------------------+
       |               |                          |
       v               v                          v
  test (Pytest)   frontend (build)      Independent security jobs
       |               |              semgrep / gitleaks / sca / checkov
       +-------+-------+                          |
               v                                  |
         docker job                              |
      Build + smoke test                          |
      Trivy full report + fixable HIGH/CRITICAL gate
               |                                  |
               +------------------+---------------+
                                  v
                         CI status / review
                   Failure -> investigate and fix
                   Success -> review / merge as applicable
```

The `docker` job explicitly depends on `test` and `frontend` (`needs: [test, frontend]`). Semgrep, Gitleaks, SCA and Checkov run independently. **There is no automatic production deployment stage.** Actionlint + ShellCheck were run **locally**, not as an eighth CI job.

### 3.3 Data-flow inventory

| ID | Source → destination | Data / operation | Implemented protection |
| --- | --- | --- | --- |
| DF-01 | Browser or local HTTP client → FastAPI | Login, shipment operations, statistics | Pydantic validation; protected shipment/statistics endpoints require session; writes additionally require CSRF |
| DF-02 | FastAPI → SQLite | Shipment reads/writes; status/event changes | Bound SQL values; fixed fragments/identifier allowlists; server-enforced transitions |
| DF-03 | FastAPI → browser | Shipment data, tracking references, status history | Protected API responses require valid session |
| DF-04 | Browser ↔ authentication endpoints | Username/password, opaque session cookie, CSRF token | scrypt verifier; HttpOnly + SameSite Strict cookie; server-side expiry/revocation; CSRF header checks |
| DF-05 | Runtime → SQLite volume | Persist database including session-token digests | Non-root container; local volume; Git exclusions; no volume backup claim |
| DF-06 | Contributor → GitHub → Actions | Commits, PRs, workflow and dependency edits | CI tests/scans; read-only default workflow contents permission; review requirements not assumed |
| DF-07 | CI → registries/base images → container artifact | Python/npm packages, Docker base-image components | Audits, Checkov, Trivy; residual supply-chain and unfixed advisory risks |

## 4. Assets and security properties

| ID | Asset | Important properties | Reason |
| --- | --- | --- | --- |
| **A-01** | Fictional shipment data | Confidentiality, integrity | Data must not be disclosed or altered by anonymous callers |
| **A-02** | Shipment status and event history | Integrity, accountability | False transitions undermine the recorded shipment lifecycle |
| **A-03** | SQLite file and named Docker volume | Integrity, availability | Loss, corruption or volume deletion affects persisted data |
| **A-04** | Local operator password hash and `.env` | Confidentiality, integrity | Credential compromise can permit impersonation |
| **A-05** | Session cookies, CSRF tokens and session database rows | Confidentiality, integrity | Stolen or forged session material can defeat the local access boundary |
| **A-06** | FastAPI and frontend availability | Availability | Resource exhaustion disrupts testing and operator access |
| **A-07** | Git history, source code, CI workflow, manifests | Integrity, confidentiality | Changes can introduce vulnerabilities, suppress checks or leak secrets |
| **A-08** | Docker base/runtime and third-party packages | Integrity, provenance | Vulnerable or malicious components can affect builds and execution |
| **A-09** | Security reports and evidence | Integrity, confidentiality | Findings must remain traceable without exposing credentials or user data |

## 5. Actors and entry points

| Actor | Assumed reachability | Entry point / relevance |
| --- | --- | --- |
| Authorized local operator | Browser access on developer workstation | `/app`, `/auth/login`, protected `/shipments` and `/stats` |
| Unauthenticated local HTTP client/process | Can contact the host loopback service | `/`, `/health`, `/docs`, `/auth/login`; attempts against protected APIs |
| Process or user with filesystem access | Depends on workstation/container permissions | `.env`, local database, persisted volume, screenshots or scan artifacts |
| Repository contributor / PR author | Depends on GitHub permissions and repository settings | Source code, workflow YAML, manifests and pull requests |
| Package / image / action publisher | Supplies external build inputs | pip, npm, Docker base image, GitHub Actions |
| Hypothetical remote attacker | **Not directly exposed** by the reviewed Compose host binding | Becomes relevant if the service is published externally or scope changes |

## 6. Trust boundaries

| Boundary | Crossing | Main threats / questions |
| --- | --- | --- |
| **TB-01** | Browser/local client → FastAPI | Spoofing, unauthorized reads/writes, CSRF, resource exhaustion |
| **TB-02** | API/business logic → SQLite | SQL injection, invalid transitions, data tampering, missing accountability |
| **TB-03** | Container/runtime → host loopback and persistent volume | Exposure due to changed port mapping, local file access, data loss, privilege misuse |
| **TB-04** | Contributor/source → GitHub Actions | Malicious changes, secret leaks, overly broad permissions, security-check bypass |
| **TB-05** | Registries, base images and actions → built runtime | Vulnerable/malicious dependencies, outdated OS packages and build compromise |
| **TB-06** | Browser-held cookie / anti-CSRF token → server-side session store | Credential replay, session theft, expiry/revocation failures, cross-site requests |

## 7. STRIDE threat register and disposition

This register is **qualitative**; no numerical CVSS, exploitability or business-impact score is invented for this local educational project. “Mitigated in tested scope” does **not** mean zero residual risk.

| ID | STRIDE | Boundary / target | Scenario | Observed controls and validation | Disposition |
| --- | --- | --- | --- | --- | --- |
| **T-01** | S, T, I | TB-01; A-01/A-02 | Anonymous caller reads or modifies shipments (pre-fix API behavior) | Session checks, local scrypt operator, 401 for anonymous access, 403 for writes missing CSRF; authentication tests and CI smoke test | **Remediated for local single-operator scope** |
| **T-02** | T | TB-02; A-02 | Caller skips or reverses shipment states; corrupts history | Server-side transition allowlist; HTTP 409; regression tests confirm rejection | **Remediated in tested transitions** |
| **T-03** | T | TB-01/TB-06; A-02 | Cross-site or unauthorized state-changing request | `SameSite=Strict` cookie and required `X-CSRF-Token`; tests exercise 403 | **Mitigated in tested scope** |
| **T-04** | S, I | TB-06; A-04/A-05 | Password guessing, session theft or replay | Salted scrypt hash, random HttpOnly cookie, hashed token at rest, 8-hour expiry and logout revocation; no rate limiter and no HTTPS in localhost mode | **Partially mitigated; residual risk** |
| **T-05** | T, I | TB-02; A-01/A-03 | SQL injection through dynamic queries | Application-controlled fragments, bound input values, reviewed Semgrep findings and targeted SQLi regression | **Investigated; testing remains scoped** |
| **T-06** | I, T | TB-03; A-03/A-04 | Local database, `.env` or volume accessed, damaged or deleted | Git ignores local secrets/databases, `.env` created with 0600 permissions, non-root image, loopback binding | **Residual local-host and backup risk** |
| **T-07** | D | TB-01/TB-03; A-06 | Excessive login, search or database requests degrade availability | Some input bounds exist; no demonstrated request throttling, load/resilience test or backup recovery | **Open; localhost exposure limits scope** |
| **T-08** | R | TB-02; A-02/A-09 | Operator disputes who changed a shipment | Timestamped shipment events, but no recorded actor identity or incident-grade audit trail | **Open accountability limitation** |
| **T-09** | I | TB-04; A-04/A-07 | Credential accidentally committed to Git | Gitleaks full-history CI gate; no findings in SecureShip; synthetic separate-repo demonstration | **Preventive gate active; detection not exhaustive** |
| **T-10** | T, E | TB-05; A-08 | Known-vulnerable runtime/dependency or malicious upstream component | Minimal runtime requirements, targeted Debian update, Python/npm SCA, Trivy full report and fixable HIGH/CRITICAL gate | **Partially treated; residual advisories remain** |
| **T-11** | T, E | TB-04; A-07 | Insecure workflow change, excessive CI permissions or bypassed security check | `contents: read`, Checkov gate, passing seven-job CI, local Actionlint; branch protection/required checks not verified | **Controls active; governance residual** |
| **T-12** | I, T | TB-01; A-01/A-06 | Unsafe static file path or excessive input exposes assets | Pydantic field bounds; frontend serving resolves paths and checks build-directory containment | **Code-level controls present; no full DAST claim** |

### 7.1 T-01 — Unauthenticated shipment access (historical weakness, remediated)

**Original attack path:** In the early build, a client able to reach the local API could read and modify shipment data without an operator session. The original local demonstrations of HTTP **200/201** document that earlier state; **they are not the current expected API behavior**.

**Remediation:** `scripts/setup_auth.py` configures an operator with a salted scrypt hash in ignored `.env`; `app/auth.py` manages opaque server-side sessions and CSRF tokens; protected FastAPI routes enforce dependencies. Anonymous shipment/statistics requests return **401**, while a valid session without the required CSRF token returns **403** on protected mutations. The Docker CI smoke test validates login, anonymous denial and an authenticated shipment creation.

**Residual boundary:** One local operator is not multi-user authorization. There is no MFA, tenant segregation, account recovery or demonstrated login rate limiting. A real Internet deployment would require a separate security design.

### 7.2 T-02 — Shipment state-machine integrity (historical weakness, remediated)

**Original attack path:** The first implementation accepted transitions between any valid status labels, including logically invalid reversals such as `delivered → created`.

**Remediation:** `app/database.py` defines allowed transitions and raises `InvalidStatusTransition`; `app/main.py` translates an invalid move to **HTTP 409 Conflict**. Only these forward moves are permitted:

```text
created  -->  in_transit  -->  delivered (terminal)
```

Repeating the **current** status is idempotent and does not create an extra history event. A rejected transition does not update the shipment or append an event. Automated transition and authentication regression tests belong to the recorded **53/53 passing** baseline.

**Residual boundary:** The event history stores statuses and timestamps, not independent actor identity. Authorization remains a local single-operator scheme.

### 7.3 T-03/T-04 — Cross-site requests and session misuse

**Implemented controls:** A random session cookie with `HttpOnly`, `SameSite=Strict`, `Path=/` and an eight-hour maximum age; only a **SHA-256 digest** of the opaque cookie is stored in `auth_sessions`. Protected mutating routes and logout require the `X-CSRF-Token` header; invalid/missing token → **403**. Server-side logout revokes the session; expired sessions are rejected. Credentials and tokens are not published in the repository.

**Remaining threats:** The cookie uses `Secure=False` specifically for **localhost HTTP**. That tradeoff would be unacceptable for an Internet deployment. The project has no demonstrated rate limiting against brute-force attempts, no multi-device policy, and no protection against a compromised local browser, process or workstation. `HttpOnly` does not prevent every type of session misuse.

**Evidence:** [`tests/test_auth.py`](../tests/test_auth.py), [`app/auth.py`](../app/auth.py), [`06-authentication.md`](06-authentication.md).

### 7.4 T-05 — SQL injection hypotheses and static-analysis triage

Semgrep originally reported **three** dynamic-SQL alerts in `app/database.py`: two for `ALTER TABLE` and one for `SELECT COUNT`. Review established that interpolated migration identifiers come from the hardcoded `_ADDED_COLUMNS` mapping; dynamically constructed filter clauses come from predefined code fragments and **user values are bound separately** with SQLite `?` parameters.

The targeted regression in [`tests/test_sqli_regression.py`](../tests/test_sqli_regression.py) exercises the payload `' OR 1=1 --` against search and status filters. It did **not** bypass those tested filters. Narrow, explained `nosemgrep` suppressions were added; the Semgrep CI command now uses **`--error`**. The job passed in the verified pipeline.

**Disposition:** Likely false positives **for those three reviewed expressions**, not a blanket declaration that injection is impossible. Any change in trusted SQL-fragment origins, allowed identifiers or input handling requires re-review. See [`07-semgrep-triage.md`](07-semgrep-triage.md).

### 7.5 T-06/T-07/T-08 — Local state, availability and attribution

- **Local state:** `.env` and `*.db` are Git-ignored; account setup creates `.env` with restrictive permissions. Container execution uses a non-root account and a persistent named volume. No automated backup, restore test or protection against a malicious same-host actor is documented.
- **Availability:** Query and input bounds exist (for example, shipment field length limits and bounded optional pagination), but pagination is optional and no performance/load/rate-limiting assessment has been established. Localhost exposure reduces remote attack opportunities; it does not eliminate exhaustion scenarios.
- **Accountability:** `shipment_events` records transitions and timestamps, but does not capture who initiated them. The single operator simplifies the lab; it does not satisfy production audit or non-repudiation requirements.

**Safety:** Do not run `docker compose down -v` against the existing data volume. Never include `.env`, SQLite data, cookies, CSRF tokens or unredacted secrets in Git or public screenshots.

### 7.6 T-09/T-10/T-11 — Repository, CI and supply-chain threats

**Secrets (Gitleaks).** GitHub Actions scans full repository history using Gitleaks. No SecureShip leak was reported in the validated baseline. A **separate disposable test Git repository** containing a synthetic, nonfunctional token demonstrated that history scanning can detect a token after deletion from the working tree. This was not a real credential or a SecureShip commit.

**Container and dependency inventory.** Trivy's local image findings decreased from **175** to **164** after narrowing runtime dependencies, removing unnecessary packaging utilities and applying an available `liblzma5` update. The recorded **164** included **44 HIGH** and **0 CRITICAL** findings, many concerning Debian packages without an identified fix at scan time. The separate gate fails on **fixable HIGH/CRITICAL** vulnerabilities via `ignore-unfixed: true`; therefore a passing job does **not** mean the image has no HIGH findings. The full JSON artifact is uploaded with 14-day retention.

**SCA.** Local `pip-audit -r requirements.txt` and `npm audit --omit=dev` reported no known vulnerabilities in their scanned scopes at the assessment time. A **full** npm audit also reported **9** development/build-tooling-related findings (**6 HIGH, 3 MODERATE**) that remain open for planned upgrade/retest. A production-only audit does not eliminate build-chain risk.

**Configuration and workflow.** Checkov validation recorded **9/9** passing Dockerfile checks and **159/159** passing GitHub Actions checks locally; CI's Checkov gate passed. Workflow permission `contents: read` reduces the default token's authority. Actionlint + ShellCheck was executed **locally**, not inside GitHub Actions. These checks do not establish that mandatory PR reviews or branch-protection settings exist.

## 8. Mapping the initial scanner hypotheses to the current baseline

The earlier draft used unhyphenated labels `T01`–`T05` for **tool-oriented hypotheses**, and hyphenated `T-01` / `T-02` for application threats. To avoid mixing these distinct numbering schemes, the former are shown as **legacy items** below; threat IDs in Section 7 are the authoritative STRIDE identifiers.

| Original tool item | Concern | Implemented check | Current interpretation |
| --- | --- | --- | --- |
| Legacy `T01` | Insecure application code | Semgrep, manual SQL triage, Pytest regression | Blocking SAST active; three initial SQL alerts reviewed |
| Legacy `T02` | Vulnerable application dependencies | `pip-audit`, production-scope `npm audit` | CI checks active; full npm development-tooling issues remain |
| Legacy `T03` | Accidentally committed secrets | Gitleaks full Git history | Blocking CI scan active; separate synthetic-secret demonstration |
| Legacy `T04` | Vulnerable container components | Trivy full report + fixable HIGH/CRITICAL gate | Gate active; unfixed image advisories tracked |
| Legacy `T05` | Insecure Infrastructure as Code | Checkov Dockerfile + GitHub Actions workflow scan | Checks active; no deployed Terraform resources |

Tool execution supports security investigation; it does **not** replace the underlying STRIDE analysis or demonstrate exploitability by itself.

## 9. Risk review and next verification activities

| Priority for continued work | Action | Reason / expected evidence |
| --- | --- | --- |
| **High before any wider exposure** | Re-design authentication, TLS and authorization for any planned non-local deployment | Existing controls were built deliberately for loopback HTTP and a single operator |
| **Ongoing** | Re-scan Trivy and review the full findings report when base-image fixes become available | The complete October 2026 image inventory contains residual HIGH advisories |
| **Ongoing** | Review / safely upgrade affected npm development dependencies | Full npm audit identified unresolved build-tool advisories |
| **Before code changes in SQL layer** | Reassess allowlists, parameter binding and narrow Semgrep suppressions | Trusted-fragment assumptions can change as code evolves |
| **Future hardening** | Evaluate request throttling, structured security logs, actor attribution and backup/restore | Current local controls do not address all denial-of-service, repudiation or data-loss scenarios |
| **CI governance** | Verify actual branch rules/required status checks; consider Actionlint in CI and tighter action pinning | Workflow success alone is not a guaranteed merge or supply-chain policy |
| **Planned separate milestone** | Authorized OWASP ZAP DAST against a controlled local test instance | Dynamic behavior and attack paths remain outside completed static/CI validation |

**Risk status is contextual:** A localhost-only educational demonstration may document and track an unremediated risk; this is **not** a formal acceptance of the same risk for a production service. Reassess exposure and controls if the environment changes.

## 10. Evidence and review status

### Completed or supported by the recorded baseline

- [x] Inventory application, data and delivery-system assets, entry points, actors and trust boundaries.
- [x] Record STRIDE scenarios with implemented controls and residual limitations.
- [x] Remediate and test **T-01** authenticated API access and CSRF protections for the local operator.
- [x] Remediate and test **T-02** server-enforced shipment transitions with HTTP 409 rejection.
- [x] Triage Semgrep's original three SQL-construction alerts and preserve the targeted SQLi regression.
- [x] Add and validate seven GitHub Actions jobs, including Semgrep/Gitleaks/SCA/Checkov and Docker/Trivy gates.
- [x] Record the **53/53** passing Pytest baseline and the merged [PR #2](https://github.com/saadkvp03/SecureShip/pull/2).
- [x] Record residual Trivy advisories and npm development-toolchain findings without treating them as fixed.

### Not completed or not demonstrated

- [ ] Authorized OWASP ZAP DAST or a comprehensive runtime penetration test.
- [ ] Production-grade IAM, TLS, rate limiting, audit-grade attribution and verified backup/restore.
- [ ] Verification that GitHub repository protections require review and passing CI before merge.
- [ ] Exhaustive SQL injection, session, denial-of-service and software-supply-chain security coverage.

### Evidence and further reading

- [Application scope and architecture](01-scope-architecture.md)
- [Findings and residual risks](03-security-findings.md)
- [Remediation and validation](04-remediation-validation.md)
- [Authentication security design](06-authentication.md)
- [Semgrep findings triage](07-semgrep-triage.md)
- [SecureShip CI workflow](../.github/workflows/ci.yml) and [successful GitHub Actions run](https://github.com/saadkvp03/SecureShip/actions/runs/39137370956)
- [README and selected evidence images](../README.md)

**Evidence-handling rule:** Publish only intentionally selected, redacted screenshots and scanner summaries. Keep genuine credentials, `.env`, local databases, session tokens, cookies and raw sensitive scan artifacts outside public Git history.

---

*SecureShip — Threat modeling for an authorized, localhost-only cybersecurity and DevSecOps laboratory. Baseline dated 18 October 2026.*
