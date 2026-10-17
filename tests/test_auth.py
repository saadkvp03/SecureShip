"""Security regressions for the single-user local authentication boundary."""

import hashlib

import pytest
from fastapi.testclient import TestClient

from app import auth
from app.main import app
from conftest import TEST_PASSWORD, TEST_USERNAME


def test_password_is_salted_and_verified():
    hashed = auth.hash_password(TEST_PASSWORD)
    assert hashed != auth.hash_password(TEST_PASSWORD)
    assert auth.verify_password(TEST_PASSWORD, hashed)
    assert not auth.verify_password("wrong-password", hashed)
    assert not auth.verify_password("anything", "not-a-valid-hash")


@pytest.mark.parametrize("method,path,body", [
    ("GET", "/shipments", None),
    ("GET", "/stats", None),
    ("GET", "/shipments/1", None),
    ("POST", "/shipments", {"recipient": "Unauthorized", "destination": "Rabat"}),
    ("PATCH", "/shipments/1/status", {"status": "in_transit"}),
])
def test_unauthenticated_access_is_rejected(client, method, path, body):
    # A separate anonymous client reaches the SAME initialized database.
    with TestClient(app) as anonymous:
        response = anonymous.request(method, path, json=body)
    assert response.status_code == 401


def test_bad_login_and_no_session(client):
    with TestClient(app) as anonymous:
        assert anonymous.post('/auth/login', json={
            'username': TEST_USERNAME, 'password': 'wrong-password'
        }).status_code == 401
        assert anonymous.post('/auth/login', json={
            'username': 'wrong-user', 'password': TEST_PASSWORD
        }).status_code == 401
        assert anonymous.get('/auth/me').status_code == 401
    assert client.get('/health').status_code == 200


def test_session_cookie_protection(client):
    cookie = client.cookies.get(auth.COOKIE_NAME)
    assert cookie and len(cookie) >= 30
    assert auth._token_hash(cookie) == hashlib.sha256(cookie.encode()).hexdigest()
    assert client.get('/auth/me').json()['username'] == TEST_USERNAME
    assert 'httponly' in client.post('/auth/login', json={
        'username': TEST_USERNAME, 'password': TEST_PASSWORD
    }).headers['set-cookie'].lower()


def test_csrf_required_for_writes(client):
    # Session is valid but the anti-CSRF token is missing/incorrect.
    client.headers.pop('X-CSRF-Token')
    response = client.post('/shipments', json={'recipient': 'Denied', 'destination': 'Rabat'})
    assert response.status_code == 403
    assert client.patch('/shipments/1/status', json={'status': 'in_transit'}).status_code == 403
    client.headers['X-CSRF-Token'] = 'invalid-token'
    assert client.post('/auth/logout').status_code == 403
    assert client.get('/shipments').json() == []


def test_logout_revokes_server_side_session(client):
    response = client.post('/auth/logout')
    assert response.status_code == 200
    assert client.get('/auth/me').status_code == 401
    assert client.get('/shipments').status_code == 401


def test_session_expires(client, monkeypatch):
    current = auth.time.time()
    monkeypatch.setattr(auth.time, 'time', lambda: current + auth.SESSION_SECONDS + 1)
    assert client.get('/auth/me').status_code == 401


def test_status_integrity_still_enforced_after_login(client):
    created = client.post('/shipments', json={'recipient': 'Lab', 'destination': 'Rabat'})
    assert created.status_code == 201
    shipment_id = created.json()['id']
    denied = client.patch(f'/shipments/{shipment_id}/status', json={'status': 'delivered'})
    assert denied.status_code == 409
    assert client.get(f'/shipments/{shipment_id}').json()['status'] == 'created'
