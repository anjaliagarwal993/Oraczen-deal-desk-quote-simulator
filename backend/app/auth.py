"""Accounts: salted PBKDF2 password hashes and HMAC-signed expiring tokens. Standard library only."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
import time

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 8


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt_hex, digest_hex = stored.split("$")
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 200_000)
    return hmac.compare_digest(digest.hex(), digest_hex)


def _sign(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def make_token(user_id: str, secret: str, ttl_seconds: int = 7 * 24 * 3600) -> str:
    body = json.dumps({"sub": user_id, "exp": int(time.time()) + ttl_seconds}).encode()
    payload = base64.urlsafe_b64encode(body).decode().rstrip("=")
    return f"{payload}.{_sign(payload, secret)}"


def read_token(token: str, secret: str) -> str | None:
    """Return the user id if the token is genuine and not expired, else None."""
    try:
        payload, sig = token.split(".")
        if not hmac.compare_digest(sig, _sign(payload, secret)):
            return None
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return data["sub"] if data["exp"] > time.time() else None
    except Exception:
        return None


def validate_registration(name: str, email: str, password: str) -> list[dict[str, str]]:
    errs = []
    if not name.strip():
        errs.append({"field": "name", "code": "name_required", "message": "Enter your full name."})
    if not EMAIL_RE.match(email.strip()):
        errs.append({"field": "email", "code": "invalid_email", "message": "Enter a valid email address, like name@company.com."})
    if len(password) < MIN_PASSWORD:
        errs.append({"field": "password", "code": "weak_password", "message": f"Use a password with at least {MIN_PASSWORD} characters."})
    return errs
