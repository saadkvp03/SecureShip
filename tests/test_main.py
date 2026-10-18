import pytest
from fastapi.testclient import TestClient

from app import database
from app.main import app
from conftest import login_test_client


# Each test uses its own temporary SQLite database.
@pytest.fixture
def client(tmp_path, monkeypatch, auth_env):
    test_db = tmp_path / "secureship_test.db"
    monkeypatch.setattr(database, "DB_PATH", test_db)

    # Start the FastAPI lifespan to initialize the test database.
    with TestClient(app) as test_client:
        yield login_test_client(test_client)


# TEST 1 — Home page
def test_home(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["application"] == "SecureShip"


# TEST 2 — Health check
def test_health(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# TEST 3 — Unknown route
def test_unknown_route(client):
    response = client.get("/unknown")

    assert response.status_code == 404


# TEST 4 — Create a shipment (POST)
def test_create_shipment(client):
    response = client.post(
        "/shipments",
        json={"recipient": "Test Client", "destination": "Rabat"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == 1
    assert data["recipient"] == "Test Client"
    assert data["destination"] == "Rabat"
    assert data["status"] == "created"


# TEST 5 — List shipments (GET)
def test_list_shipments(client):
    response = client.get("/shipments")
    assert response.status_code == 200
    assert response.json() == []

    response_a = client.post(
        "/shipments", json={"recipient": "Client A", "destination": "Rabat"}
    )
    response_b = client.post(
        "/shipments", json={"recipient": "Client B", "destination": "Casablanca"}
    )
    assert response_a.status_code == 201
    assert response_b.status_code == 201

    response = client.get("/shipments")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2
    assert data[0]["recipient"] == "Client A"
    assert data[1]["recipient"] == "Client B"


# TEST 6 — Update shipment status (PATCH)
def test_update_shipment_status(client):
    created = client.post(
        "/shipments", json={"recipient": "Test Client", "destination": "Rabat"}
    )
    shipment_id = created.json()["id"]

    response = client.patch(
        f"/shipments/{shipment_id}/status", json={"status": "in_transit"}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "in_transit"


# TEST 7 — Unknown shipment
def test_update_unknown_shipment(client):
    response = client.patch(
        "/shipments/999/status", json={"status": "delivered"}
    )

    assert response.status_code == 404


# TEST 8 — Invalid shipment status
def test_invalid_shipment_status(client):
    created = client.post(
        "/shipments", json={"recipient": "Test Client", "destination": "Rabat"}
    )
    shipment_id = created.json()["id"]

    response = client.patch(
        f"/shipments/{shipment_id}/status", json={"status": "flying"}
    )

    assert response.status_code == 422


# TEST 9 — Stored data remains after a new application client starts.
def test_sqlite_persistence(client):
    created = client.post(
        "/shipments",
        json={"recipient": "Persistent Client", "destination": "Tanger"},
    )
    assert created.status_code == 201
    shipment_id = created.json()["id"]

    # A fresh TestClient triggers startup again, using the same temporary DB.
    with TestClient(app) as restarted_client:
        login_test_client(restarted_client)
        response = restarted_client.get("/shipments")

    assert response.status_code == 200
    shipments = response.json()
    assert len(shipments) == 1
    assert shipments[0]["id"] == shipment_id
    assert shipments[0]["recipient"] == "Persistent Client"
