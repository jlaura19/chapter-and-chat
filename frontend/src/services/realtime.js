import { getToken } from './session'

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 15000
const UNAUTHORIZED_CLOSE_CODE = 4401

// Opens one authenticated socket to /ws. Subscriptions are replayed after every reconnect.
export function connectBoardSocket({ onMessage, onStatus, onError }) {
  let socket = null
  let ready = false
  let closed = false
  let attempts = 0
  let retryTimer = null
  let subscribedBoardId = null

  const socketUrl = () => {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${scheme}://${window.location.host}/ws`
  }

  const sendFrame = (frame) => {
    if (!socket || !ready || socket.readyState !== WebSocket.OPEN) {
      return false
    }
    socket.send(JSON.stringify(frame))
    return true
  }

  const open = () => {
    onStatus?.('connecting')
    socket = new WebSocket(socketUrl())

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', token: getToken() }))
    }

    socket.onmessage = (event) => {
      let frame
      try {
        frame = JSON.parse(event.data)
      } catch {
        return
      }

      if (frame.type === 'ready') {
        ready = true
        attempts = 0
        onStatus?.('connected')
        if (subscribedBoardId !== null) {
          sendFrame({ type: 'subscribe', boardId: subscribedBoardId })
        }
      } else if (frame.type === 'message') {
        onMessage?.(frame.message)
      } else if (frame.type === 'error') {
        onError?.(frame.message)
      }
    }

    socket.onclose = (event) => {
      ready = false
      if (closed) {
        return
      }
      if (event.code === UNAUTHORIZED_CLOSE_CODE) {
        onStatus?.('unauthorized')
        return
      }
      onStatus?.('reconnecting')
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempts, RECONNECT_MAX_MS)
      attempts += 1
      retryTimer = setTimeout(open, delay)
    }
  }

  open()

  return {
    subscribe(boardId) {
      subscribedBoardId = boardId
      sendFrame({ type: 'subscribe', boardId })
    },
    // Returns false when the socket is not ready, so the caller can fall back to REST.
    send(boardId, body) {
      return sendFrame({ type: 'message', boardId, body })
    },
    close() {
      closed = true
      clearTimeout(retryTimer)
      socket?.close()
    },
  }
}
