# SecureShip — T-01 Authentication and Session Security

**Project:** SecureShip\
**Security control:** T-01 — Unauthenticated access to shipment data and modification endpoints\
**Review baseline:** 18 October 2026\
**Status:** Implemented, regression-tested and integrated into the security-hardening [PR #2](https://github.com/saadkvp03/SecureShip/pull/2)\
**Deployment scope:** Single authorized operator on **localhost only**, with fictional data

> This is an application-security **laboratory control**, not a production IAM system. Docker Compose publishes SecureShip on `127.0.0.1:8000`; it is not deployed on a public Internet endpoint.

## 1. Threat, objective and trust boundary

**Before remediation:** Any local HTTP client that could reach the FastAPI service could read, create or update shipment records without operator authentication. A login screen by itself is not an API access-control boundary: callers can bypass the UI and send HTTP requests directly.

**Security objective:** Require a validated server-side operator session for shipment/statistics APIs, ensure state-changing requests carry a valid CSRF token, revoke sessions on logout and retain existing shipment data when introducing authentication.

**Trust boundaries:** Browser or HTTP client -> FastAPI session/CSRF validation -> application logic -> SQLite. These server-side checks apply even when a caller does not use the React interface.

## 2. Expected API behavior — before and after

| Endpoint / action | Pre-remediation behavior | Current anonymous behavior | Current authenticated behavior |
| --- | --- | --- | --- |
| `GET /shipments` | 200 | **401** | 200 |
| `GET /shipments/{id}` | 200 for an existing ID | **401** | 200 for an existing ID; 404 if absent |
| `GET /stats` | 200 | **401** | 200 |
| `POST /shipments` | 201 with valid data | **401** | 201 with valid session **and CSRF token** |
| `PATCH /shipments/{id}/status` | 200 for an accepted transition | **401** | 200 for allowed change, **409** for forbidden transition; CSRF required |
| `POST /auth/logout` | Not available | **401** | 200 with valid session and CSRF; session revoked |
| `GET /auth/me` | Not available | **401** | 200 with current username and CSRF token |
| `GET /health` | 200 | 200 (public) | 200 (public) |

**Important distinction:** A request with **no valid session** is rejected with HTTP **401**. A request with a valid session but a missing or incorrect `X-CSRF-Token` for a protected write is rejected with HTTP **403**. Authentication does not override the shipment-state machine: invalid business transitions are still rejected with HTTP **409**.

The values above describe the documented implementation and tests, not a fresh manual scan performed while preparing this document.

## 3. Authentication design and implementation

### 3.1 Operator provisioning

- Setup command: `python scripts/setup_auth.py`, run from the repository root.
- The setup script prompts interactively for a username and a password (12–256 characters; confirmation required); the password input uses `getpass`.
- It generates a salted scrypt password hash (with parameters stored alongside the hash). **The plaintext password is not saved** by this script.
- The local Git-ignored `.env` contains `SECURESHIP_AUTH_USER` and `SECURESHIP_AUTH_PASSWORD_HASH`. The setup script creates it with filesystem mode `0600` and **refuses to overwrite an existing `.env`**.
- There is no shipped default password, registration flow or multi-user account database.
- Application startup rejects missing authentication configuration, rather than silently enabling an anonymous operating mode.

**Handling rule:** Never include the `.env` file, a real password or the complete secret-bearing environment in source control, screenshots, archives or public support requests.

### 3.2 Password verification

The backend uses Python's built-in `hashlib.scrypt` with a random salt. Login verifies the candidate password and compares the resulting digest using `hmac.compare_digest`. The configured username is likewise checked with a constant-time comparison.

A password hash is still sensitive authentication material. Store the local `.env` securely and do not publish it or treat its scrypt encoding as harmless.

### 3.3 Cookie and server-side session

- Login endpoint: `POST /auth/login` with JSON credentials.
- The server generates an opaque random session token and an independent CSRF token.
- The browser receives a `secureship_session` cookie configured as `HttpOnly`, `SameSite=Strict`, `Path=/` with an **8-hour maximum age**.
- The server stores only the **SHA-256 digest** of the session token, together with its expiry and associated CSRF token, in SQLite `auth_sessions`.
- Requests provide the opaque cookie automatically; FastAPI looks up the token digest and validates expiry on every protected request.
- `POST /auth/logout` deletes the session entry and instructs the browser to clear the cookie. A copied cookie from a revoked session no longer authenticates.
- `/auth/login`, `/auth/me` and `/auth/logout` responses set `Cache-Control: no-store`.

**Local transport exception:** The cookie currently has `Secure=False` because the application is demonstrated on **HTTP loopback**. This is unsuitable for a public deployment; HTTPS and `Secure=True` would be essential prerequisites.

### 3.4 CSRF protection

- Reads of shipment data and statistics use `require_session`.
- `POST /shipments`, `PATCH /shipments/{id}/status` and `POST /auth/logout` use `require_csrf`, which first requires a valid session.
- A protected write must carry `X-CSRF-Token` matching the value stored for the session. Comparison uses `hmac.compare_digest`.
- The token is supplied on successful login or `/auth/me`. The React client keeps it in memory rather than storing it in localStorage.

**Scope:** CSRF protection is an application-level request check and should not be interpreted as a comprehensive security boundary for every hypothetical deployment or browser threat.

### 3.5 Preserving business rules and storage

Authentication gates the API **before** shipment operations, but does not replace authorization for the shipment-state rules. Only `created -> in_transit -> delivered` transitions are permitted; unsupported transitions return HTTP 409.

The existing SQLite shipment records and event history are retained. The new `auth_sessions` table is created by the application's database initialization; Docker Compose continues to use the existing persistent `secureship-data` volume. No database reset or destructive volume removal is needed.

## 4. Validation and observed evidence

### 4.1 Automated regression tests

The documented local baseline completed **53/53 Pytest tests** on 18 October 2026. Relevant authentication coverage in [`tests/test_auth.py`](../tests/test_auth.py) includes:

| Test area | Expected result |
| --- | --- |
| Password hashing | Salted hashes vary; valid password verifies; invalid password does not |
| Anonymous API requests | Protected reads and writes return **401** |
| Invalid login | Incorrect username/password returns **401** |
| Session cookie | Cookie exists and is marked `HttpOnly` |
| CSRF handling | Missing/invalid token on protected writes/logout returns **403** |
| Logout | Server-side session is revoked; subsequent protected access returns **401** |
| Expiration | Expired sessions cannot authenticate |
| Shipment integrity | An authenticated, invalid status transition returns **409** |

The complete suite also covers other application behavior; **53** is the total project test count, not the number of T-01-specific tests.

### 4.2 Docker and GitHub Actions integration

The [`docker` GitHub Actions job](../.github/workflows/ci.yml) uses **disposable CI-only credentials** to build and run the image. Its smoke test checks `/health`, the built `/app` frontend, anonymous shipment access returning **401**, successful login, CSRF-authenticated shipment creation and an authenticated statistics request.

The `docker` job runs **after** `test` and `frontend`. Semgrep, Gitleaks, SCA and Checkov run in separate security jobs; the seven-job pipeline passed on the [18 October 2026 baseline](https://github.com/saadkvp03/SecureShip/actions/runs/39137370956).

The CI smoke test uses a temporary, isolated container and credentials; it does **not** exercise or alter the developer's persistent local SQLite data.

### 4.3 Screenshots and evidence handling

The repository README includes curated, non-secret screenshots of the **empty login form** and **authenticated dashboard**:

- [SecureShip login interface](assets/app-login.png).
- [SecureShip authenticated dashboard](assets/app-dashboard.png).
- [53 tests passed](assets/pytest-53-passed.png).
- [GitHub Actions job graph](assets/github-actions-job-graph.png).

An earlier pre-authentication HTTP 200/201 terminal trace can serve as **historical before-remediation evidence**, but must **not** be presented as SecureShip's current access-control behavior. A new manual anonymous-request screenshot would need to demonstrate HTTP **401** to serve as an after-remediation illustration; no such specific screenshot is claimed here.

**Do not publish:** passwords (even masked fields containing actual secrets should be avoided), `.env`, raw cookies, CSRF tokens, authentication headers, local database contents, real customer data or scanner results exposing credentials.

## 5. Reproducing the non-destructive local verification

Run the existing regression suite with the repository's Python environment active:

```bash
python -m pytest -q
```

For a local manual observation, start SecureShip using its existing `.env` and **existing volume**, then request the shipment endpoint without a session:

```bash
curl -i http://127.0.0.1:8000/shipments
```

**Expected response:** HTTP **401 Unauthorized** when no authentication cookie is supplied. This verifies one concrete behavior, not the full security of the application.

Do not rerun `scripts/setup_auth.py` if `.env` already exists. Do not delete, recreate or overwrite the SQLite database. **Do not run `docker compose down -v`** on a volume containing data you need to preserve.

## 6. Residual limitations and future improvements

- **Identity and access:** One operator only; no registration, differentiated roles, resource ownership, tenant isolation, MFA or password recovery.
- **Brute-force resistance:** No persistent login throttling, adaptive rate limiting or lockout has been demonstrated.
- **Transport:** Local HTTP and a cookie without the `Secure` flag must not be exposed on the public Internet.
- **Host compromise:** Local processes, malware, file-system access to `.env`/SQLite and administrative compromise are outside this basic API gate.
- **Session operational controls:** There is no claim of comprehensive enterprise-grade incident response, device/session management or multi-instance session synchronization.
- **Assessment coverage:** Authentication tests cover specific expected paths; they do not replace authorized penetration testing or the planned OWASP ZAP DAST phase.

**Deployment decision:** Keep this configuration **localhost-only**. Any future public exposure requires a new threat model, HTTPS, stronger IAM and rate limiting, secrets management, monitoring, suitable database safeguards and a security review.

## 7. Related documentation and source references

- [Scope and architecture](01-scope-architecture.md)
- [Threat model](02-threat-model.md)
- [Security findings](03-security-findings.md)
- [Remediation and validation](04-remediation-validation.md)
- [Current-phase report](05-final-report.md)
- [`app/auth.py`](../app/auth.py)
- [`app/main.py`](../app/main.py)
- [`scripts/setup_auth.py`](../scripts/setup_auth.py)
- [`tests/test_auth.py`](../tests/test_auth.py)
- [Security-hardening PR #2](https://github.com/saadkvp03/SecureShip/pull/2)

**Conclusion:** SecureShip's unauthenticated shipment APIs were replaced with a tested, server-enforced, single-operator access boundary and CSRF checks suitable for its **local educational scope**. The completed regression and CI checks support the recorded remediation, while the limitations above remain explicitly outside this initial hardening phase.
