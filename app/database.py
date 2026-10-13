
import os
import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = (
    Path(__file__).resolve().parent.parent / "secureship.db"
)

DB_PATH = Path(
    os.getenv("SECURESHIP_DB_PATH", str(DEFAULT_DB_PATH))
)


def init_database():
    connection = sqlite3.connect(DB_PATH)

    try:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS shipments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipient TEXT NOT NULL,
                destination TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'created'
                    CHECK (status IN (
                        'created',
                        'in_transit',
                        'delivered'
                    ))
            )
        """)

        connection.commit()

    finally:
        connection.close()

##############################################################################################################



# Create a shipment in SQLite
def create_shipment(recipient, destination):
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    try:
        cursor = connection.execute(
            """
            INSERT INTO shipments (recipient, destination)
            VALUES (?, ?)
            """,
            (recipient, destination)
        )

        connection.commit()

        row = connection.execute(
            "SELECT * FROM shipments WHERE id = ?",
            (cursor.lastrowid,)
        ).fetchone()

        return dict(row)

    finally:
        connection.close()


# Retrieve all shipments from SQLite
def list_shipments():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    try:
        rows = connection.execute(
            "SELECT * FROM shipments ORDER BY id"
        ).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()


# Update a shipment status in SQLite
def update_shipment_status(shipment_id, status):
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    try:
        cursor = connection.execute(
            """
            UPDATE shipments
            SET status = ?
            WHERE id = ?
            """,
            (status, shipment_id)
        )

        connection.commit()

        if cursor.rowcount == 0:
            return None

        row = connection.execute(
            "SELECT * FROM shipments WHERE id = ?",
            (shipment_id,)
        ).fetchone()

        return dict(row)

    finally:
        connection.close()
