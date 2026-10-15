import pytest
from fastapi.testclient import TestClient

from app import database
from app.main import app


# Shared fixture: every test gets its own temporary SQLite database.
# (tests/test_main.py keeps its own identical fixture, which takes priority.)
@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "secureship_test.db")

    with TestClient(app) as test_client:
        yield test_client
