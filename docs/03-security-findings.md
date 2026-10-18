# 03 — Security Findings and Triage

**Project:** SecureShip\
**Assessment baseline:** 18 October 2026\
**Environment:** Authorized, localhost-only FastAPI + React + SQLite laboratory; Docker and GitHub Actions\
**Reference:** [Security-hardening PR #2](https://github.com/saadkvp03/SecureShip/pull/2)

> **Scope and interpretation:** This document records findings observed during the initial security-hardening phase. Severity totals are scanner results for a particular image, dependency set, platform and vulnerability database at the time of testing. A passing security gate does **not** mean the project has no vulnerabilities, and SecureShip is **not production-ready**.

## 1. Assessment coverage

| Control | Target | Observed result | Interpretation |
| --- | --- | --- | --- |
| Semgrep (SAST) | `app/`, `frontend/src/` | 3 SQL-construction alerts investigated | Assessed as likely false positives; narrow suppressions and a regression test were added |
| Trivy | Built Docker image | Initial: **175** findings; after hardening: **164** | Residual OS advisories remain; blocking gate passed for **fixable HIGH/CRITICAL** findings |
| `pip-audit` (SCA) | `requirements.txt` | No known vulnerabilities reported | Clean **within the scanned Python dependency scope and advisory database** |
| `npm audit` (SCA) | Complete frontend dependency inventory | 9 affected packages: **6 HIGH**, **3 MODERATE** | Findings associated with development/build tooling; follow-up needed |
| `npm audit --omit=dev` | Frontend production dependencies | No vulnerabilities reported | CI production-scope gate passed; does not cover development dependencies |
| Gitleaks | SecureShip Git history | No leaks detected | No matches under the scanner's rules; not proof that secrets cannot exist |
| Checkov | `Dockerfile` | **9 passed, 0 failed** | No violations detected by the configured Dockerfile policies |
| Checkov | `.github/workflows/ci.yml` | **159 passed, 0 failed** | No violations detected by the configured GitHub Actions policies |
| Actionlint + ShellCheck | `.github/workflows/ci.yml` | Warning `SC2034` corrected; subsequent lint clean | Local workflow-quality validation, **not** a separate CI job |

## 2. Detailed findings

### SEC-01 — Semgrep SQL-construction alerts

**Status:** Investigated; assessed as likely false positives.\
**Observed severity:** Use the original Semgrep output for individual rule severities; do not infer severity from this summary.\
**Location:** `app/database.py`.

Semgrep reported three alerts: two related to dynamically constructed `ALTER TABLE` statements and one related to a dynamically constructed `SELECT COUNT` query.

**Technical analysis:**

- Column names and definitions used in the migration statements come from the application-controlled `_ADDED_COLUMNS` mapping, not from user input.
- `_build_filters()` assembles SQL using predefined query fragments. User-supplied values are passed to SQLite separately as bound `?` parameters.
- A regression test using the payload `' OR 1=1 --` returned no matching records for the tested search and status filtering cases.

**Treatment:** Narrow, documented `nosemgrep` suppressions were applied after review, and the SQL-injection regression test remains in the test suite. The Semgrep GitHub Actions job runs with `--error` and has passed on the validated baseline.

**Residual concern:** The regression test exercises selected inputs and queries. It cannot establish the safety of all SQL statements or all injection techniques. Revisit the suppressions when related database code changes.

**Evidence:** [`docs/07-semgrep-triage.md`](07-semgrep-triage.md), [`tests/test_sqli_regression.py`](../tests/test_sqli_regression.py), [PR #2](https://github.com/saadkvp03/SecureShip/pull/2).

### SEC-02 — Trivy container-image vulnerability inventory

**Status:** Partially remediated; residual advisories require continued review.\
**Asset:** Docker runtime based on `python:3.11-slim` (Debian 13.7 in the observed local scan).

The original image scan reported **175** findings: **166** associated with Debian OS packages and **9** associated with Python packaging components. After hardening, the local full scan reported **164** findings, distributed as follows:

| Scanner severity | Remaining local findings |
| --- | ---: |
| CRITICAL | 0 |
| HIGH | 44 |
| MEDIUM | 58 |
| LOW | 61 |
| UNKNOWN | 1 |
| **Total** | **164** |

**Treatment performed:**

1. Introduced `requirements-runtime.txt` to install only the API's runtime Python dependencies.
2. Removed `pip`, `setuptools` and `wheel` from the final runtime image after package installation.
3. Upgraded the Debian `liblzma5` package using the security update available at build time.
4. Rebuilt the image and reran Trivy. The local APT upgrade simulation reported no additional available upgrades at that time.

**Gate and interpretation:** The local command below passed for `secureship:ci`:

```bash
trivy image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 secureship:ci
```

The GitHub Actions Docker job also generates a **full Trivy JSON report**, uploads the `secureship-trivy-report` artifact with **14-day retention**, and applies a blocking gate for fixable HIGH/CRITICAL findings. The gate excludes unfixed vulnerabilities from its failure condition; therefore, **44 reported HIGH findings in the complete local inventory are not equivalent to a clean image**.

**Residual concern:** Debian advisories without identified fixes remain visible in the complete report. Vulnerability counts and fix availability may change with the platform architecture, base image, package versions and advisory database. Review the full report periodically, update the base image deliberately, and reassess the gate if the application scope changes.

**Evidence:** `Dockerfile`, `requirements-runtime.txt`, [CI workflow](../.github/workflows/ci.yml), and the time-limited GitHub Actions Trivy report artifact. Local JSON scan reports were retained outside the Git repository.

### SEC-03 — Frontend development-toolchain dependency advisories

**Status:** Open for dependency upgrade planning and retesting.\
**Target:** Frontend npm dependency tree, including development dependencies.

The full local `npm audit` reported **9 affected packages**: **6 HIGH** and **3 MODERATE**. Findings involved development/build tooling and transitive dependencies. The production-only audit (`npm audit --omit=dev`) reported **0 vulnerabilities** at the same assessment baseline.

**Treatment decision:** Avoid an unreviewed `npm audit fix --force` because potentially breaking major upgrades to the frontend build toolchain were proposed. The production-dependency scope is checked automatically in CI; the broader development-dependency findings remain tracked rather than silently treated as resolved.

**Residual concern:** Build-time tools can still affect developer machines and the software supply chain. Review advisories and upgrade paths, test the TypeScript/Vite build, and repeat both full and production-scoped audits.

**Evidence:** Local npm audit JSON and console results retained outside Git; [CI workflow](../.github/workflows/ci.yml).

## 3. Controls with no findings in the tested scope

### Python SCA

`pip-audit -r requirements.txt` reported **no known vulnerabilities** for the Python dependency inventory at the assessment date. This result may change as advisories are published or dependencies change. The same dependency inventory is checked in CI.

### Gitleaks secret scanning

A full Git-history scan of the SecureShip repository reported **0 detected leaks**. Detection was also demonstrated using a **separate disposable local Git repository** containing a synthetic, nonfunctional token: Gitleaks found it in history even after it was removed from the latest file version. That demonstration repository is **not part of SecureShip**.

For an actual secret exposure, immediately **revoke and rotate** the credential and then assess whether shared Git history must be rewritten. Never include actual secrets in reports or screenshots.

### Checkov configuration security

The local Dockerfile scan passed **9/9** checks; the final GitHub Actions scan passed **159/159** check instances. These results cover the checks available in the selected Checkov version and do not amount to a comprehensive deployment-security assessment.

### GitHub Actions workflow lint

Actionlint, including ShellCheck, flagged an unused shell loop variable (`SC2034`) in the Docker smoke-test script. Replacing the variable with `_` preserved the retry behavior, and a subsequent Actionlint run produced no warnings. Actionlint is run **locally** in this baseline.

## 4. Validation and traceability

- Local backend: **53/53 Pytest tests passed**.
- Frontend: TypeScript check and Vite production build passed.
- Docker: image build and CI smoke test passed, covering health, authentication, unauthorized API access, CSRF-protected shipment creation and statistics.
- The security-hardening [PR #2](https://github.com/saadkvp03/SecureShip/pull/2) was merged after **14 successful PR checks**.
- All **7** GitHub Actions jobs (`test`, `frontend`, `docker`, `semgrep`, `gitleaks`, `sca`, `checkov`) passed on the validated baseline.

**Evidence-handling policy:** Selected screenshots documenting Pytest, Semgrep, the synthetic Gitleaks demonstration, the SQL-injection regression, Docker, and GitHub Actions are now curated in [`docs/assets/`](assets/) and presented with context in the [README](../README.md). Other scanner JSON reports and unselected/raw evidence remain local by default. Before publishing any new capture, check for sensitive values and redact them if necessary. Never commit `.env`, passwords, cookies, CSRF tokens, real credentials, local databases, or unreviewed logs.

## 5. Follow-up actions

| Priority | Action | Rationale |
| --- | --- | --- |
| High | Periodically re-run the full Trivy scan and reassess remaining HIGH Debian advisories | Residual vulnerabilities are not blocked by `--ignore-unfixed` |
| High | Review and update affected npm development/build dependencies with compatibility testing | The production-scope gate does not cover development tooling |
| Medium | Revisit Semgrep suppressions when SQL-building code changes | Suppressions are valid only under the investigated assumptions |
| Medium | Consider additional CI supply-chain controls, version pinning and Actionlint automation | Improve repeatability and workflow integrity |
| Planned | Conduct authorized local OWASP ZAP DAST in a separate phase | Examine runtime behavior not covered by the current static tooling |
| Ongoing documentation | Keep [`04-remediation-validation.md`](04-remediation-validation.md), [`05-final-report.md`](05-final-report.md), the [threat model](02-threat-model.md), and published screenshots consistent with new evidence | Prevent stale security claims as the project evolves |

**Risk statement:** Findings are tracked in the context of a **local educational laboratory with fictional data**. This documentation does not approve production deployment or constitute a formal organizational risk acceptance.
