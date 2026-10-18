# 04 — Security Remediation and Validation

**Project:** SecureShip\
**Validation baseline:** 18 October 2026\
**Environment:** Authorized, localhost-only FastAPI + React + SQLite security laboratory\
**Related records:** [Security findings](03-security-findings.md) · [Threat model](02-threat-model.md) · [Authentication design](06-authentication.md) · [Semgrep triage](07-semgrep-triage.md) · [Security-hardening PR #2](https://github.com/saadkvp03/SecureShip/pull/2)

> **Purpose:** Link each implemented remediation or preventive security control to the validation actually performed. This is a record of the October 2026 baseline, not proof that the application is vulnerability-free or ready for deployment on the public Internet. Where a risk was not fixed, it is explicitly recorded as open.

## 1. Remediation and validation summary

| Area | Change or decision | Validation evidence | Disposition |
| --- | --- | --- | --- |
| Shipment integrity | Enforce server-side `created → in_transit → delivered` state transitions; reject invalid transitions with HTTP 409 | Automated shipment/status tests in the 53-test suite | Implemented; tested |
| Authentication and sessions | Local scrypt password hashes; opaque HttpOnly session cookies; server-side session revocation; CSRF protection | Automated authentication tests and Docker CI smoke test | Implemented for **local-only** use |
| Semgrep findings | Investigate three SQL-construction alerts; retain narrowly scoped, explained `nosemgrep` suppressions | Targeted SQL injection regression and passing blocking Semgrep job | Reviewed, with stated limits |
| Python container runtime | Install only runtime packages using `requirements-runtime.txt`; remove `pip`, `setuptools`, `wheel` after installation | Successful Docker build, application smoke tests, lower Trivy inventory | Implemented |
| Debian security update | Upgrade `liblzma5` in the runtime image | Image rebuild and Trivy rescan (166 → 164 OS findings) | Implemented for observed baseline |
| Container vulnerability gate | Generate full Trivy JSON report; fail on **fixable HIGH/CRITICAL** vulnerabilities | Local Trivy gate and successful GitHub Actions `docker` job | Active; residual issues tracked |
| Python and npm SCA | Automate `pip-audit` and production-scope npm audit | Local audits and successful `sca` job | Active; npm dev-tool advisories remain open |
| Git-history secrets | Scan the repository's full Git history using Gitleaks | No SecureShip leaks detected; separate synthetic-token experiment | Active; no leak detected in tested scope |
| Configuration security | Check Dockerfile and GitHub Actions using Checkov | 9/9 Dockerfile and 159/159 workflow check instances passed locally; CI job passed | Active |
| Workflow quality | Fix ShellCheck `SC2034` unused variable in Docker smoke test | `actionlint .github/workflows/ci.yml` returned no findings after correction | Fixed; **local** lint only |

The table distinguishes **remediation** (changing an unsafe or unnecessary condition), **preventive controls** (adding automated detection), and **risk tracking** (documenting findings that are not yet remediated).

## 2. Application security remediation

### 2.1 Shipment-state integrity

**Problem addressed:** Unrestricted status changes could compromise the consistency of a shipment's lifecycle and history.

**Implementation:** The API enforces valid transitions along the defined state machine:

```text
created  →  in_transit  →  delivered
```

Invalid transitions are rejected by the backend with HTTP **409 Conflict** rather than relying on frontend restrictions. Legitimate status changes remain associated with their event history.

**Validation:** Shipment/status and regression tests were included in the Python suite. The final local run recorded **53 passed** (`python -m pytest -q`). This validates the tested transition scenarios, not every possible concurrency or database-failure condition.

**Traceability:** `app/main.py`, `app/database.py`, `tests/`, commit [`7e4b178`](https://github.com/saadkvp03/SecureShip/commit/7e4b178).

### 2.2 Local operator authentication and CSRF

**Problem addressed:** The earlier application exposed shipment APIs without operator authentication.

**Implementation:**

- Add a single, locally configured operator; store only the salted **scrypt password hash** in the Git-ignored `.env`.
- Issue an opaque, random session cookie with `HttpOnly` and `SameSite=Strict`; store a SHA-256 digest of the session identifier and its expiration in SQLite.
- Require an authenticated session for shipment and statistics APIs; anonymous requests are expected to return **HTTP 401**.
- Require an `X-CSRF-Token` for protected mutating requests and support server-side session revocation on logout.
- Keep the intended local-only HTTP behavior explicit: `Secure=False` is **not appropriate for a public HTTPS deployment**.

**Validation:** Authentication regressions are covered by `tests/test_auth.py`. The GitHub Actions Docker smoke test creates throwaway **CI-only** credentials, starts the container, verifies health and login, checks anonymous shipment access returns 401, creates a shipment with a CSRF token and reads statistics. The local Python suite passed **53/53**, and the relevant CI jobs completed successfully.

**Boundary:** This is not a production identity system: there is no multi-user IAM, public TLS deployment or demonstrated brute-force throttling. Do not present successful login tests as a full authentication penetration test.

**Traceability:** `app/auth.py`, `app/main.py`, `scripts/setup_auth.py`, `tests/test_auth.py`, [`docs/06-authentication.md`](06-authentication.md), commit [`807493f`](https://github.com/saadkvp03/SecureShip/commit/807493f).

### 2.3 Semgrep SQL-construction alerts

**Observation:** Semgrep initially reported **three** alerts in `app/database.py`: two dynamic `ALTER TABLE` statements and one dynamic `SELECT COUNT` statement.

**Investigation:** The migration's column identifiers originate from a fixed application-controlled mapping, and the query builder uses fixed SQL fragments while binding user-controlled values using SQLite `?` parameters. These specific alerts were assessed as **likely false positives**, rather than categorically dismissing SQL injection risk.

**Treatment and validation:** Narrow `nosemgrep` comments were added with justification. A SQL injection regression using `' OR 1=1 --` returned no matches in the tested search/status paths. The blocking CI command is:

```bash
semgrep scan --config auto --error app/ frontend/src/
```

The Semgrep job passed after triage, and the Python regression suite passed **53/53**. A suppression remains safe only while the surrounding trusted-input assumptions hold; it must be reviewed if those SQL-building functions change.

**Traceability:** `app/database.py`, `tests/test_sqli_regression.py`, [`docs/07-semgrep-triage.md`](07-semgrep-triage.md), commit [`ae8bbf4`](https://github.com/saadkvp03/SecureShip/commit/ae8bbf4).

## 3. Container image remediation and verification

### 3.1 Remove unnecessary packages from the runtime image

**Before:** The Docker runtime installed the entire development dependency inventory. Trivy identified **9 Python packaging findings** in the initial image; development/test packages and packaging utilities were also present.

**Changes:**

- Add `requirements-runtime.txt`, constrained by `requirements.txt`, to install `fastapi==0.143.0` and `uvicorn==0.54.0` with their runtime dependencies.
- Remove `pip`, `setuptools` and `wheel` after installing the required packages.
- Preserve the multi-stage frontend build, the non-root UID **10001** and the container health check.

**Validation:** The hardened image built successfully and passed the backend/frontend smoke tests. Runtime-package inspection during the local assessment confirmed the removed Python packaging tools and test-only packages were absent. The Python-related findings reported in the original Trivy inventory were no longer reported in the hardened image.

**Traceability:** `Dockerfile`, `requirements-runtime.txt`, [PR #2](https://github.com/saadkvp03/SecureShip/pull/2).

### 3.2 Apply the available Debian `liblzma5` update

**Before:** The Debian runtime image included `liblzma5` version `5.8.1-1+deb13u1`, with an available security update in the assessed package repositories.

**Change:** The Dockerfile runs an APT update and a targeted upgrade to `liblzma5`, then removes the APT package-list cache. The tested updated version was `5.8.1-1+deb13u2`.

**Validation:** After the targeted update and rebuild, Trivy's Debian OS count decreased from **166** to **164** findings. The local simulated APT upgrade check reported **0 additional upgrades** at that point in time; this is not a guarantee about future updates.

### 3.3 Trivy before/after comparison and security gate

| Image assessment stage | Debian findings | Python packaging findings | Total findings |
| --- | ---: | ---: | ---: |
| Original image | 166 | 9 | **175** |
| Reduced Python runtime | 166 | 0 | **166** |
| Targeted `liblzma5` update | 164 | 0 | **164** |

**Final observed full-scan severity distribution (18 October 2026):**

| CRITICAL | HIGH | MEDIUM | LOW | UNKNOWN | Total |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 44 | 58 | 61 | 1 | **164** |

**Blocking local verification:**

```bash
trivy image \
  --scanners vuln \
  --severity HIGH,CRITICAL \
  --ignore-unfixed \
  --exit-code 1 \
  secureship:ci
```

This returned **zero findings eligible under this filtering policy** and exited successfully. It does **not** mean that the 164 complete-report findings were fixed or that the 44 remaining HIGH findings are harmless.

**CI implementation:** The `docker` job generates `trivy-report.json`, publishes it as `secureship-trivy-report` for **14 days**, and separately runs the blocking gate. On the validated baseline the Docker CI job passed. The Linux GitHub runner and the local Apple Silicon scan can resolve different image architectures and vulnerability data; compare reports on their own terms rather than treating counts as immutable.

**Residual-risk decision:** Retain and review unfixed Debian advisories, update the base image deliberately when patches become available, and reassess before any change from localhost-only use. There is **no claim that all HIGH issues were remediated**.

**Traceability:** `Dockerfile`, [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), [`03-security-findings.md`](03-security-findings.md).

## 4. Dependency, secret and configuration controls

### 4.1 Software Composition Analysis (SCA)

**Python:** `pip-audit -r requirements.txt` reported **no known vulnerabilities** in the scanned Python dependency inventory during the local assessment. The same check runs in the `sca` CI job.

**Frontend production:** `npm --prefix frontend audit --omit=dev` reported **zero vulnerabilities** during local validation and is enforced in CI.

**Outstanding:** The full npm audit, which includes developer/build dependencies, found **9 affected packages (6 HIGH, 3 MODERATE)**. These were **not fixed** in this phase. A potentially breaking `npm audit fix --force` was intentionally avoided; a controlled dependency upgrade and full build/retest remain follow-up tasks. The production-scope gate alone does not eliminate supply-chain exposure from development tools.

### 4.2 Git history secret scanning

**Control:** The `gitleaks` GitHub Actions job checks out full accessible Git history (`fetch-depth: 0`) and runs Gitleaks. Automatic commenting and artifact upload are disabled to reduce accidental dissemination of findings.

**Validation:** The full SecureShip Git-history scan found **no detected leaks**. Separately, a disposable local repository under `/tmp` was used to demonstrate detection of a **synthetic, nonfunctional** token: Gitleaks still found the token in an older commit after it had been removed from the latest file. **This test token was never part of SecureShip's Git history.**

**Incident guidance:** For an actual exposed credential, revoke/rotate it immediately, investigate access, and then assess history cleanup and coordinated recovery; deleting it in the newest commit alone is insufficient.

### 4.3 Checkov configuration scanning

**Recorded local results:**

- `checkov -f Dockerfile --framework dockerfile` → **9 passed, 0 failed**.
- `checkov -d .github/workflows --framework github_actions` → **159 passed, 0 failed** after all seven jobs had been added.

The `checkov` CI job executes these two scans using version **3.3.20** and passed on the tested pipeline. Repeated `PASSED` entries include check instances on multiple jobs and steps; they are **not 159 distinct security guarantees**. No separate Docker Compose-specific Checkov policy coverage is asserted.

### 4.4 Actionlint and ShellCheck (local validation)

**Finding:** Actionlint identified ShellCheck warning `SC2034` for an unused variable `i` in the Docker health-check retry loop.

**Correction:** Change `for i in $(seq 1 30); do` to `for _ in $(seq 1 30); do`, preserving the retry count and functionality.

**Validation:** `actionlint .github/workflows/ci.yml` produced no reported errors after the change. This is a **local quality check**; Actionlint is not one of the seven existing GitHub Actions jobs.

## 5. End-to-end validation baseline

| Control | Command or mechanism | Observed result |
| --- | --- | --- |
| Backend tests | `python -m pytest -q` | **53 passed in 3.65 s** (local run) |
| Frontend compile | `npm --prefix frontend run build` | TypeScript check and Vite build succeeded (1,595 modules transformed) |
| Docker build | `docker build -t secureship:ci .` | Built successfully locally; Docker build also passed in CI |
| Trivy gate | Filtering command in §3.3 | Passed; **0 eligible fixable HIGH/CRITICAL** findings |
| Python SCA | `pip-audit -r requirements.txt` | No known vulnerabilities reported in tested scope |
| Frontend production SCA | `npm --prefix frontend audit --omit=dev` | No vulnerabilities reported in tested scope |
| Gitleaks | Full Git history and CI `gitleaks` job | No SecureShip leaks detected |
| Checkov — Dockerfile | `checkov -f Dockerfile --framework dockerfile` | 9 passed, 0 failed |
| Checkov — workflow | `checkov -d .github/workflows --framework github_actions` | 159 passed, 0 failed |
| Workflow lint | `actionlint .github/workflows/ci.yml` | No warnings after correction |
| Pull request | [PR #2](https://github.com/saadkvp03/SecureShip/pull/2) | **14 successful PR checks**; merged 18 October 2026 |
| GitHub Actions | Seven defined CI jobs | All seven succeeded on the security-hardening baseline |

**CI dependency model:** `docker` waits for `test` and `frontend` via `needs: [test, frontend]`. `semgrep`, `gitleaks`, `sca` and `checkov` run independently. GitHub Actions validates changes on matching pushes and pull requests; it **does not deploy SecureShip**.

**PR audit trail:**

- [`7e4b178`](https://github.com/saadkvp03/SecureShip/commit/7e4b178) — Shipment status-state enforcement.
- [`807493f`](https://github.com/saadkvp03/SecureShip/commit/807493f) — Authentication and session protection.
- [`ae8bbf4`](https://github.com/saadkvp03/SecureShip/commit/ae8bbf4) — Semgrep triage and SAST gate.
- [`ddff5e5`](https://github.com/saadkvp03/SecureShip/commit/ddff5e5) — Docker hardening and security-tool CI integration.
- [Merged PR #2](https://github.com/saadkvp03/SecureShip/pull/2) — Security baseline integrated into `main`.

## 6. Evidence handling and reproducibility

**Where evidence is kept:** Detailed scanner JSON outputs and unselected/raw terminal screenshots remain on the operator's **local Desktop, outside the Git repository**. A **curated subset** of screenshots and workflow illustrations has been selected for `docs/assets/` and referenced by the [README](../README.md). The full Trivy JSON artifact produced by GitHub Actions has **14-day retention**; it is separate from these curated images.

**Curated visual evidence (repository-relative links):**

| Evidence | Selected file | What it demonstrates / limitation |
| --- | --- | --- |
| Backend regression suite | [`pytest-53-passed.png`](assets/pytest-53-passed.png) | Recorded 53-test passing baseline, not permanent assurance |
| Semgrep findings triage | [`semgrep-before-triage.png`](assets/semgrep-before-triage.png), [`semgrep-after-triage.png`](assets/semgrep-after-triage.png) | Before/after scan output; reviewed suppressions are explained in `07-semgrep-triage.md` |
| Controlled Semgrep blocking example | [`semgrep-blocking-demo.png`](assets/semgrep-blocking-demo.png) | Illustrative detection/exit behavior; do not conflate with a failed `main` CI run |
| SQL injection regression | [`sql-injection-regression.png`](assets/sql-injection-regression.png) | Targeted test evidence for selected search/status paths, not exhaustive SQLi testing |
| Gitleaks history experiment | [`gitleaks-history-detected.png`](assets/gitleaks-history-detected.png), [`gitleaks-history-after-deletion.png`](assets/gitleaks-history-after-deletion.png), [`gitleaks-working-tree-clean.png`](assets/gitleaks-working-tree-clean.png) | Synthetic token in a separate disposable repository; **not** a leaked SecureShip credential |
| GitHub Actions run | [`github-actions-job-graph.png`](assets/github-actions-job-graph.png) | Screenshot of the validated CI job graph; [the run](https://github.com/saadkvp03/SecureShip/actions/runs/39137370956) is the primary verifiable source |
| Docker local execution | [`docker-desktop.png`](assets/docker-desktop.png) | Local Compose environment visible in Docker Desktop; not a public hosting or security proof |

**Before sharing evidence:** Review each selected image for passwords, `.env` contents, live cookies, CSRF tokens, hashes, access tokens, personal data and other secrets. Redact or remove any affected image. Do not move raw credentials or local SQLite databases into `docs/`.

**Reproduce the baseline:** Use the repository commit/PR referenced above, then rerun the documented commands with suitable local dependencies. Tool databases, dependency registries and Debian packages evolve; new results may differ even when source code is unchanged. Record the image digest, architecture, tool versions, date and scan policy if collecting formal evidence.

**Data safety:** The Compose named volume contains local SQLite state. **Never use `docker compose down -v`** on a volume with data you intend to preserve. Testing and documentation must not overwrite the user's `.env` or local database.

## 7. Open risks and next steps

| Priority | Next action | Why it remains necessary |
| --- | --- | --- |
| High | Reassess the full Trivy report and Debian HIGH advisories as fixes become available | `--ignore-unfixed` intentionally excludes unresolved issues from the blocking gate |
| High | Plan a controlled upgrade of npm development/build dependencies, followed by build and full audit | Nine npm dev-tool findings remain open |
| Medium | Review the narrow Semgrep suppressions whenever relevant query-building logic changes | Original triage conclusions depend on trusted SQL identifiers/fragments and bound parameters |
| Medium | Maintain reproducible CI dependencies and consider automating Actionlint | Reduce workflow/supply-chain drift and catch shell mistakes on future changes |
| Planned | Execute authorized **OWASP ZAP DAST** against localhost in a separate phase | Dynamic behavior is not established by the current static and dependency scans |
| In progress | Review and finalize the current-phase [`05-final-report.md`](05-final-report.md) and periodically refresh selected validation evidence | Keep the assessment narrative aligned with the documented remediations, residual risks and CI history |

**Overall assessment:** The initial SecureShip hardening work was implemented, locally checked and successfully validated in GitHub Actions. Outstanding vulnerability reports are **tracked, not concealed**. No claim of production readiness, complete penetration-test coverage or formal risk acceptance is made.
