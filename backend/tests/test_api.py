import uuid

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def _unique(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _guest(client: TestClient, guest_id: str | None = None) -> dict:
    response = client.post("/api/auth/guest", json={"guestId": guest_id or str(uuid.uuid4())})
    assert response.status_code == 200, response.text
    body = response.json()
    return {
        "headers": {"Authorization": f"Bearer {body['accessToken']}"},
        "token": body["accessToken"],
        "user": body["user"],
    }


def _create_club(client: TestClient, owner: dict, privacy: str = "public") -> dict:
    response = client.post(
        "/api/clubs",
        json={"name": _unique("club"), "privacy": privacy},
        headers=owner["headers"],
    )
    assert response.status_code == 201, response.text
    return response.json()


def _create_board(client: TestClient, owner: dict, club_id: int) -> dict:
    response = client.post(
        f"/api/clubs/{club_id}/boards",
        json={"title": "Chapter 1-5", "prompt": "Thoughts?", "kind": "thread"},
        headers=owner["headers"],
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_guest_session_is_stable_per_browser(client):
    guest_id = str(uuid.uuid4())
    actor = _guest(client, guest_id)
    repeat = _guest(client, guest_id)
    another_browser = _guest(client)

    assert actor["user"]["id"] == repeat["user"]["id"]
    assert actor["user"]["id"] != another_browser["user"]["id"]
    assert client.get("/api/auth/me", headers=actor["headers"]).json()["id"] == actor["user"]["id"]


def test_invite_code_rotates_and_progress_is_readable(client):
    owner = _guest(client)
    club = _create_club(client, owner, "private")

    rotated = client.post(f"/api/clubs/{club['id']}/invite-code", headers=owner["headers"])
    assert rotated.status_code == 200
    assert rotated.json()["inviteCode"] != club["inviteCode"]

    saved = client.put(
        f"/api/clubs/{club['id']}/progress", json={"page": 42, "chapter": "3"}, headers=owner["headers"]
    )
    assert saved.status_code == 200
    progress = client.get(f"/api/clubs/{club['id']}/progress", headers=owner["headers"])
    assert progress.status_code == 200
    assert progress.json()[0]["page"] == 42


def test_protected_routes_require_token(client):
    assert client.get("/api/clubs").status_code in (401, 403)


def test_email_register_and_login(client):
    payload = {"email": "Reader@Example.com", "password": "secret123", "displayName": "Reader One"}
    registered = client.post("/api/auth/register", json=payload)
    assert registered.status_code == 200
    assert registered.json()["user"]["email"] == "reader@example.com"

    assert client.post("/api/auth/register", json=payload).status_code == 409
    assert client.post("/api/auth/register", json={**payload, "email": "x@y.io", "password": "short"}).status_code == 422

    login = client.post("/api/auth/login", json={"email": "reader@example.com", "password": "secret123"})
    assert login.status_code == 200
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {login.json()['accessToken']}"})
    assert me.json()["displayName"] == "Reader One"
    assert client.post("/api/auth/login", json={"email": "reader@example.com", "password": "wrong-pass"}).status_code == 401


def test_account_deletion_and_signup_are_not_offered(client):
    assert client.post("/api/auth/signup", json={}).status_code == 404
    assert client.request("DELETE", "/api/profile", json={}).status_code == 405


def test_public_club_join_is_instant(client):
    owner = _guest(client)
    joiner = _guest(client)
    club = _create_club(client, owner, "public")

    response = client.post(f"/api/clubs/{club['id']}/join", json={}, headers=joiner["headers"])
    assert response.status_code == 200
    assert response.json()["status"] == "joined"


def test_private_club_is_listed_but_invite_code_stays_admin_only(client):
    owner = _guest(client)
    outsider = _guest(client)
    invited = _guest(client)
    club = _create_club(client, owner, "private")
    invite_code = club["inviteCode"]
    assert invite_code

    listed = {c["id"]: c for c in client.get("/api/clubs", headers=outsider["headers"]).json()}
    assert club["id"] in listed
    assert "inviteCode" not in listed[club["id"]]

    detail = client.get(f"/api/clubs/{club['id']}", headers=outsider["headers"])
    assert detail.status_code == 200
    assert "inviteCode" not in detail.json()

    wrong = client.post(
        f"/api/clubs/{club['id']}/join", json={"inviteCode": "nope"}, headers=invited["headers"]
    )
    assert wrong.status_code == 403

    right = client.post(
        f"/api/clubs/{club['id']}/join", json={"inviteCode": invite_code}, headers=invited["headers"]
    )
    assert right.status_code == 200
    assert right.json()["status"] == "joined"


def test_private_club_join_without_code_requires_approval(client):
    owner = _guest(client)
    outsider = _guest(client)
    club = _create_club(client, owner, "private")

    response = client.post(f"/api/clubs/{club['id']}/join", json={}, headers=outsider["headers"])
    assert response.status_code == 200
    assert response.json()["status"] == "pending"
    assert client.get(f"/api/clubs/{club['id']}/boards", headers=outsider["headers"]).status_code == 403



def test_private_club_join_request_can_be_approved(client):
    owner = _guest(client)
    requester = _guest(client)
    club = _create_club(client, owner, "private")

    pending = client.post(f"/api/clubs/{club['id']}/join", json={}, headers=requester["headers"])
    assert pending.json()["status"] == "pending"

    requests = client.get(f"/api/clubs/{club['id']}/requests", headers=owner["headers"]).json()
    assert len(requests) == 1
    request_id = requests[0]["id"]

    owner_notes = client.get("/api/notifications", headers=owner["headers"]).json()
    assert any(n["kind"] == "join_request" for n in owner_notes)

    decided = client.post(
        f"/api/clubs/{club['id']}/requests/{request_id}",
        json={"approve": True},
        headers=owner["headers"],
    )
    assert decided.status_code == 200

    members = client.get(f"/api/clubs/{club['id']}/members", headers=owner["headers"]).json()
    assert requester["user"]["id"] in [m["user"]["id"] for m in members]

    requester_notes = client.get("/api/notifications", headers=requester["headers"]).json()
    assert any(n["kind"] == "join_decision" for n in requester_notes)


def test_boards_and_messages_are_members_only(client):
    owner = _guest(client)
    outsider = _guest(client)
    club = _create_club(client, owner, "private")
    board = _create_board(client, owner, club["id"])

    assert client.get(f"/api/clubs/{club['id']}/boards", headers=outsider["headers"]).status_code == 403
    assert (
        client.post(
            f"/api/clubs/{club['id']}/boards/{board['id']}/messages",
            json={"body": "hello"},
            headers=outsider["headers"],
        ).status_code
        == 403
    )

    own = client.post(
        f"/api/clubs/{club['id']}/boards/{board['id']}/messages",
        json={"body": "hello"},
        headers=owner["headers"],
    )
    assert own.status_code == 201


def test_event_rsvp_yes_no_maybe(client):
    owner = _guest(client)
    member = _guest(client)
    club = _create_club(client, owner, "public")
    client.post(f"/api/clubs/{club['id']}/join", json={}, headers=member["headers"])

    event = client.post(
        f"/api/clubs/{club['id']}/events",
        json={"title": "Chapter 1-5 Sync", "startsAt": "2030-01-04T18:00:00+00:00", "location": "Library"},
        headers=owner["headers"],
    )
    assert event.status_code == 201, event.text
    event_id = event.json()["id"]

    member_notes = client.get("/api/notifications", headers=member["headers"]).json()
    assert any(n["kind"] == "event" for n in member_notes)

    for response in ("maybe", "yes", "no"):
        rsvp = client.put(
            f"/api/clubs/{club['id']}/events/{event_id}/rsvp",
            json={"response": response},
            headers=member["headers"],
        )
        assert rsvp.status_code == 200
        body = rsvp.json()
        assert body["myRsvp"] == response
        assert body["rsvpCounts"][response] == 1

    listed = client.get(f"/api/clubs/{club['id']}/events", headers=member["headers"]).json()
    assert listed[0]["rsvpCounts"] == {"yes": 0, "no": 1, "maybe": 0}


def test_websocket_rejects_bad_token(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "token": "not-a-jwt"})
            ws.receive_json()


def test_websocket_subscribe_and_message_broadcast_for_members(client):
    owner = _guest(client)
    member = _guest(client)
    outsider = _guest(client)
    club = _create_club(client, owner, "public")
    client.post(f"/api/clubs/{club['id']}/join", json={}, headers=member["headers"])
    board = _create_board(client, owner, club["id"])

    with client.websocket_connect("/ws") as owner_ws, client.websocket_connect("/ws") as outsider_ws:
        owner_ws.send_json({"type": "auth", "token": owner["token"]})
        assert owner_ws.receive_json()["type"] == "ready"
        outsider_ws.send_json({"type": "auth", "token": outsider["token"]})
        assert outsider_ws.receive_json()["type"] == "ready"

        owner_ws.send_json({"type": "subscribe", "boardId": board["id"]})
        assert owner_ws.receive_json() == {"type": "subscribed", "boardId": board["id"]}

        outsider_ws.send_json({"type": "subscribe", "boardId": board["id"]})
        assert outsider_ws.receive_json()["type"] == "error"

        outsider_ws.send_json({"type": "message", "boardId": board["id"], "body": "sneaky"})
        assert outsider_ws.receive_json()["type"] == "error"

    with client.websocket_connect("/ws") as owner_ws, client.websocket_connect("/ws") as member_ws:
        owner_ws.send_json({"type": "auth", "token": owner["token"]})
        owner_ws.receive_json()
        member_ws.send_json({"type": "auth", "token": member["token"]})
        member_ws.receive_json()

        owner_ws.send_json({"type": "subscribe", "boardId": board["id"]})
        owner_ws.receive_json()

        member_ws.send_json({"type": "message", "boardId": board["id"], "body": "Loved chapter 3"})
        frame = owner_ws.receive_json()
        assert frame["type"] == "message"
        assert frame["boardId"] == board["id"]
        assert frame["message"]["body"] == "Loved chapter 3"
        assert frame["message"]["authorUsername"] == member["user"]["username"]


def test_removed_member_stops_receiving_board_traffic(client):
    owner = _guest(client)
    member = _guest(client)
    club = _create_club(client, owner, "public")
    client.post(f"/api/clubs/{club['id']}/join", json={}, headers=member["headers"])
    board = _create_board(client, owner, club["id"])

    with client.websocket_connect("/ws") as owner_ws, client.websocket_connect("/ws") as member_ws:
        owner_ws.send_json({"type": "auth", "token": owner["token"]})
        owner_ws.receive_json()
        member_ws.send_json({"type": "auth", "token": member["token"]})
        member_ws.receive_json()

        owner_ws.send_json({"type": "subscribe", "boardId": board["id"]})
        owner_ws.receive_json()
        member_ws.send_json({"type": "subscribe", "boardId": board["id"]})
        member_ws.receive_json()

        removed = client.delete(
            f"/api/clubs/{club['id']}/members/{member['user']['id']}", headers=owner["headers"]
        )
        assert removed.status_code == 204

        posted = client.post(
            f"/api/clubs/{club['id']}/boards/{board['id']}/messages",
            json={"body": "after removal"},
            headers=owner["headers"],
        )
        assert posted.status_code == 201
        assert owner_ws.receive_json()["type"] == "message"

        member_ws.send_json({"type": "subscribe", "boardId": board["id"]})
        frame = member_ws.receive_json()
        assert frame["type"] == "error", "removed member must not receive the broadcast"
