"""Optional: fill a SEPARATE SQLite file with fictional demo shipments.

Usage (from the project root):

    python scripts/seed_demo.py                 # creates ./demo.db
    SECURESHIP_DB_PATH=demo.db python -m uvicorn app.main:app --reload

The script never touches the default secureship.db and refuses to write
into a database that already contains shipments.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import database  # noqa: E402

# Fictional people and plain city names. Status changes below are real
# changes recorded with the current time, exactly like in normal use.
DEMO_SHIPMENTS = [
    ("Salma Benjelloun", "Rabat", "Casablanca", "Matériel de bureau", "delivered"),
    ("Youssef El Amrani", "Tanger", "Rabat", None, "delivered"),
    ("Imane Tazi", "Marrakech", "Casablanca", "Colis fragile", "in_transit"),
    ("Omar Idrissi", "Fès", "Rabat", None, "in_transit"),
    ("Khadija Alaoui", "Agadir", "Casablanca", "Livraison avant 17 h", "in_transit"),
    ("Mehdi Berrada", "Meknès", "Rabat", None, "created"),
    ("Nadia Chraibi", "Tétouan", "Tanger", "Appeler avant la livraison", "created"),
    ("Hamza Lahlou", "Oujda", "Fès", None, "created"),
    ("Lina Fassi", "Salé", "Rabat", None, "delivered"),
    ("Reda Bennani", "Kénitra", "Salé", "Documents", "created"),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--db", default="demo.db", help="target SQLite file")
    args = parser.parse_args()

    target = Path(args.db).resolve()

    if target == database.DEFAULT_DB_PATH.resolve():
        sys.exit("Refusing to seed the default secureship.db. Choose another --db.")

    database.DB_PATH = target
    database.init_database()

    if database.count_shipments() > 0:
        sys.exit(f"{target} already contains shipments; nothing was changed.")

    for recipient, destination, origin, notes, status in DEMO_SHIPMENTS:
        shipment = database.create_shipment(
            recipient, destination, origin=origin, notes=notes
        )

        if status in ("in_transit", "delivered"):
            database.update_shipment_status(shipment["id"], "in_transit")

        if status == "delivered":
            database.update_shipment_status(shipment["id"], "delivered")

    print(f"{len(DEMO_SHIPMENTS)} fictional shipments written to {target}")
    print(f"Start with: SECURESHIP_DB_PATH={args.db} python -m uvicorn app.main:app --reload")


if __name__ == "__main__":
    main()
