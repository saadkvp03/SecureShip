.PHONY: install backend frontend test build docker seed

# One-time setup
install:
	python3 -m venv .venv
	.venv/bin/python -m pip install -r requirements.txt
	cd frontend && npm install

# Development: run these two in separate terminals
backend:
	.venv/bin/python -m uvicorn app.main:app --reload

frontend:
	cd frontend && npm run dev

test:
	.venv/bin/python -m pytest -q

# Production-like: build the interface, FastAPI serves it at /app
build:
	cd frontend && npm run build

docker:
	docker compose up --build

# Optional fictional data in a separate demo.db (never secureship.db)
seed:
	.venv/bin/python scripts/seed_demo.py
