from app import database


def test_sql_injection_payload_is_not_executed(tmp_path, monkeypatch):
    # Isolated temporary SQLite database.
    monkeypatch.setattr(
        database,
        "DB_PATH",
        tmp_path / "sqli-test.db",
    )

    database.init_database()
    database.create_shipment("SQLi Test", "Rabat")

    payload = "' OR 1=1 --"

    assert database.count_shipments() == 1

    # The injected condition must not return all rows.
    assert database.count_shipments(search=payload) == 0
    assert database.count_shipments(status=payload) == 0

    # Listing endpoints must also treat the payload as data.
    assert database.list_shipments(search=payload) == []
    assert database.list_shipments(status=payload) == []