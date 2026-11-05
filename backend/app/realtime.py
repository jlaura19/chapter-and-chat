import asyncio
import logging
from collections import defaultdict

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder

logger = logging.getLogger(__name__)


class Hub:
    """In-process WebSocket registry. Run a single worker, or move fan-out to Redis for multiple workers."""

    def __init__(self) -> None:
        self.loop: asyncio.AbstractEventLoop | None = None
        self._board_subscribers: dict[int, set[WebSocket]] = defaultdict(set)
        self._user_sockets: dict[int, set[WebSocket]] = defaultdict(set)

    def subscribe_board(self, board_id: int, websocket: WebSocket) -> None:
        self._board_subscribers[board_id].add(websocket)

    def register_user(self, user_id: int, websocket: WebSocket) -> None:
        self._user_sockets[user_id].add(websocket)

    def remove(self, websocket: WebSocket) -> None:
        for sockets in self._board_subscribers.values():
            sockets.discard(websocket)
        for user_id, sockets in list(self._user_sockets.items()):
            sockets.discard(websocket)
            if not sockets:
                del self._user_sockets[user_id]

    def unsubscribe_user_from_boards(self, user_id: int, board_ids: list[int]) -> None:
        """Stops a user's open sockets receiving board traffic after they leave or are removed from a club."""
        sockets = set(self._user_sockets.get(user_id, ()))
        for board_id in board_ids:
            subscribers = self._board_subscribers.get(board_id)
            if subscribers:
                subscribers.difference_update(sockets)

    async def send_board(self, board_id: int, payload: dict) -> None:
        for websocket in list(self._board_subscribers.get(board_id, ())):
            await self._send(websocket, payload)

    async def send_users(self, user_ids: list[int], payload: dict) -> None:
        for user_id in user_ids:
            for websocket in list(self._user_sockets.get(user_id, ())):
                await self._send(websocket, payload)

    def publish_board(self, board_id: int, payload: dict) -> None:
        """Thread-safe: callable from sync FastAPI endpoints running in the threadpool."""
        self._schedule(self.send_board(board_id, jsonable_encoder(payload)))

    def publish_users(self, user_ids: list[int], payload: dict) -> None:
        self._schedule(self.send_users(user_ids, jsonable_encoder(payload)))

    def _schedule(self, coroutine) -> None:
        if self.loop is None or self.loop.is_closed():
            coroutine.close()
            return
        asyncio.run_coroutine_threadsafe(coroutine, self.loop)

    @staticmethod
    async def _send(websocket: WebSocket, payload: dict) -> None:
        try:
            await websocket.send_json(payload)
        except Exception:  # noqa: BLE001 - a dead socket is removed when its handler exits
            logger.debug("Dropping WebSocket send failure", exc_info=True)


hub = Hub()
