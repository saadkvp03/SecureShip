"""Single-operator authentication for the LOCAL SecureShip security lab.

Scrypt password hashing, random opaque SQLite-backed sessions, CSRF tokens.
Secrets are configured only through environment variables (never in Git).
"""

import hashlib
import hmac
import os
import secrets
import time
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, Response

from app import database

COOKIE_NAME = "secureship_session"
SESSION_SECONDS = 8 * 60 * 60
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1


def hash_password(password: str, salt: bytes | None = None) -> str:
    """Hash credentials with memory-hard scrypt (stdlib only)."""
    salt = salt if salt is not None else secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=SCRYPT_N,
                            r=SCRYPT_R, p=SCRYPT_P, dklen=32)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, n, r, p, salt, stored_hash = stored.split("$")
        if algorithm != "scrypt" or (int(n), int(r), int(p)) != (SCRYPT_N, SCRYPT_R, SCRYPT_P):
            return False
        result = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt),
                                n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=32)
        return hmac.compare_digest(result, bytes.fromhex(stored_hash))
    except (ValueError, TypeError, MemoryError):
        return False


def assert_configured() -> None:
    if not os.environ.get("SECURESHIP_AUTH_USER") or not os.environ.get("SECURESHIP_AUTH_PASSWORD_HASH"):
        raise RuntimeError("Authentication not configured. Run: python scripts/setup_auth.py")


def valid_credentials(username: str, password: str) -> bool:
    expected_user = os.environ["SECURESHIP_AUTH_USER"]
    expected_hash = os.environ["SECURESHIP_AUTH_PASSWORD_HASH"]
    # Evaluate password hash even if username is incorrect to reduce user enumeration.
    password_ok = verify_password(password, expected_hash)
    return hmac.compare_digest(username, expected_user) and password_ok


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    with database._connect() as connection:
        connection.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (int(time.time()),))
        connection.execute(
            "INSERT INTO auth_sessions (token_hash, csrf_token, expires_at) VALUES (?, ?, ?)",
            (_token_hash(token), csrf_token, int(time.time()) + SESSION_SECONDS),
        )
    return token, csrf_token


def get_session(token: str | None) -> dict | None:
    if not token:
        return None
    with database._connect() as connection:
        row = connection.execute(
            "SELECT csrf_token, expires_at FROM auth_sessions WHERE token_hash = ?",
            (_token_hash(token),),
        ).fetchone()
    if row is None or row["expires_at"] <= int(time.time()):
        return None
    return dict(row)


def delete_session(token: str | None) -> None:
    if token:
        with database._connect() as connection:
            connection.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (_token_hash(token),))


def require_session(
    secureship_session: Annotated[str | None, Cookie()] = None,
) -> dict:
    session = get_session(secureship_session)
    if session is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return session


def require_csrf(
    session: Annotated[dict, Depends(require_session)],
    x_csrf_token: Annotated[str | None, Header()] = None,
) -> dict:
    if not x_csrf_token or not hmac.compare_digest(x_csrf_token, session["csrf_token"]):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")
    return session


def set_session_cookie(response: Response, token: str) -> None:
    # Local HTTP only; production requires HTTPS and secure=True.
    response.set_cookie(
        COOKIE_NAME, token, httponly=True, secure=False, samesite="strict",
        max_age=SESSION_SECONDS, path="/",
    )
