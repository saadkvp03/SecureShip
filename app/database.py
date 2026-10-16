"""SQLite persistence layer for SecureShip.

All values coming from users are passed as bound SQL parameters. The only
text interpolated into SQL are identifiers that come from fixed whitelists
defined in this module (column names, sort expressions).
"""

import os
import secrets
import sqlite3
import unicodedata
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_DB_PATH = (
    Path(__file__).resolve().parent.parent / "secureship.db"
)

DB_PATH = Path(
    os.getenv("SECURESHIP_DB_PATH", str(DEFAULT_DB_PATH))
)

STATUSES = ("created", "in_transit", "delivered")
ALLOWED_TRANSITIONS = {
    "created": {"in_transit"},
    "in_transit": {"delivered"},
    "delivered": set(),
}


class InvalidStatusTransition(Exception):
    """Raised when a shipment status transition is forbidden."""
    pass

# Readable tracking references: no 0/O or 1/I/L confusion.
_TRACKING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

# Columns added after the first version of the schema (non-destructive).
_ADDED_COLUMNS = {
    "tracking_ref": "TEXT",
    "origin": "TEXT",
    "notes": "TEXT",
    "created_at": "TEXT",
    "updated_at": "TEXT",
}

# Whitelisted ORDER BY expressions (never built from user input).
_SORT_EXPRESSIONS = {
    "id": "id",
    "recipient": "recipient COLLATE NOCASE",
    "destination": "destination COLLATE NOCASE",
    "status": (
        "CASE status WHEN 'created' THEN 0 "
        "WHEN 'in_transit' THEN 1 ELSE 2 END"
    ),
}


def _now():
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def _fold(value):
    """Lower-case and strip accents so 'fes' matches 'Fès'."""
    if value is None:
        return ""
    decomposed = unicodedata.normalize("NFKD", str(value))
    stripped = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    return stripped.casefold()


@contextmanager
def _connect():
    # DB_PATH is read at call time so tests can point it elsewhere.
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.create_function("fold", 1, _fold, deterministic=True)

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _new_tracking_ref(connection):
    for _ in range(50):
        reference = "SS-" + "".join(
            secrets.choice(_TRACKING_ALPHABET) for _ in range(6)
        )
        exists = connection.execute(
            "SELECT 1 FROM shipments WHERE tracking_ref = ?",
            (reference,),
        ).fetchone()

        if exists is None:
            return reference

    raise RuntimeError("Could not generate a unique tracking reference")


def init_database():
    """Create tables and upgrade older databases without losing data."""
    with _connect() as connection:
        # Original schema, unchanged, so existing databases are untouched.
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

        existing = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(shipments)")
        }

        for name, column_type in _ADDED_COLUMNS.items():
            if name not in existing:
                connection.execute(
                    f"ALTER TABLE shipments ADD COLUMN {name} {column_type}"
                )

        connection.execute("""
            CREATE TABLE IF NOT EXISTS shipment_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shipment_id INTEGER NOT NULL
                    REFERENCES shipments(id) ON DELETE CASCADE,
                from_status TEXT,
                to_status TEXT NOT NULL
                    CHECK (to_status IN (
                        'created',
                        'in_transit',
                        'delivered'
                    )),
                occurred_at TEXT NOT NULL
            )
        """)

        connection.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_tracking_ref "
            "ON shipments(tracking_ref)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_shipments_status "
            "ON shipments(status)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_events_shipment "
            "ON shipment_events(shipment_id, id)"
        )

        # Legacy rows get a reference. Their creation date and history were
        # never recorded, so they stay NULL instead of being invented.
        legacy = connection.execute(
            "SELECT id FROM shipments WHERE tracking_ref IS NULL"
        ).fetchall()

        for row in legacy:
            connection.execute(
                "UPDATE shipments SET tracking_ref = ? WHERE id = ?",
                (_new_tracking_ref(connection), row["id"]),
            )


##############################################################################


def _build_filters(search, status):
    clauses = []
    params = []

    if status:
        clauses.append("status = ?")
        params.append(status)

    if search and search.strip():
        escaped = (
            _fold(search.strip())
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )
        pattern = f"%{escaped}%"
        clauses.append(
            "(fold(recipient) LIKE ? ESCAPE '\\' "
            "OR fold(destination) LIKE ? ESCAPE '\\' "
            "OR fold(origin) LIKE ? ESCAPE '\\' "
            "OR fold(tracking_ref) LIKE ? ESCAPE '\\')"
        )
        params.extend([pattern] * 4)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where, params


# Create a shipment in SQLite and record its first event
def create_shipment(recipient, destination, origin=None, notes=None):
    now = _now()

    with _connect() as connection:
        cursor = connection.execute(
            """
            INSERT INTO shipments (
                recipient, destination, origin, notes,
                tracking_ref, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                recipient,
                destination,
                origin,
                notes,
                _new_tracking_ref(connection),
                now,
                now,
            ),
        )

        connection.execute(
            """
            INSERT INTO shipment_events (
                shipment_id, from_status, to_status, occurred_at
            )
            VALUES (?, NULL, 'created', ?)
            """,
            (cursor.lastrowid, now),
        )

        row = connection.execute(
            "SELECT * FROM shipments WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

        return dict(row)


# Retrieve shipments (all of them when no option is given)
def list_shipments(
    search=None,
    status=None,
    sort="id",
    order="asc",
    limit=None,
    offset=0,
):
    where, params = _build_filters(search, status)
    expression = _SORT_EXPRESSIONS.get(sort, _SORT_EXPRESSIONS["id"])
    direction = "DESC" if str(order).lower() == "desc" else "ASC"

    query = (
        f"SELECT * FROM shipments {where} "
        f"ORDER BY {expression} {direction}, id ASC"
    )

    if limit is not None:
        query += " LIMIT ? OFFSET ?"
        params = params + [int(limit), int(offset)]

    with _connect() as connection:
        rows = connection.execute(query, params).fetchall()
        return [dict(row) for row in rows]


def count_shipments(search=None, status=None):
    where, params = _build_filters(search, status)

    with _connect() as connection:
        row = connection.execute(
            f"SELECT COUNT(*) AS total FROM shipments {where}",
            params,
        ).fetchone()
        return row["total"]


def get_shipment(shipment_id):
    with _connect() as connection:
        row = connection.execute(
            "SELECT * FROM shipments WHERE id = ?",
            (shipment_id,),
        ).fetchone()

        return dict(row) if row else None


def get_shipment_events(shipment_id):
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT id, from_status, to_status, occurred_at
            FROM shipment_events
            WHERE shipment_id = ?
            ORDER BY id
            """,
            (shipment_id,),
        ).fetchall()

        return [dict(row) for row in rows]


# Update a shipment status in SQLite and record the change
def update_shipment_status(shipment_id, status):
    with _connect() as connection:
        current = connection.execute(
            "SELECT status FROM shipments WHERE id = ?",
            (shipment_id,),
        ).fetchone()

        if current is None:
            return None

        if current["status"] != status:
            if status not in ALLOWED_TRANSITIONS[current["status"]]:
                raise InvalidStatusTransition(
                    f"Cannot change status from "
                    f"{current['status']} to {status}"
                )

            now = _now()

            connection.execute(
                """
                UPDATE shipments
                SET status = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, now, shipment_id),
            )

            connection.execute(
                """
                INSERT INTO shipment_events (
                    shipment_id, from_status, to_status, occurred_at
                )
                VALUES (?, ?, ?, ?)
                """,
                (shipment_id, current["status"], status, now),
            )

        row = connection.execute(
            "SELECT * FROM shipments WHERE id = ?",
            (shipment_id,),
        ).fetchone()

        return dict(row)


# Statistics computed from the stored data only
def get_stats(recent_limit=8):
    with _connect() as connection:
        by_status = {status: 0 for status in STATUSES}

        for row in connection.execute(
            "SELECT status, COUNT(*) AS total FROM shipments GROUP BY status"
        ):
            by_status[row["status"]] = row["total"]

        recent = connection.execute(
            """
            SELECT
                e.id,
                e.shipment_id,
                s.tracking_ref,
                s.recipient,
                s.destination,
                e.from_status,
                e.to_status,
                e.occurred_at
            FROM shipment_events AS e
            JOIN shipments AS s ON s.id = e.shipment_id
            ORDER BY e.id DESC
            LIMIT ?
            """,
            (int(recent_limit),),
        ).fetchall()

        return {
            "total": sum(by_status.values()),
            "by_status": by_status,
            "recent_activity": [dict(row) for row in recent],
        }
