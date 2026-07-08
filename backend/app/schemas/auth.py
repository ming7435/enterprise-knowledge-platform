from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    username: str
    status: str


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(
        min_length=2,
        max_length=20,
        pattern=r"^[\u4e00-\u9fffA-Za-z0-9_-]+$",
    )
    password: str = Field(min_length=8, max_length=128)
    verification_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class SendEmailCodeRequest(BaseModel):
    email: EmailStr
    purpose: Literal["login", "register", "reset_password"]


class EmailCodeLoginRequest(BaseModel):
    email: EmailStr
    verification_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    verification_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)


class SendEmailCodeResponse(BaseModel):
    message: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    user: UserPublic
    personal_workspace: "WorkspacePublic"


from app.schemas.workspaces import WorkspacePublic

RegisterResponse.model_rebuild()
