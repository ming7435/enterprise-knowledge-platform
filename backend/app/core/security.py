import base64
import hashlib
import hmac
import json
import re
import secrets
import time
from typing import Any


# 2024年OWASP推荐PBKDF2-SHA256迭代次数下限为600,000
PASSWORD_ITERATIONS = 600_000

# 密码强度要求
_PASSWORD_MIN_LENGTH = 8
_PASSWORD_STRENGTH_RE = re.compile(
    r"^(?=.*[A-Za-z])(?=.*\d).{8,}$"
)


def validate_password_strength(password: str) -> None:
    """校验密码强度，不符合则抛出 ValueError。"""
    if len(password) < _PASSWORD_MIN_LENGTH:
        raise ValueError(f"密码长度至少 {_PASSWORD_MIN_LENGTH} 位")
    if not _PASSWORD_STRENGTH_RE.match(password):
        raise ValueError("密码必须同时包含字母和数字")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
    )
    return (
        f"pbkdf2_sha256${PASSWORD_ITERATIONS}$"
        f"{salt.hex()}${digest.hex()}"
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt_hex, digest_hex = stored_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        int(iterations),
    )
    return hmac.compare_digest(digest.hex(), digest_hex)


def _b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def create_access_token(
    subject: str, secret_key: str, expire_minutes: int
) -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,                                    # 签发时间
        "jti": secrets.token_hex(16),                  # 唯一 ID，用于将来的黑名单撤销
        "exp": now + expire_minutes * 60,
    }
    signing_input = ".".join(
        [
            _b64_encode(json.dumps(header, separators=(",", ":")).encode()),
            _b64_encode(json.dumps(payload, separators=(",", ":")).encode()),
        ]
    )
    signature = hmac.new(
        secret_key.encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{signing_input}.{_b64_encode(signature)}"


def decode_access_token(token: str, secret_key: str) -> dict[str, Any]:
    try:
        header_part, payload_part, signature_part = token.split(".", 2)
    except ValueError as exc:
        raise ValueError("token 格式不正确") from exc

    signing_input = f"{header_part}.{payload_part}"
    expected = hmac.new(
        secret_key.encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()
    actual = _b64_decode(signature_part)
    if not hmac.compare_digest(expected, actual):
        raise ValueError("token 签名无效")

    payload = json.loads(_b64_decode(payload_part))
    # 要求 exp 字段必须存在
    if "exp" not in payload:
        raise ValueError("token 缺少过期时间")
    if int(payload["exp"]) < int(time.time()):
        raise ValueError("token 已过期")
    return payload
