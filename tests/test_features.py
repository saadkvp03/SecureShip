from http import client
import re
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import database, main
from app.main import app
from conftest import login_test_client

TRACKING_PATTERN = re.compile(r"^SS-[A-HJ-NP-Z2-9]{6}$")


def make(client, recipient="Client", destination="Rabat", **extra):
    response = client.post(
        "/shipments",
        json={"recipient": recipient, "destination": destination, **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()


# ---------------------------------------------------------------- creation


def test_create_returns_tracking_reference_and_dates(client):
    shipment = make(
        client, "Fatima", "Fès", origin="Casablanca", notes="Fragile"
    )

    assert TRACKING_PATTERN.match(shipment["tracking_ref"])
    assert shipment["origin"] == "Casablanca"
    assert shipment["notes"] == "Fragile"
    assert shipment["created_at"] and shipment["updated_at"]
    assert shipment["status"] == "created"


def test_tracking_references_are_unique(client):
    references = {make(client)["tracking_ref"] for _ in range(30)}
    assert len(references) == 30


def test_optional_fields_default_to_null(client):
    shipment = make(client, origin="   ", notes="")
    assert shipment["origin"] is None
    assert shipment["notes"] is None


def test_values_are_trimmed(client):
    shipment = make(client, "  Amina  ", "  Tanger ")
    assert shipment["recipient"] == "Amina"
    assert shipment["destination"] == "Tanger"


@pytest.mark.parametrize(
    "payload",
    [
        {"recipient": "   ", "destination": "Rabat"},
        {"recipient": "A", "destination": ""},
        {"recipient": "A" * 121, "destination": "Rabat"},
        {"recipient": "A", "destination": "Rabat", "notes": "x" * 501},
        {"destination": "Rabat"},
    ],
)
def test_invalid_creation_is_rejected(client, payload):
    assert client.post("/shipments", json=payload).status_code == 422


# ----------------------------------------------------------- details/history


def test_detail_contains_history(client):
    shipment = make(client)
    detail = client.get(f"/shipments/{shipment['id']}")

    assert detail.status_code == 200
    body = detail.json()
    assert body["tracking_ref"] == shipment["tracking_ref"]
    assert [e["to_status"] for e in body["events"]] == ["created"]
    assert body["events"][0]["from_status"] is None


def test_detail_unknown_shipment(client):
    response = client.get("/shipments/999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Shipment not found"


def test_status_change_is_recorded_once(client):
    shipment = make(client)
    url = f"/shipments/{shipment['id']}/status"

    assert client.patch(url, json={"status": "in_transit"}).status_code == 200
    # Same status again: accepted, but it is not a change, so no new event.
    assert client.patch(url, json={"status": "in_transit"}).status_code == 200
    assert client.patch(url, json={"status": "delivered"}).status_code == 200

    events = client.get(f"/shipments/{shipment['id']}").json()["events"]
    assert [(e["from_status"], e["to_status"]) for e in events] == [
        (None, "created"),
        ("created", "in_transit"),
        ("in_transit", "delivered"),
    ]


def test_delivered_is_final(client):
    shipment = make(client)
    shipment_id = shipment["id"]
    url = f"/shipments/{shipment_id}/status"

    # Transitions autorisées
    assert client.patch(
        url, json={"status": "in_transit"}
    ).status_code == 200

    assert client.patch(
        url, json={"status": "delivered"}
    ).status_code == 200

    # Sauvegarder l'état et l'historique
    detail_url = f"/shipments/{shipment_id}"
    before = client.get(detail_url).json()

    # Transition interdite
    response = client.patch(
        url, json={"status": "created"}
    )

    assert response.status_code == 409

    # Aucun changement de données ou d'historique
    after = client.get(detail_url).json()
    assert after["status"] == "delivered"
    assert after["events"] == before["events"]

@pytest.mark.parametrize(
    "initial_path, forbidden_status",
    [
        ([], "delivered"),
        (["in_transit"], "created"),
        (["in_transit", "delivered"], "in_transit"),
    ],
)
def test_forbidden_status_transitions(
    client, initial_path, forbidden_status
):
    shipment = make(client)
    shipment_id = shipment["id"]

    status_url = f"/shipments/{shipment_id}/status"
    detail_url = f"/shipments/{shipment_id}"

    # Atteindre l'état initial par des transitions autorisées
    for status in initial_path:
        response = client.patch(
            status_url, json={"status": status}
        )
        assert response.status_code == 200

    # Sauvegarder les données avant la tentative interdite
    before = client.get(detail_url).json()

    # Tenter une transition interdite
    response = client.patch(
        status_url,
        json={"status": forbidden_status}
    )

    assert response.status_code == 409

    # Vérifier que ni le colis ni l'historique n'ont changé
    after = client.get(detail_url).json()
    assert after == before


# ------------------------------------------------------------------ listing


def test_default_list_is_still_a_plain_list(client):
    make(client)
    response = client.get("/shipments")

    assert isinstance(response.json(), list)
    assert response.headers["X-Total-Count"] == "1"


def test_search_ignores_case_and_accents(client):
    make(client, "Fatima", "Fès")
    make(client, "Youssef", "Tanger")

    found = client.get("/shipments", params={"q": "FES"}).json()
    assert [s["destination"] for s in found] == ["Fès"]

    by_reference = client.get("/shipments").json()[1]["tracking_ref"].lower()
    found = client.get("/shipments", params={"q": by_reference}).json()
    assert [s["recipient"] for s in found] == ["Youssef"]


def test_search_treats_wildcards_literally(client):
    make(client, "Fatima", "Fès")
    assert client.get("/shipments", params={"q": "%"}).json() == []
    assert client.get("/shipments", params={"q": "_"}).json() == []


def test_search_is_safe_against_sql_injection(client):
    make(client)
    response = client.get("/shipments", params={"q": "' OR 1=1; --"})
    assert response.status_code == 200
    assert response.json() == []
    assert len(client.get("/shipments").json()) == 1


def test_filter_by_status(client):
    first = make(client, "A")
    make(client, "B")
    url = f"/shipments/{first['id']}/status"

    assert client.patch(
        url, json={"status": "in_transit"}
    ).status_code == 200

    assert client.patch(
        url, json={"status": "delivered"}
    ).status_code == 200

    delivered = client.get("/shipments", params={"status": "delivered"})
    assert [s["recipient"] for s in delivered.json()] == ["A"]
    assert delivered.headers["X-Total-Count"] == "1"

    assert client.get("/shipments", params={"status": "flying"}).status_code == 422


def test_sorting(client):
    for name in ["Charlie", "alice", "Bob"]:
        make(client, name)

    ascending = client.get(
        "/shipments", params={"sort": "recipient", "order": "asc"}
    ).json()
    assert [s["recipient"] for s in ascending] == ["alice", "Bob", "Charlie"]

    newest_first = client.get(
        "/shipments", params={"sort": "id", "order": "desc"}
    ).json()
    assert [s["recipient"] for s in newest_first] == ["Bob", "alice", "Charlie"]

    assert client.get("/shipments", params={"sort": "password"}).status_code == 422


def test_pagination_reports_total(client):
    for index in range(5):
        make(client, f"Client {index}")

    page = client.get("/shipments", params={"limit": 2, "offset": 2})
    assert [s["recipient"] for s in page.json()] == ["Client 2", "Client 3"]
    assert page.headers["X-Total-Count"] == "5"

    assert client.get("/shipments", params={"limit": 0}).status_code == 422
    assert client.get("/shipments", params={"offset": -1}).status_code == 422


# -------------------------------------------------------------------- stats


def test_stats_when_empty(client):
    assert client.get("/stats").json() == {
        "total": 0,
        "by_status": {"created": 0, "in_transit": 0, "delivered": 0},
        "recent_activity": [],
    }


def test_stats_reflect_stored_data(client):
    a = make(client, "A")
    b = make(client, "B")
    make(client, "C")
    client.patch(f"/shipments/{a['id']}/status", json={"status": "in_transit"})
    url_b = f"/shipments/{b['id']}/status"

    assert client.patch(
        url_b, json={"status": "in_transit"}
    ).status_code == 200

    assert client.patch(
        url_b, json={"status": "delivered"}
    ).status_code == 200

    stats = client.get("/stats").json()
    assert stats["total"] == 3
    assert stats["by_status"] == {"created": 1, "in_transit": 1, "delivered": 1}

    activity = stats["recent_activity"]
    assert len(activity) == 6  # 3 creations + 3 status changes
    assert activity[0]["to_status"] == "delivered"
    assert activity[0]["recipient"] == "B"


# ------------------------------------------------------ legacy DB migration


def test_legacy_database_is_upgraded_without_data_loss(tmp_path, monkeypatch):
    legacy = tmp_path / "legacy.db"
    connection = sqlite3.connect(legacy)
    connection.execute("""
        CREATE TABLE shipments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient TEXT NOT NULL,
            destination TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'created'
                CHECK (status IN ('created', 'in_transit', 'delivered'))
        )
    """)
    connection.execute(
        "INSERT INTO shipments (recipient, destination, status) "
        "VALUES ('Old Client', 'Sala Jadida', 'in_transit')"
    )
    connection.commit()
    connection.close()

    monkeypatch.setattr(database, "DB_PATH", legacy)

    with TestClient(app) as client:
        login_test_client(client)
        shipments = client.get("/shipments").json()
        assert len(shipments) == 1
        assert shipments[0]["recipient"] == "Old Client"
        assert shipments[0]["status"] == "in_transit"
        assert TRACKING_PATTERN.match(shipments[0]["tracking_ref"])
        # Never recorded: must stay empty rather than be invented.
        assert shipments[0]["created_at"] is None

        detail = client.get(f"/shipments/{shipments[0]['id']}").json()
        assert detail["events"] == []

        # The legacy shipment keeps working with the new features.
        patched = client.patch(
            f"/shipments/{shipments[0]['id']}/status",
            json={"status": "delivered"},
        )
        assert patched.status_code == 200
        assert len(client.get(f"/shipments/{shipments[0]['id']}").json()["events"]) == 1


def test_init_database_is_idempotent(client):
    make(client)
    database.init_database()
    database.init_database()
    assert len(client.get("/shipments").json()) == 1


# --------------------------------------------------- compatibility / frontend


def test_swagger_and_root_contract_are_kept(client):
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200
    assert client.get("/").json() == {
        "application": "SecureShip",
        "message": "Welcome to SecureShip API",
    }


def test_interface_shows_help_page_when_not_built(client, tmp_path, monkeypatch):
    monkeypatch.setenv("SECURESHIP_FRONTEND_DIR", str(tmp_path / "missing"))
    response = client.get("/app/")
    assert response.status_code == 503
    assert "not built" in response.text


@pytest.fixture
def built_frontend(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>SecureShip UI</html>")
    (dist / "assets" / "app.js").write_text("console.log('ok')")
    (tmp_path / "secret.txt").write_text("top secret")
    monkeypatch.setenv("SECURESHIP_FRONTEND_DIR", str(dist))
    return dist


def test_interface_is_served_under_app(client, built_frontend):
    for url in ("/app", "/app/", "/app/some/client/route"):
        response = client.get(url)
        assert response.status_code == 200
        assert "SecureShip UI" in response.text

    asset = client.get("/app/assets/app.js")
    assert asset.status_code == 200
    assert "immutable" in asset.headers["cache-control"]


def test_interface_cannot_read_files_outside_build(client, built_frontend):
    response = main._serve_frontend("../secret.txt")
    # Falls back to the interface instead of exposing the file.
    assert Path(response.path).resolve() == (built_frontend / "index.html").resolve()
