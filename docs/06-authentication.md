# SecureShip — T-01 Authentication remediation (local lab)

## Goal and scope

Provide a realistic security boundary for the *existing* SecureShip educational laboratory, without building a product or hosting it publicly. The operator manages fictional records on `127.0.0.1:8000` only. This is not a production-ready IAM solution.

## Before / after

| Endpoint | Before | After (anonymous) | After (authenticated) |
|---|---|---|---|
| GET `/shipments` | 200 | **401** | 200 |
| GET `/shipments/{id}` | 200 | **401** | 200 |
| GET `/stats` | 200 | **401** | 200 |
| POST `/shipments` | 201 | **401** | 201 with CSRF token |
| PATCH `/shipments/{id}/status` | 200/409 | **401** | 200/409 with CSRF token |
| GET `/health` | 200 | 200 | 200 |

Status after implementation must be independently validated on the developer's machine. Pre-fix HTTP 200/201 results were demonstrated against fictional records in the local lab.

## Security decisions

1. Credentials are configured by `python scripts/setup_auth.py`. It asks for a username and a password using `getpass`, verifies a password of at least 12 characters, and saves only a salted **scrypt** hash in Git-ignored `.env` with 0600 permissions. No default account or password is shipped.
2. Authentication issues a random opaque session cookie. Cookie flags: `HttpOnly`, `SameSite=Strict`, `Path=/`, 8-hour expiry. `Secure=False` is required for this **loopback HTTP lab** only; do not use outside localhost without HTTPS and Secure cookies.
3. SQLite `auth_sessions` stores only SHA-256 session-token digests (not raw bearer cookies), a CSRF value, and expiration. Logging out revokes the server-side session, including copies of the cookie.
4. Every shipment/statistics API route checks the session. POST/PATCH and logout additionally check `X-CSRF-Token` using constant-time equality comparison. CSRF token stays in React memory, not localStorage.
5. `/auth/login` takes JSON username/password; `/auth/me` confirms the session and provides a fresh React client with its CSRF token after reload. The app UI does not contain any secrets.
6. Docker Compose reads the local `.env` via `env_file`; existing named volumes and legacy shipment rows are preserved. App startup rejects a missing authentication configuration instead of silently enabling an unprotected mode.
7. Original T-02 backend status-state-machine still enforces `created → in_transit → delivered` even for a logged-in operator.

## Residual limitations / future security work

- Single operator; no differentiated role-based access, ownership checks, tenant isolation, password resets, or MFA.
- No persistent failed-login throttling/lockout yet; only suitable for a local, fictitious lab.
- HTTP loopback transport without TLS and non-Secure cookies (do not expose to untrusted networks).
- Cross-process filesystem access to `.env`/SQLite and local malware are outside this simple API protection.
- General DAST, SAST, dependency/security configuration scans remain necessary.

## Test and evidence checklist

- `python -m pytest -q`: run 52 regression/security tests (`tests/test_auth.py` added).
- `npm run build` and `docker compose up -d --build`: check locally on the Mac.
- Screenshot **before** opening app: login form (without entering/showing password), save `docs/evidence/t01-login-form.png`.
- Screenshot terminal: `curl -i http://127.0.0.1:8000/shipments` returns **401**, save `docs/evidence/t01-unauthenticated-401.png`.
- Screenshot after successful login: fictional shipments list **without credentials or browser devtools revealing secrets**, save `docs/evidence/t01-authenticated-access.png`.
- Check invalid password → 401, no CSRF header → 403 on writes, logout then access → 401, no loss of Docker volume records.

Do not commit actual `.env`, passwords, cookies, session tokens, or CSRF tokens. Existing pre-remediation evidence remains useful to show change from unauthorized 200/201 to denied 401.
