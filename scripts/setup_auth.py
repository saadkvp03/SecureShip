"""Interactively configure the local lab operator, without committing secrets."""

import getpass
import os
import re
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.auth import hash_password  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / ".env"


def main():
    if DEST.exists():
        sys.exit("A .env file already exists. It was NOT overwritten. Back it up / edit it manually.")
    print("SecureShip — local authentication setup (no real customer credentials)")
    username = input("Login name [operator]: ").strip() or "operator"
    if not re.fullmatch(r"[A-Za-z0-9_.-]{3,64}", username):
        sys.exit("Username must be 3–64 ASCII letters, digits, _, . or -")
    password = getpass.getpass("Choose a password (at least 12 characters): ")
    confirm = getpass.getpass("Confirm password: ")
    if len(password) < 12 or len(password) > 256 or password != confirm:
        sys.exit("Password must match and contain 12–256 characters. Nothing written.")
    content = (f"SECURESHIP_AUTH_USER={username}\n"
               f"SECURESHIP_AUTH_PASSWORD_HASH='{hash_password(password)}'\n")
    fd = os.open(DEST, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as file:
        file.write(content)
    print("Authentication configured in .env (Git-ignored, permissions 600).")
    print("Do not add .env to Git or share it in screenshots/ZIP files.")


if __name__ == "__main__":
    main()
