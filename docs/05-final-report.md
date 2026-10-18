# SecureShip — DevSecOps Security Assessment Report

**Project:** SecureShip — Automated Application Security & DevSecOps Pipeline\
**Assessment baseline:** 18 October 2026\
**Status:** Initial application-security hardening and seven-job CI integration completed; residual risks remain open\
**Repository:** [saadkvp03/SecureShip](https://github.com/saadkvp03/SecureShip)\
**Integration reference:** [Security-hardening PR #2](https://github.com/saadkvp03/SecureShip/pull/2)\
**Scope:** Authorized, **localhost-only** educational laboratory using fictional shipment data

> **Reporting boundary:** This is the report for the **completed initial DevSecOps hardening phase**, not a claim that SecureShip has completed every security assessment. OWASP ZAP DAST, cloud deployment, production IAM, and formal penetration testing have **not** been completed. Findings reflect the recorded October 2026 baseline, not a continuously verified security status.

## 1. Executive summary

SecureShip is a working shipment-management application built with a FastAPI backend, a React/TypeScript frontend and a SQLite database. It serves as a reproducible exercise in building an application, identifying security concerns, applying carefully scoped remediations and enforcing automated checks during software changes.

The initial hardening phase delivered:

- Server-enforced shipment-state transitions and regression tests.
- A local single-operator authentication boundary using salted scrypt password hashes, revocable server-side sessions and CSRF protection.
- Reviewed Semgrep SQL-construction alerts, narrowly scoped source suppressions and a SQL-injection regression test.
- A smaller, hardened Docker runtime image, with a non-root process and persistent SQLite storage.
- Seven GitHub Actions jobs for tests, frontend validation, Docker/Trivy, Semgrep, Gitleaks, dependency auditing and Checkov.
- Documented scanner findings, residual risks and evidence of successful validation.

**Outcome:** All seven jobs passed on the documented CI baseline, and security-hardening PR #2 was merged into `main`. The application is appropriate as a **local DevSecOps laboratory**, not as an Internet-facing production service. The remaining Trivy and npm development-toolchain findings must continue to be tracked.

## 2. Application, scope and architecture

### 2.1 Implemented application

| Component | Implemented role |
| --- | --- |
| Backend | Python 3.11, FastAPI, Pydantic; shipment APIs, authentication, business rules and statistics |
| Frontend | React 18, TypeScript and Vite; local login, dashboard, shipment management and status history |
| Database | SQLite (`shipments`, `shipment_events`, `auth_sessions`); data preserved across container rebuilds through a named volume |
| Container | Multi-stage frontend build and Python runtime; non-root UID 10001; health check |
| Source control | Git and GitHub; reviewed changes merged to `main` |
| CI and security | GitHub Actions with seven jobs and selected blocking security gates |

The Docker Compose deployment publishes the application on **`127.0.0.1:8000`**. It does not expose a public production endpoint. The Python service listens inside the container, while the Compose host-port binding limits access to loopback on the host.

### 2.2 Software delivery workflow

```text
Developer -> local code/test/build checks -> Git commit/push -> GitHub
                                         -> GitHub Actions
                                             |-- test (Pytest)
                                             |-- frontend (Vite build)
                                             |-- semgrep (SAST)
                                             |-- gitleaks (Git history)
                                             |-- sca (pip-audit + npm audit --omit=dev)
                                             |-- checkov (Dockerfile + Actions)
                                             `-- docker (after test + frontend)
                                                    |-- build / smoke tests
                                                    |-- Trivy complete JSON report
                                                    `-- fixable HIGH/CRITICAL gate
                                         -> review results and merge when accepted
```

The pipeline **validates** changes; it does **not** automatically deploy SecureShip to a cloud or production environment. The `docker` job depends on `test` and `frontend`; the four independent security jobs can run in parallel.

For visual explanations, see the [global workflow](assets/workflow-global.png), [code-change flow](assets/workflow-code-change.png), and [actual CI job graph](assets/github-actions-job-graph.png).

## 3. Security controls and remediations

### 3.1 T-01 — Access control and authentication

**Prior state:** Shipment and statistics endpoints were accessible without operator authentication in the earlier local laboratory implementation.

**Implemented:** A single locally configured operator, salted scrypt password hash in Git-ignored `.env`, random opaque cookie-based sessions, server-side session revocation, `HttpOnly` and `SameSite=Strict` cookie attributes, and a required `X-CSRF-Token` header on writes and logout. The database stores SHA-256 hashes of session tokens rather than raw session cookies.

**Validation:** Anonymous API access receives HTTP 401; incorrect credentials are rejected; requests with a valid session but missing/invalid CSRF tokens are rejected with HTTP 403; logout and expiry invalidate sessions. These behaviors are covered by [`tests/test_auth.py`](../tests/test_auth.py) and the Docker CI smoke test. See [Authentication design](06-authentication.md).

**Limitations:** Single operator, no RBAC/MFA, no demonstrated rate limiting, and an HTTP-only loopback session cookie with `Secure=False`. **Never reuse these settings on an Internet-facing deployment.**

### 3.2 T-02 — Shipment status integrity

**Prior risk:** An allowed status *value* did not necessarily represent an allowed business transition.

**Implemented:** Server-side transitions `created -> in_transit -> delivered`. Unsupported transitions, such as `created -> delivered`, return HTTP 409; valid changes retain an event history. Regression tests exercise the business rule independently of the UI.

**Limitations:** Event history documents changes, but it is not a tamper-evident audit log or a full multi-user accountability system.

### 3.3 SAST and SQL-query review

Semgrep initially reported **three** SQL-construction alerts in `app/database.py`. Two concern schema-migration `ALTER TABLE` construction and one concerns `SELECT COUNT` construction. Review found that the interpolated SQL identifiers/fragments came from application-defined allowlists and that user-provided values were bound separately through SQLite `?` parameters.

**Treatment:** Rule-specific `nosemgrep` comments were added only at the reviewed locations. A regression test with `' OR 1=1 --` was added in `tests/test_sqli_regression.py`, and Semgrep was configured as a blocking CI job using `--error`. The tested source then passed the gate.

**Limitations:** These were assessed as **likely false positives for the reviewed paths**, not proof that all queries and all injection techniques are safe. See [Semgrep triage](07-semgrep-triage.md).

### 3.4 Docker-image hardening

The runtime-image hardening introduced `requirements-runtime.txt`, removed unnecessary Python packaging tools (`pip`, `setuptools`, `wheel`) after installation and applied an available targeted Debian `liblzma5` update. The multi-stage build, non-root UID 10001 and container health check were preserved.

**Observed local Trivy totals:**

| Stage | Total reported findings |
| --- | ---: |
| Initial image | **175** |
| After runtime dependency reduction | **166** |
| After targeted Debian update | **164** |

The final documented local inventory contained **0 CRITICAL, 44 HIGH, 58 MEDIUM, 61 LOW and 1 UNKNOWN** finding. Its Trivy gate passed because it blocks only **fixable HIGH/CRITICAL** issues (`--ignore-unfixed`); it **does not** certify an image free of vulnerabilities. Full JSON reporting is preserved through a GitHub Actions artifact with a 14-day retention period.

## 4. Seven-job CI and security assessment results

| Job | Control | Validated outcome / interpretation |
| --- | --- | --- |
| `test` | Backend and security regression tests | Local suite: **53/53 tests passed**; CI job passed |
| `frontend` | React/TypeScript/Vite production build | Build passed |
| `docker` | Container build, authenticated smoke tests, Trivy | Job passed; full vulnerability report still contains residual advisories |
| `semgrep` | OSS static analysis with `--error` | Passed after triage of the three original alerts |
| `gitleaks` | Full Git-history secret detection | No leaks detected in the SecureShip history baseline |
| `sca` | `pip-audit -r requirements.txt` and `npm audit --omit=dev` | No known vulnerabilities reported **in the scanned Python and npm production scopes** |
| `checkov` | Dockerfile and GitHub Actions configuration policies | Job passed; recorded local checks: Dockerfile 9/9, GitHub Actions 159/159 |

**CI evidence:** [Successful workflow on `main` (18 October 2026)](https://github.com/saadkvp03/SecureShip/actions/runs/39137370956) and [merged PR #2](https://github.com/saadkvp03/SecureShip/pull/2), which had **14 successful PR checks** recorded during the merge process.

**Separate local validation:** Actionlint and ShellCheck found an unused variable in a workflow shell loop (`SC2034`); it was corrected and the subsequent local lint check was clean. **Actionlint is not an eighth CI job.**

### 4.1 Demonstrated detection behavior

- A **separate disposable local Git repository**, never the SecureShip repository, was used with a synthetic token. Gitleaks detected it in commit history even after it was deleted from the latest file. This demonstrates why deleting a secret in a later commit is insufficient.
- A separate local Semgrep demonstration fixture produced blocking findings, while the reviewed project scan reported no unsuppressed findings in the recorded run. A demonstration fixture is **not** evidence of a failed GitHub Actions run on SecureShip.
- The SQLi regression test used an isolated temporary SQLite database and established that one representative payload was treated as data in the tested filter paths.

Selected, reviewed screenshots are included in the [README evidence section](../README.md), with the original images under `docs/assets/`. These are **historical evidence of the stated October 2026 baseline**, not continuously updated security results. In particular, the Gitleaks synthetic-token demonstrations were run in a **separate disposable repository**, not in SecureShip's history.

| Evidence group | Published supporting images | What they demonstrate |
| --- | --- | --- |
| Application and container | [Login](assets/app-login.png), [dashboard](assets/app-dashboard.png), [Docker Desktop](assets/docker-desktop.png) | Local UI and Docker Compose runtime; not proof of a public deployment |
| Test suite and CI | [53 passing tests](assets/pytest-53-passed.png), [GitHub Actions job graph](assets/github-actions-job-graph.png) | Recorded functional/security regression and CI execution |
| Semgrep SAST | [Initial findings](assets/semgrep-before-triage.png), [after triage](assets/semgrep-after-triage.png), [blocking demonstration](assets/semgrep-blocking-demo.png) | Review/triage and a separate controlled blocking example |
| SQL-injection regression | [Targeted SQLi test](assets/sql-injection-regression.png) | Tested payload handled as data in the selected query paths |
| Gitleaks historical detection | [Initial detection](assets/gitleaks-history-detected.png), [after removal](assets/gitleaks-history-after-deletion.png), [working-tree check](assets/gitleaks-working-tree-clean.png) | Detection of a **synthetic** token in a disposable Git history |

The complete Trivy vulnerability JSON and local audit reports were retained separately; the GitHub Actions Trivy artifact has **14-day retention**. Do not publish real credentials or raw sensitive scanner outputs.

## 5. Residual-risk register

| Risk | Current status | Required follow-up |
| --- | --- | --- |
| Trivy Debian/image advisories | **Open:** 164 total findings on the recorded local full scan, including 44 HIGH and no CRITICAL | Recheck complete image scans and apply safe base-image/OS updates as fixes become available |
| npm development/build dependencies | **Open:** 9 affected packages in full local audit (6 HIGH, 3 MODERATE); production-only audit passed | Plan a controlled toolchain upgrade and retest build, full audit and runtime behavior |
| Local-only single-operator IAM | Intentional laboratory limitation | HTTPS, secure cookies, rate limiting, account/role controls, monitoring and privacy review before any public exposure |
| Semgrep suppressions | Reviewed exceptions in specific SQL-building code | Reassess when those code paths, trusted mappings or rule versions change |
| Dynamic attack coverage | **Not started:** OWASP ZAP DAST | Perform scoped, authorized local testing; triage results without exposing the app publicly |
| CI/dependency provenance | Improvement area | Consider stronger pinning, recurring audits, review policy and Actionlint automation |

A successful scan or CI run is **evidence of particular controls at a given time**, not a formal penetration-test result, vulnerability-free guarantee or production risk acceptance.

## 6. Evidence and reproducibility

**Repository references:**

- [Scope and architecture](01-scope-architecture.md)
- [Threat model](02-threat-model.md)
- [Security findings and triage](03-security-findings.md)
- [Remediation and validation](04-remediation-validation.md)
- [Authentication and session design](06-authentication.md)
- [Semgrep triage and CI validation](07-semgrep-triage.md)
- [CI workflow](../.github/workflows/ci.yml)

**Security work history:** [state transitions (`7e4b178`)](https://github.com/saadkvp03/SecureShip/commit/7e4b178), [authentication (`807493f`)](https://github.com/saadkvp03/SecureShip/commit/807493f), [Semgrep (`ae8bbf4`)](https://github.com/saadkvp03/SecureShip/commit/ae8bbf4), [Docker/security CI (`ddff5e5`)](https://github.com/saadkvp03/SecureShip/commit/ddff5e5).

**Representative local validation commands (from the repository root):**

```bash
python -m pytest -q
semgrep scan --config auto --error app/ frontend/src/
cd frontend && npm run build && cd ..
docker compose build
```

**Evidence hygiene:** Use fictional records and disposable test credentials. Do not commit `.env`, session cookies, authentication headers, CSRF tokens, local SQLite databases, complete secret-scanner outputs containing sensitive content, or Docker named-volume data. Published screenshots must be reviewed and redacted. Do **not** run `docker compose down -v` if you need to preserve shipment data.

**Reproducibility limitation:** Scanner databases, base-image tags, supported package versions, network package sources and runner architectures can change. Record the Git commit, architecture, tool version, policy, command and date when comparing future audits.

## 7. Conclusion and next phase

The initial SecureShip application-security and DevSecOps hardening phase was implemented, tested, documented and integrated into the `main` branch through PR #2. The recorded 18 October 2026 baseline validates a functional locally hosted application, security regression testing, a hardened Docker runtime and a seven-job CI pipeline with selected blocking controls.

**The project is not yet a production service or a complete security assessment.** Residual OS and npm toolchain advisories remain open, and active DAST has not been performed. Next steps are to keep documentation and evidence current, reassess outstanding vulnerabilities, and conduct a separately authorized OWASP ZAP assessment against localhost.
