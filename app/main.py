
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app import database


# Initialize SQLite when the application starts
@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_database()
    yield


app = FastAPI(
    title="SecureShip API",
    description="Shipment Management API for DevSecOps",
    version="0.3.0",
    lifespan=lifespan
)


# Shipment creation model
class Shipment(BaseModel):
    recipient: str = Field(min_length=1)
    destination: str = Field(min_length=1)


# Allowed status values
class ShipmentStatusUpdate(BaseModel):
    status: Literal["created", "in_transit", "delivered"]


# Home endpoint
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
        shipment.destination
    )


# List all shipments
@app.get("/shipments")
def list_shipments():
    return database.list_shipments()


# Update shipment status
@app.patch("/shipments/{shipment_id}/status")
def update_shipment_status(
    shipment_id: int,
    update: ShipmentStatusUpdate
):
    shipment = database.update_shipment_status(
        shipment_id,
        update.status
    )

    if shipment is None:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found"
        )

    return shipment
