from __future__ import annotations

from datetime import datetime, timedelta, timezone
from email.header import Header
from email.message import EmailMessage
from email.utils import formataddr
import hashlib
import math
import secrets
import smtplib

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import EmailVerificationCode, utc_now


VALID_PURPOSES = {"login", "register"}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class VerificationEmailSender:
    def send_code(self, email: str, code: str, purpose: str) -> None:
        raise NotImplementedError


class SmtpVerificationEmailSender(VerificationEmailSender):
    def __init__(self, settings: Settings):
        self.settings = settings

    def send_code(self, email: str, code: str, purpose: str) -> None:
        if not self.settings.smtp_username or not self.settings.smtp_password:
            raise RuntimeError("SMTP 未配置，请先在本地 .env 填写邮箱账号和授权码")

        action = "注册" if purpose == "register" else "登录"
        message = EmailMessage()
        message["Subject"] = f"企业知识平台{action}验证码"
        message["From"] = formataddr(
            (
                str(Header(self.settings.smtp_from_name, "utf-8")),
                self.settings.smtp_from_email,
            )
        )
        message["To"] = email
        message.set_content(
            "\n".join(
                [
                    f"你的企业知识平台{action}验证码是：{code}",
                    f"验证码 {self.settings.email_code_expire_minutes} 分钟内有效。",
                    "如果不是你本人操作，请忽略这封邮件。",
                ]
            )
        )

        if self.settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(
                self.settings.smtp_host,
                self.settings.smtp_port,
                timeout=15,
            ) as client:
                client.login(self.settings.smtp_username, self.settings.smtp_password)
                client.send_message(message)
            return

        with smtplib.SMTP(
            self.settings.smtp_host,
            self.settings.smtp_port,
            timeout=15,
        ) as client:
            if self.settings.smtp_use_tls:
                client.starttls()
            client.login(self.settings.smtp_username, self.settings.smtp_password)
            client.send_message(message)


class EmailVerificationService:
    def __init__(
        self,
        *,
        sender: VerificationEmailSender,
        expire_minutes: int = 10,
        resend_seconds: int = 60,
        hash_secret: str = "local-email-code-secret",
    ):
        self.sender = sender
        self.expire_minutes = expire_minutes
        self.resend_seconds = resend_seconds
        self.hash_secret = hash_secret

    def latest_code(
        self,
        db: Session,
        *,
        email: str,
        purpose: str,
    ) -> EmailVerificationCode | None:
        return db.execute(
            select(EmailVerificationCode)
            .where(
                EmailVerificationCode.email == normalize_email(email),
                EmailVerificationCode.purpose == self._normalize_purpose(purpose),
                EmailVerificationCode.consumed_at.is_(None),
            )
            .order_by(desc(EmailVerificationCode.created_at))
            .limit(1)
        ).scalar_one_or_none()

    def send_code(self, db: Session, *, email: str, purpose: str) -> None:
        normalized_email = normalize_email(email)
        normalized_purpose = self._normalize_purpose(purpose)
        now = utc_now()
        latest = self.latest_code(db, email=normalized_email, purpose=normalized_purpose)
        if latest is not None:
            created_at = normalize_datetime(latest.created_at)
            wait_until = created_at + timedelta(seconds=self.resend_seconds)
            if wait_until > now:
                remaining = max(1, math.ceil((wait_until - now).total_seconds()))
                raise ValueError(f"请 {remaining} 秒后再获取验证码")

        code = f"{secrets.randbelow(1_000_000):06d}"
        self.sender.send_code(normalized_email, code, normalized_purpose)
        db.add(
            EmailVerificationCode(
                email=normalized_email,
                purpose=normalized_purpose,
                code_hash=self._hash_code(normalized_email, normalized_purpose, code),
                expires_at=now + timedelta(minutes=self.expire_minutes),
            )
        )
        db.flush()

    def consume_code(
        self,
        db: Session,
        *,
        email: str,
        code: str,
        purpose: str,
    ) -> None:
        normalized_email = normalize_email(email)
        normalized_purpose = self._normalize_purpose(purpose)
        code_hash = self._hash_code(normalized_email, normalized_purpose, code.strip())
        record = db.execute(
            select(EmailVerificationCode)
            .where(
                EmailVerificationCode.email == normalized_email,
                EmailVerificationCode.purpose == normalized_purpose,
                EmailVerificationCode.code_hash == code_hash,
                EmailVerificationCode.consumed_at.is_(None),
            )
            .order_by(desc(EmailVerificationCode.created_at))
            .limit(1)
        ).scalar_one_or_none()
        now = utc_now()
        if record is None or normalize_datetime(record.expires_at) <= now:
            raise ValueError("验证码错误或已过期")
        record.consumed_at = now
        db.flush()

    def _hash_code(self, email: str, purpose: str, code: str) -> str:
        payload = f"{self.hash_secret}:{email}:{purpose}:{code}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def _normalize_purpose(self, purpose: str) -> str:
        normalized = purpose.strip().lower()
        if normalized not in VALID_PURPOSES:
            raise ValueError("验证码用途不支持")
        return normalized


def create_email_verification_service(settings: Settings) -> EmailVerificationService:
    return EmailVerificationService(
        sender=SmtpVerificationEmailSender(settings),
        expire_minutes=settings.email_code_expire_minutes,
        resend_seconds=settings.email_code_resend_seconds,
        hash_secret=settings.jwt_secret_key,
    )
