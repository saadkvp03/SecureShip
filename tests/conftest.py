import pytest
from fastapi.testclient import TestClient

from app import auth, database
from app.main import app


TEST_USERNAME = "lab-operator"
TEST_PASSWORD = "example-local-password-123"
TEST_HASH = auth.hash_password(TEST_PASSWORD)


@pytest.fixture(autouse=True)
def auth_env(monkeypatch):
    monkeypatch.setenv("SECURESHIP_AUTH_USER", TEST_USERNAME)
    monkeypatch.setenv("SECURESHIP_AUTH_PASSWORD_HASH", TEST_HASH)


def login_test_client(client):
    response = client.post("/auth/login", json={
        "username": TEST_USERNAME, "password": TEST_PASSWORD,
    })
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return client


# Shared fixture: every test gets its own temporary SQLite database.
# (tests/test_main.py keeps its own identical fixture, which takes priority.)
@pytest.fixture
def client(tmp_path, monkeypatch, auth_env):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "secureship_test.db")

    with TestClient(app) as test_client:
        yield login_test_client(test_client)
