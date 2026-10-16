
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app import database

ShipmentStatus = Literal["created", "in_transit", "delivered"]

DEFAULT_FRONTEND_DIR = (
    Path(__file__).resolve().parent.parent / "frontend" / "dist"
)


# Initialize SQLite when the application starts
@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_database()
    yield


app = FastAPI(
    title="SecureShip API",
    description="Shipment Management API for DevSecOps",
    version="0.4.0",
    lifespan=lifespan
)


# Shipment creation model
class Shipment(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    recipient: str = Field(min_length=1, max_length=120)
    destination: str = Field(min_length=1, max_length=160)
    origin: Optional[str] = Field(default=None, max_length=160)
    notes: Optional[str] = Field(default=None, max_length=500)

    # Empty optional fields are stored as NULL, not as empty strings.
    @field_validator("origin", "notes")
    @classmethod
    def blank_to_none(cls, value):
        return value or None


# Allowed status values
class ShipmentStatusUpdate(BaseModel):
    status: ShipmentStatus


# Home endpoint (JSON contract kept; the web interface lives at /app)
@app.get("/")
def home():
    return {
        "application": "SecureShip",
        "message": "Welcome to SecureShip API"
    }


# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "ok"}


# Create a shipment
@app.post("/shipments", status_code=201)
def create_shipment(shipment: Shipment):
    return database.create_shipment(
        shipment.recipient,
        shipment.destination,
        origin=shipment.origin,
        notes=shipment.notes,
    )


# List shipments. Without query parameters, every shipment is returned
# as a plain JSON list (original behaviour). The number of matching
# shipments, ignoring pagination, is exposed in the X-Total-Count header.
@app.get("/shipments")
def list_shipments(
    response: Response,
    q: Optional[str] = Query(default=None, max_length=100),
    status: Optional[ShipmentStatus] = None,
    sort: Literal["id", "recipient", "destination", "status"] = "id",
    order: Literal["asc", "desc"] = "asc",
    limit: Optional[int] = Query(default=None, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    response.headers["X-Total-Count"] = str(
        database.count_shipments(q, status)
    )

    return database.list_shipments(
        search=q,
        status=status,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )


# Dashboard statistics, computed from SQLite
@app.get("/stats")
def get_stats():
    return database.get_stats()


# Shipment details with its recorded status history
@app.get("/shipments/{shipment_id}")
def get_shipment(shipment_id: int):
    shipment = database.get_shipment(shipment_id)

    if shipment is None:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found"
        )

    shipment["events"] = database.get_shipment_events(shipment_id)
    return shipment


# Update shipment status
@app.patch("/shipments/{shipment_id}/status")
def update_shipment_status(
    shipment_id: int,
    update: ShipmentStatusUpdate
):
    try:
        shipment = database.update_shipment_status(
            shipment_id,
            update.status
        )
    except database.InvalidStatusTransition as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc)
        ) from exc

    if shipment is None:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found"
        )

    return shipment



##############################################################################
# Web interface (React build) served under /app


def _frontend_dir() -> Path:
    return Path(os.getenv("SECURESHIP_FRONTEND_DIR", str(DEFAULT_FRONTEND_DIR)))


_NOT_BUILT_PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>SecureShip interface not built</title></head>
<body style="font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem">
<h1>The SecureShip interface is not built yet</h1>
<p>Run <code>cd frontend &amp;&amp; npm install &amp;&amp; npm run build</code>,
or use <code>npm run dev</code> for development.</p>
<p>The API remains available: <a href="/docs">/docs</a></p>
</body></html>"""


@app.get("/app", include_in_schema=False)
def web_interface_root():
    return _serve_frontend("")


@app.get("/app/{path:path}", include_in_schema=False)
def web_interface(path: str):
    return _serve_frontend(path)


def _serve_frontend(path: str):
    dist = _frontend_dir().resolve()
    index = dist / "index.html"

    if not index.is_file():
        return HTMLResponse(_NOT_BUILT_PAGE, status_code=503)

    if path:
        candidate = (dist / path).resolve()

        # Serve a real file only if it stays inside the build directory.
        if dist in candidate.parents and candidate.is_file():
            headers = {}

            if "assets" in candidate.relative_to(dist).parts:
                headers["Cache-Control"] = (
                    "public, max-age=31536000, immutable"
                )

            return FileResponse(candidate, headers=headers)

    return FileResponse(index, headers={"Cache-Control": "no-cache"})
