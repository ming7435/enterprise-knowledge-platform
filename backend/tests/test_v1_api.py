from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_default_rerank_model_path_points_to_models_root():
    settings = Settings()

    assert settings.rerank_model_path == r"L:\RAG_系统\models"


def test_default_ports_match_local_development_contract():
    settings = Settings()

    assert settings.api_port == 9520
    assert settings.frontend_port == 9521


def make_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'v1_test.db'}",
        jwt_secret_key="test-secret",
        local_storage_root=str(tmp_path / "uploads"),
        rerank_model_path=r"L:\RAG_系统\models",
    )
    app = create_app(settings)
    return TestClient(app)


def test_cors_allows_frontend_port_9521(tmp_path: Path):
    client = make_client(tmp_path)

    response = client.options(
        "/api/v1/auth/me",
        headers={
            "Origin": "http://127.0.0.1:9521",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:9521"


def register(client: TestClient, email: str = "owner@example.com") -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "username": "Owner",
            "password": "StrongPass123",
        },
    )
    assert response.status_code == 201
    return response.json()


def login(client: TestClient, email: str = "owner@example.com") -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "StrongPass123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_register_creates_user_and_personal_workspace(tmp_path: Path):
    client = make_client(tmp_path)

    payload = register(client)

    assert payload["user"]["email"] == "owner@example.com"
    assert payload["personal_workspace"]["type"] == "personal"
    assert payload["personal_workspace"]["name"] == "Owner 的个人工作区"


def test_duplicate_email_registration_is_rejected(tmp_path: Path):
    client = make_client(tmp_path)
    register(client)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "owner@example.com",
            "username": "Other",
            "password": "StrongPass123",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "邮箱已注册"


def test_login_and_me_return_current_user(tmp_path: Path):
    client = make_client(tmp_path)
    register(client)

    token = login(client)
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "owner@example.com"


def test_enterprise_workspace_creation_adds_owner_membership(tmp_path: Path):
    client = make_client(tmp_path)
    register(client)
    token = login(client)

    created = client.post(
        "/api/v1/workspaces/enterprise",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "明途科技", "description": "企业知识库"},
    )
    assert created.status_code == 201

    list_response = client.get(
        "/api/v1/workspaces",
        headers={"Authorization": f"Bearer {token}"},
    )
    workspaces = list_response.json()

    assert [item["type"] for item in workspaces] == ["personal", "enterprise"]
    assert workspaces[1]["role"] == "owner"
    assert workspaces[1]["name"] == "明途科技"


def test_workspace_access_is_isolated_by_active_membership(tmp_path: Path):
    client = make_client(tmp_path)
    register(client, "owner@example.com")
    owner_token = login(client, "owner@example.com")
    owner_workspace_id = client.get(
        "/api/v1/workspaces",
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()[0]["id"]

    register(client, "outsider@example.com")
    outsider_token = login(client, "outsider@example.com")

    response = client.get(
        f"/api/v1/workspaces/{owner_workspace_id}",
        headers={"Authorization": f"Bearer {outsider_token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "无权访问该工作区"


def test_workspace_scoped_modules_require_membership(tmp_path: Path):
    client = make_client(tmp_path)
    register(client, "owner@example.com")
    owner_token = login(client, "owner@example.com")
    owner_workspace_id = client.get(
        "/api/v1/workspaces",
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()[0]["id"]

    register(client, "outsider@example.com")
    outsider_token = login(client, "outsider@example.com")

    forbidden = client.get(
        f"/api/v1/workspaces/{owner_workspace_id}/documents",
        headers={"Authorization": f"Bearer {outsider_token}"},
    )
    allowed = client.get(
        f"/api/v1/workspaces/{owner_workspace_id}/documents",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    assert forbidden.status_code == 403
    assert allowed.status_code == 200
    assert allowed.json() == []
