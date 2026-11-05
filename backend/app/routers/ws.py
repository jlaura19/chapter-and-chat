import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select

from ..database import SessionLocal
from ..models import DiscussionBoard, ClubMembership, User
from ..realtime import hub
from ..routers.community import post_board_message
from ..schemas import MessageIn
from ..security import decode_token

router = APIRouter()

AUTH_TIMEOUT_SECONDS = 10
CLOSE_UNAUTHORIZED = 4401


def _user_for_token(token: str) -> int | None:
    user_id = decode_token(token)
    if user_id is None:
        return None
    with SessionLocal() as db:
        return user_id if db.get(User, user_id) is not None else None


def _club_for_member_board(user_id: int, board_id: int) -> int | None:
    """Returns the club id only when the user is a member of the board's club."""
    with SessionLocal() as db:
        board = db.get(DiscussionBoard, board_id)
        if board is None:
            return None
        member = db.scalar(
            select(ClubMembership.id).where(
                ClubMembership.club_id == board.club_id, ClubMembership.user_id == user_id
            )
        )
        return board.club_id if member is not None else None


def _post_message(user_id: int, board_id: int, body: str) -> dict:
    with SessionLocal() as db:
        user = db.get(User, user_id)
        club_id = _club_for_member_board(user_id, board_id)
        if user is None or club_id is None:
            raise PermissionError("Not a member of this board's club")
        return post_board_message(db, club_id, board_id, user, body)


async def _send_error(websocket: WebSocket, message: str) -> None:
    await websocket.send_json({"type": "error", "message": message})


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    hub.loop = asyncio.get_running_loop()

    try:
        auth = await asyncio.wait_for(websocket.receive_json(), AUTH_TIMEOUT_SECONDS)
    except (asyncio.TimeoutError, ValueError, WebSocketDisconnect):
        await websocket.close(code=CLOSE_UNAUTHORIZED)
        return
    user_id = None
    if isinstance(auth, dict) and auth.get("type") == "auth":
        user_id = await run_in_threadpool(_user_for_token, str(auth.get("token", "")))
    if user_id is None:
        await websocket.close(code=CLOSE_UNAUTHORIZED)
        return

    hub.register_user(user_id, websocket)
    await websocket.send_json({"type": "ready", "userId": user_id})
    try:
        while True:
            try:
                frame = await websocket.receive_json()
            except ValueError:
                await _send_error(websocket, "Frames must be JSON")
                continue
            if not isinstance(frame, dict):
                await _send_error(websocket, "Frames must be JSON objects")
                continue

            kind = frame.get("type")
            board_id = frame.get("boardId")
            if not isinstance(board_id, int):
                await _send_error(websocket, "boardId must be an integer")
                continue

            if kind == "subscribe":
                club_id = await run_in_threadpool(_club_for_member_board, user_id, board_id)
                if club_id is None:
                    await _send_error(websocket, "Not a member of this board's club")
                    continue
                hub.subscribe_board(board_id, websocket)
                await websocket.send_json({"type": "subscribed", "boardId": board_id})
            elif kind == "message":
                try:
                    body = MessageIn(body=str(frame.get("body", ""))).body
                except ValueError:
                    await _send_error(websocket, "Message must be 1-2000 characters")
                    continue
                try:
                    await run_in_threadpool(_post_message, user_id, board_id, body)
                except PermissionError as exc:
                    await _send_error(websocket, str(exc))
            else:
                await _send_error(websocket, f"Unknown frame type: {kind}")
    except WebSocketDisconnect:
        pass
    finally:
        hub.remove(websocket)
